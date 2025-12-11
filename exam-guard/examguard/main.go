// ---------------------------
// ExamGuard (OS-SAFE + MAX SECURITY)
// Strong ESC + F11 blocking
// Chrome keyboard-shortcut disabling
// Raw-input + low-level hook
// Auto lockdown every 5 seconds
// ---------------------------

package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"

	"github.com/rs/cors"
	"github.com/shirou/gopsutil/v3/process"
)

type ScanResult struct {
	Success bool     `json:"success"`
	Message string   `json:"message"`
	Killed  []string `json:"killed"`
}

// Logging
var (
	logDir  = `C:\ExamGuard\logs`
	logFile = filepath.Join(logDir, "lockdown.log")
)

// Graceful shutdown
var shuttingDown int32 = 0

// Self-PID to avoid killing ExamGuard
var selfPID = os.Getpid()

// Allowed apps (do not kill)
var allowedApps = map[string]bool{
	"examguard.exe": true,
	"main.exe":      true,
	"chrome.exe":    true,
	"msedge.exe":    true,
}

// Windows Shell processes (must not kill)
var shellProcesses = map[string]bool{
	"explorer.exe":                true,
	"sihost.exe":                  true,
	"startmenuexperiencehost.exe": true,
	"shellexperiencehost.exe":     true,
	"applicationframehost.exe":    true,
	"runtimebroker.exe":           true,
	"searchhost.exe":              true,
	"searchindexer.exe":           true,
	"lockapp.exe":                 true,
	"textinputhost.exe":           true,
	"backgroundtaskhost.exe":      true,
	"widgetboard.exe":             true,
	"widgetservice.exe":           true,
	"useroobebroker.exe":          true,
	"monotificationux.exe":        true,
	"crossdeviceresume.exe":       true,
	"phoneexperiencehost.exe":     true,
	"systemsettings.exe":          true,
	"smartscreen.exe":             true,
}

// ---------------- Logging ----------------

func ensureLogDir() {
	_ = os.MkdirAll(logDir, 0o755)
}

func log(format string, args ...interface{}) {
	ensureLogDir()
	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		fmt.Printf(format+"\n", args...)
		return
	}
	defer f.Close()
	ts := time.Now().Format(time.RFC3339)
	line := fmt.Sprintf(ts+" "+format+"\n", args...)
	_, _ = f.WriteString(line)
}

// ------------- PROCESS SAFETY CHECKS ----------------

func isSystemAccount(user string) bool {
	u := strings.ToLower(user)
	return strings.Contains(u, "system") ||
		strings.Contains(u, "local service") ||
		strings.Contains(u, "network service") ||
		strings.Contains(u, "nt authority")
}

func exeInWindowsDir(exePath string) bool {
	if exePath == "" {
		return false
	}
	p := strings.ToLower(filepath.Clean(exePath))
	return strings.HasPrefix(p, strings.ToLower(`c:\windows`))
}

func isAllowedProcess(p *process.Process) bool {
	if int(p.Pid) == selfPID {
		return true
	}

	name, err1 := p.Name()
	exe, err2 := p.Exe()
	user, err3 := p.Username()

	if err1 != nil || err2 != nil || err3 != nil {
		return true
	}

	n := strings.ToLower(name)
	e := strings.ToLower(exe)
	u := strings.ToLower(user)

	if shellProcesses[n] {
		return true
	}

	if exeInWindowsDir(e) {
		return true
	}

	if isSystemAccount(u) {
		return true
	}

	if allowedApps[n] {
		return true
	}

	return false
}

func executeKillOnce() ScanResult {
	procs, err := process.Processes()
	res := ScanResult{Success: true}
	if err != nil {
		res.Success = false
		res.Message = err.Error()
		log("ERROR: %s", err)
		return res
	}

	for _, p := range procs {
		if atomic.LoadInt32(&shuttingDown) == 1 {
			break
		}

		if int(p.Pid) == selfPID {
			continue
		}

		if isAllowedProcess(p) {
			continue
		}

		children, _ := p.Children()
		for _, c := range children {
			c.Terminate()
			c.Kill()
			log("killed child %d", c.Pid)
		}

		p.Terminate()
		p.Kill()

		name, _ := p.Name()
		res.Killed = append(res.Killed, name)
		log("killed %s (pid=%d)", name, p.Pid)
	}

	return res
}

func autoLockdown(interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		if atomic.LoadInt32(&shuttingDown) == 1 {
			return
		}
		<-t.C
		func() {
			defer func() {
				if r := recover(); r != nil {
					log("panic in autoLockdown: %v", r)
				}
			}()
			executeKillOnce()
		}()
	}
}

// ---------------- KEYBOARD BLOCKING: RAW INPUT + LOW-LEVEL HOOK ------------------

var (
	user32DLL               = syscall.NewLazyDLL("user32.dll")
	setWindowsHookEx        = user32DLL.NewProc("SetWindowsHookExW")
	callNextHookEx          = user32DLL.NewProc("CallNextHookEx")
	getMessage              = user32DLL.NewProc("GetMessageW")
	getAsyncKeyStateProc    = user32DLL.NewProc("GetAsyncKeyState")
	registerRawInputDevices = user32DLL.NewProc("RegisterRawInputDevices")
	getRawInputData         = user32DLL.NewProc("GetRawInputData")
	blockInputProc          = user32DLL.NewProc("BlockInput")
)

const (
	WH_KEYBOARD_LL = 13
	WM_KEYDOWN     = 0x0100
	WM_SYSKEYDOWN  = 0x0104
	WM_INPUT       = 0x00FF

	VK_ESCAPE = 0x1B
	VK_F11    = 0x7A
	VK_F4     = 0x73
	VK_LWIN   = 0x5B
	VK_RWIN   = 0x5C
	VK_APPS   = 0x5D
)

type KBDLLHOOKSTRUCT struct {
	VkCode uint32
}

type MSG struct {
	Hwnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
}

type RAWINPUTDEVICE struct {
	UsagePage uint16
	Usage     uint16
	Flags     uint32
	Target    uintptr
}

type RAWINPUTHEADER struct {
	Type uint32
	Size uint32
	Hwnd uintptr
}

type RAWKEYBOARD struct {
	MakeCode uint16
	Flags    uint16
	Reserved uint16
	VKey     uint16
	Message  uint32
	Extra    uint32
}

type RAWINPUT struct {
	Header RAWINPUTHEADER
	Data   RAWKEYBOARD
}

func blockInput(enable bool) {
	if enable {
		blockInputProc.Call(1)
	} else {
		blockInputProc.Call(0)
	}
}

// strongest possible user-mode ESC/F11 block:
func shouldBlockKey(k uint16) bool {
	return k == VK_ESCAPE || k == VK_F11 || k == VK_LWIN || k == VK_RWIN || k == VK_APPS || k == VK_F4
}

// ---------- RAW INPUT BLOCKER ----------

func startRawInputBlocker() {
	runtime.LockOSThread()

	rid := RAWINPUTDEVICE{
		UsagePage: 1,
		Usage:     6,          // keyboard
		Flags:     0x00000100, // RIDEV_INPUTSINK
		Target:    0,
	}

	registerRawInputDevices.Call(
		uintptr(unsafe.Pointer(&rid)),
		1,
		unsafe.Sizeof(rid),
	)

	var msg MSG

	for {
		ret, _, _ := getMessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		if int32(ret) <= 0 {
			continue
		}

		if msg.Message != WM_INPUT {
			continue
		}

		var raw RAWINPUT
		size := uint32(unsafe.Sizeof(raw))

		getRawInputData.Call(
			msg.LParam,
			0x10000003, // RID_INPUT
			uintptr(unsafe.Pointer(&raw)),
			uintptr(unsafe.Pointer(&size)),
			uintptr(unsafe.Sizeof(raw.Header)),
		)

		vk := raw.Data.VKey
		sc := raw.Data.MakeCode // ESC scancode = 1

		if vk == VK_ESCAPE || sc == 1 || shouldBlockKey(vk) {
			blockInput(true)
			time.Sleep(25 * time.Millisecond)
			blockInput(false)
			continue
		}
	}
}

// ---------- LOW-LEVEL HOOK (backup) ----------

func lowLevelHook(nCode int, wParam uintptr, lParam uintptr) uintptr {
	if nCode == 0 {
		kb := (*KBDLLHOOKSTRUCT)(unsafe.Pointer(lParam))
		if shouldBlockKey(uint16(kb.VkCode)) {
			return 1
		}
	}
	ret, _, _ := callNextHookEx.Call(0, uintptr(nCode), wParam, lParam)
	return ret
}

func startLowLevelHook() {
	runtime.LockOSThread()
	cb := syscall.NewCallback(lowLevelHook)

	h, _, _ := setWindowsHookEx.Call(
		uintptr(WH_KEYBOARD_LL),
		cb,
		0,
		0,
	)

	if h == 0 {
		log("LOW LEVEL HOOK FAILED")
		return
	}

	var msg MSG
	for {
		getMessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
	}
}

// Combined blocker
func startKeyboardBlockers() {
	go startRawInputBlocker()
	go startLowLevelHook()
}

// ---------------- CHROME KIOSK MODE (MAX SHORTCUT DISABLE) -------------------

var browserPaths = []string{
	`C:\Program Files\Google\Chrome\Application\chrome.exe`,
	`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
}

func findChrome() string {
	for _, p := range browserPaths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "chrome"
}

func launchKiosk(url string) (*exec.Cmd, error) {
	path := findChrome()

	args := []string{
		"--app=" + url, // MUST be first
		"--kiosk",
		"--incognito",
		"--no-first-run",
		"--disable-infobars",
		"--disable-session-crashed-bubble",

		// 100% remove fullscreen exit UI
		"--disable-features=FullscreenToolbar,FullscreenExitUI,ExclusiveAccessBubbleUseShorterDelay",

		// Force Chrome window to not behave like a tab fullscreen
		"--window-size=1920,1080",
		"--window-position=-32000,-32000", // Forces Chrome into true app window mode

		"--disable-overlay-scrollbar",
		"--hide-scrollbars",
		"--overscroll-history-navigation=0",

		"--disable-features=FocusMode",
		"--disable-features=HardwareMediaKeyHandling",
		"--disable-background-networking",
		"--disable-translate",
		"--disable-sync",
		"--disable-popup-blocking",

		// Disable ALL Chrome shortcuts internally
		"--ash-disable-keyboard-shortcuts",

		// Force app window behavior
		"--enable-features=AppRuntimeLauncher",
	}

	cmd := exec.Command(path, args...)

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	log("KIOSK Chrome started pid=%d", cmd.Process.Pid)
	return cmd, nil
}

// ------------------ HTTP HANDLERS -------------------

func handleCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"active": true,
	})
}

func handleScan(w http.ResponseWriter, r *http.Request) {
	res := executeKillOnce()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func handleStartExam(w http.ResponseWriter, r *http.Request) {
	if atomic.LoadInt32(&shuttingDown) == 1 {
		http.Error(w, "shutting down", 503)
		return
	}

	url := r.URL.Query().Get("url")
	if url == "" {
		http.Error(w, "missing url", 400)
		return
	}

	executeKillOnce()

	cmd, err := launchKiosk(url)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	json.NewEncoder(w).Encode(map[string]any{
		"ok":  true,
		"pid": cmd.Process.Pid,
	})
}

func handleExit(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]any{"closing": true})
	go func() {
		atomic.StoreInt32(&shuttingDown, 1)
		time.Sleep(300 * time.Millisecond)
		os.Exit(0)
	}()
}

// ---------------- MAIN ----------------

func main() {
	ensureLogDir()
	log("ExamGuard started (MAX SECURITY)")

	// Start keyboard blocking
	go startKeyboardBlockers()

	// Start auto lockdown loop
	go autoLockdown(5 * time.Second)

	mux := http.NewServeMux()
	mux.HandleFunc("/check", handleCheck)
	mux.HandleFunc("/scan", handleScan)
	mux.HandleFunc("/start-exam", handleStartExam)
	mux.HandleFunc("/exit", handleExit)

	handler := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST"},
	}).Handler(mux)

	fmt.Println("ExamGuard running on http://localhost:12345")
	log("HTTP server started on :12345")

	http.ListenAndServe("localhost:12345", handler)
}
