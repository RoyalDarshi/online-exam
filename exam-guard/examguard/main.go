// main.go
// ExamGuard v3 - Unified borderless browser kiosk (Chrome/Edge/Firefox), OS-safe lockdown, keyboard blockers
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

// ----------------------- Configuration / Globals -----------------------
var (
	logDir  = `C:\ExamGuard\logs`
	logFile = filepath.Join(logDir, "lockdown.log")
)

func ensureLogDir() { _ = os.MkdirAll(logDir, 0o755) }
func logf(format string, args ...interface{}) {
	ensureLogDir()
	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		fmt.Printf(format+"\n", args...)
		return
	}
	defer f.Close()
	ts := time.Now().Format(time.RFC3339)
	_, _ = f.WriteString(fmt.Sprintf(ts+" "+format+"\n", args...))
}

// Self / shutdown
var (
	selfPID            = os.Getpid()
	shuttingDown int32 = 0
)

// Allowed apps
var allowedApps = map[string]bool{
	"examguard.exe": true,
	"main.exe":      true,
	"chrome.exe":    true,
	"msedge.exe":    true,
	"firefox.exe":   true,
}

// Shell processes to never kill
var shellProcesses = map[string]bool{
	"explorer.exe": true, "sihost.exe": true, "startmenuexperiencehost.exe": true,
	"shellexperiencehost.exe": true, "applicationframehost.exe": true, "runtimebroker.exe": true,
	"searchhost.exe": true, "searchindexer.exe": true,
}

// ----------------------- OS-safe process killer -----------------------
type ScanResult struct {
	Success bool     `json:"success"`
	Message string   `json:"message"`
	Killed  []string `json:"killed"`
}

func isSystemAccount(user string) bool {
	u := strings.ToLower(user)
	return strings.Contains(u, "system") || strings.Contains(u, "local service") || strings.Contains(u, "network service") || strings.Contains(u, "nt authority")
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
		// fail-safe allow if we can't query
		return true
	}
	n := strings.ToLower(name)
	e := strings.ToLower(exe)
	u := strings.ToLower(user)
	if shellProcesses[n] || allowedApps[n] {
		return true
	}
	if exeInWindowsDir(e) {
		return true
	}
	if isSystemAccount(u) {
		return true
	}
	return false
}

func executeKillOnce() ScanResult {
	res := ScanResult{Success: true}
	procs, err := process.Processes()
	if err != nil {
		res.Success = false
		res.Message = err.Error()
		logf("error listing processes: %v", err)
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
		// kill children
		children, _ := p.Children()
		for _, c := range children {
			_ = c.Terminate()
			_ = c.Kill()
			logf("killed child pid=%d parent=%d", c.Pid, p.Pid)
		}
		_ = p.Terminate()
		_ = p.Kill()
		n, _ := p.Name()
		res.Killed = append(res.Killed, n)
		logf("killed %s pid=%d exe=%s user=%s", n, p.Pid, tryExe(p), tryUser(p))
	}
	res.Message = "OS-safe kill executed"
	return res
}
func tryExe(p *process.Process) string {
	if e, err := p.Exe(); err == nil {
		return e
	}
	return "<exe?>"
}
func tryUser(p *process.Process) string {
	if u, err := p.Username(); err == nil {
		return u
	}
	return "<user?>"
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
					logf("panic autoLockdown: %v", r)
				}
			}()
			_ = executeKillOnce()
		}()
	}
}

// ----------------------- Keyboard blocking (raw input + low-level hook) -----------------------
var (
	user32DLL               = syscall.NewLazyDLL("user32.dll")
	setWindowsHookEx        = user32DLL.NewProc("SetWindowsHookExW")
	callNextHookEx          = user32DLL.NewProc("CallNextHookEx")
	getMessageProc          = user32DLL.NewProc("GetMessageW")
	registerRawInputDevices = user32DLL.NewProc("RegisterRawInputDevices")
	getRawInputData         = user32DLL.NewProc("GetRawInputData")
	blockInputProc          = user32DLL.NewProc("BlockInput")
	getAsyncKeyStateProc    = user32DLL.NewProc("GetAsyncKeyState")
)

const (
	WH_KEYBOARD_LL = 13
	WM_INPUT       = 0x00FF

	VK_ESCAPE = 0x1B
	VK_F11    = 0x7A
	VK_F4     = 0x73
	VK_LWIN   = 0x5B
	VK_RWIN   = 0x5C
	VK_APPS   = 0x5D
)

type KBDLLHOOKSTRUCT struct{ VkCode uint32 }
type MSG struct {
	Hwnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      struct{ X, Y int32 }
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
		_, _, _ = blockInputProc.Call(1)
	} else {
		_, _, _ = blockInputProc.Call(0)
	}
}
func shouldBlockKey(k uint16) bool {
	return k == VK_ESCAPE || k == VK_F11 || k == VK_LWIN || k == VK_RWIN || k == VK_APPS || k == VK_F4
}

func startRawInputBlocker() {
	runtime.LockOSThread()
	rid := RAWINPUTDEVICE{UsagePage: 1, Usage: 6, Flags: 0x00000100, Target: 0}
	_, _, _ = registerRawInputDevices.Call(uintptr(unsafe.Pointer(&rid)), 1, unsafe.Sizeof(rid))
	var msg MSG
	for {
		ret, _, _ := getMessageProc.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		if int32(ret) <= 0 {
			time.Sleep(10 * time.Millisecond)
			continue
		}
		if msg.Message != WM_INPUT {
			continue
		}
		var raw RAWINPUT
		size := uint32(unsafe.Sizeof(raw))
		_, _, _ = getRawInputData.Call(msg.LParam, 0x10000003, uintptr(unsafe.Pointer(&raw)), uintptr(unsafe.Pointer(&size)), uintptr(unsafe.Sizeof(raw.Header)))
		vk := raw.Data.VKey
		sc := raw.Data.MakeCode
		// ESC scancode typically 1
		if vk == VK_ESCAPE || sc == 1 || shouldBlockKey(vk) {
			blockInput(true)
			time.Sleep(25 * time.Millisecond)
			blockInput(false)
			continue
		}
	}
}

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
	h, _, err := setWindowsHookEx.Call(uintptr(WH_KEYBOARD_LL), cb, 0, 0)
	if h == 0 {
		logf("low-level hook install failed: %v", err)
		return
	}
	var msg MSG
	for {
		getMessageProc.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
	}
}
func startKeyboardBlockers() {
	go startRawInputBlocker()
	go startLowLevelHook()
}

// ----------------------- Win32 window manipulation (borderless + hide taskbar) -----------------------
var (
	user32                = syscall.NewLazyDLL("user32.dll")
	enumWindowsProc       = user32.NewProc("EnumWindows")
	getWindowThreadProcID = user32.NewProc("GetWindowThreadProcessId")
	getWindowLongPtr      = user32.NewProc("GetWindowLongPtrW")
	setWindowLongPtr      = user32.NewProc("SetWindowLongPtrW")
	setWindowPosProc      = user32.NewProc("SetWindowPos")
	findWindowProc        = user32.NewProc("FindWindowW")
	showWindowProc        = user32.NewProc("ShowWindow")
	getSystemMetricsProc  = user32.NewProc("GetSystemMetrics")
)

const (
	// GWL_STYLE as unsigned bit pattern for -16
	GWL_STYLE      = 0xFFFFFFF0
	WS_CAPTION     = 0x00C00000
	WS_THICKFRAME  = 0x00040000
	WS_MINIMIZEBOX = 0x00020000
	WS_MAXIMIZEBOX = 0x00010000
	WS_SYSMENU     = 0x00080000

	SWP_FRAMECHANGED = 0x0020
	SWP_NOZORDER     = 0x0004
	SWP_SHOWWINDOW   = 0x0040

	SW_HIDE = 0
	SW_SHOW = 5

	HWND_TOP = 0
)

func findWindowForPid(pid uint32, timeout time.Duration) (uintptr, error) {
	var found uintptr = 0
	cb := syscall.NewCallback(func(hwnd uintptr, lparam uintptr) uintptr {
		var wp uint32
		getWindowThreadProcID.Call(hwnd, uintptr(unsafe.Pointer(&wp)))
		if wp == pid {
			// check visibility by GetWindowTextLength or similar could be added, but accept first
			found = hwnd
			return 0 // stop
		}
		return 1 // continue
	})
	end := time.Now().Add(timeout)
	for time.Now().Before(end) && found == 0 {
		_, _, _ = enumWindowsProc.Call(cb, 0)
		if found != 0 {
			return found, nil
		}
		time.Sleep(120 * time.Millisecond)
	}
	if found == 0 {
		return 0, fmt.Errorf("window for pid %d not found", pid)
	}
	return found, nil
}

func makeWindowBorderless(hwnd uintptr) error {
	// get current style
	ret, _, _ := getWindowLongPtr.Call(hwnd, uintptr(GWL_STYLE))
	style := uint32(ret) // read as unsigned bitpattern
	// remove caption, thickframe, sysmenu, minimize/maximize bits
	style &^= (WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU)
	_, _, err := setWindowLongPtr.Call(hwnd, uintptr(GWL_STYLE), uintptr(style))
	if err != nil && err.Error() != "The operation completed successfully." {
		logf("setWindowLongPtr error: %v", err)
	}
	// set window pos full screen
	sw, sh := getScreenSize()
	_, _, _ = setWindowPosProc.Call(hwnd, uintptr(HWND_TOP), 0, 0, uintptr(sw), uintptr(sh), uintptr(SWP_FRAMECHANGED|SWP_NOZORDER|SWP_SHOWWINDOW))
	return nil
}

func getScreenSize() (int, int) {
	sw, _, _ := getSystemMetricsProc.Call(0)
	sh, _, _ := getSystemMetricsProc.Call(1)
	return int(sw), int(sh)
}

func hideTaskbar(hide bool) {
	classPtr := syscall.StringToUTF16Ptr("Shell_TrayWnd")
	hwnd, _, _ := findWindowProc.Call(uintptr(unsafe.Pointer(classPtr)), 0)
	if hwnd == 0 {
		return
	}
	if hide {
		showWindowProc.Call(hwnd, uintptr(SW_HIDE))
	} else {
		showWindowProc.Call(hwnd, uintptr(SW_SHOW))
	}
}

// ----------------------- Browser detection + unified launch -----------------------
func detectBrowsers() map[string]string {
	paths := map[string]string{}
	// Chrome
	chromeCandidates := []string{
		`C:\Program Files\Google\Chrome\Application\chrome.exe`,
		`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
		filepath.Join(os.Getenv("LOCALAPPDATA"), `Google\Chrome\Application\chrome.exe`),
	}
	for _, p := range chromeCandidates {
		if p == "" {
			continue
		}
		if _, err := os.Stat(p); err == nil {
			paths["chrome"] = p
			break
		}
	}
	// Edge
	edgeCandidates := []string{
		`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
		`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
	}
	for _, p := range edgeCandidates {
		if _, err := os.Stat(p); err == nil {
			paths["edge"] = p
			break
		}
	}
	// Firefox
	firefoxCandidates := []string{
		`C:\Program Files\Mozilla Firefox\firefox.exe`,
		`C:\Program Files (x86)\Mozilla Firefox\firefox.exe`,
	}
	for _, p := range firefoxCandidates {
		if _, err := os.Stat(p); err == nil {
			paths["firefox"] = p
			break
		}
	}
	return paths
}

// launchBrowser - unified: launches chosen browser and then makes its window borderless
func launchBrowser(url string) (*exec.Cmd, string, error) {
	b := detectBrowsers()
	var exe, browser string
	if p, ok := b["chrome"]; ok {
		exe = p
		browser = "chrome"
	} else if p, ok := b["edge"]; ok {
		exe = p
		browser = "edge"
	} else if p, ok := b["firefox"]; ok {
		exe = p
		browser = "firefox"
	} else {
		return nil, "", fmt.Errorf("no supported browser installed (chrome/edge/firefox)")
	}

	var args []string
	switch browser {
	case "chrome", "edge":
		// use --app mode and app-window style
		args = []string{
			"--app=" + url,
			"--start-maximized",
			"--window-size=1920,1080",
			"--incognito",
			"--no-first-run",
			"--disable-infobars",
			"--disable-session-crashed-bubble",
			"--disable-features=FullscreenToolbar,FullscreenExitUI,ExclusiveAccessBubbleUseShorterDelay",
			"--disable-overlay-scrollbar",
			"--hide-scrollbars",
			"--overscroll-history-navigation=0",
			"--disable-features=FocusMode,HardwareMediaKeyHandling,KeyboardLockAPI",
			"--ash-disable-keyboard-shortcuts",
		}
	case "firefox":
		// firefox kiosk (>= 71) or normal app window; we'll then borderless it
		args = []string{
			"-kiosk", url,
		}
	}

	cmd := exec.Command(exe, args...)
	if err := cmd.Start(); err != nil {
		return nil, "", err
	}
	logf("launched %s pid=%d", browser, cmd.Process.Pid)

	// make borderless in background
	go func(pid int) {
		// hide taskbar
		hideTaskbar(true)
		// try find window and make borderless
		hwnd, err := findWindowForPid(uint32(pid), 8*time.Second)
		if err != nil {
			logf("findWindowForPid failed for pid %d: %v", pid, err)
			// not fatal; still keep taskbar hidden
			return
		}
		logf("found browser hwnd=0x%x", hwnd)
		err = makeWindowBorderless(hwnd)
		if err != nil {
			logf("makeWindowBorderless failed: %v", err)
		} else {
			logf("window borderless applied")
		}
	}(cmd.Process.Pid)

	return cmd, browser, nil
}

// ----------------------- HTTP endpoints -----------------------
func handleCheck(w http.ResponseWriter, r *http.Request) {
	_ = json.NewEncoder(w).Encode(map[string]any{"active": true, "time": time.Now().Format(time.RFC3339)})
}

func handleScanAndKill(w http.ResponseWriter, r *http.Request) {
	res := executeKillOnce()
	_ = json.NewEncoder(w).Encode(res)
}

func handleStartExam(w http.ResponseWriter, r *http.Request) {
	if atomic.LoadInt32(&shuttingDown) == 1 {
		http.Error(w, "shutting down", http.StatusServiceUnavailable)
		return
	}
	q := r.URL.Query()
	url := q.Get("url")
	if url == "" {
		http.Error(w, "missing url", http.StatusBadRequest)
		return
	}
	// quick safe cleanup
	_ = executeKillOnce()
	cmd, browser, err := launchBrowser(url)
	if err != nil {
		logf("launchBrowser error: %v", err)
		http.Error(w, "failed to launch browser: "+err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"launched": true, "browser": browser, "pid": cmd.Process.Pid})
}

func handleExit(w http.ResponseWriter, r *http.Request) {
	_ = json.NewEncoder(w).Encode(map[string]any{"closing": true})
	go func() {
		atomic.StoreInt32(&shuttingDown, 1)
		// restore environment
		hideTaskbar(false)
		time.Sleep(400 * time.Millisecond)
		logf("shutting down by request")
		os.Exit(0)
	}()
}

// ----------------------- VM detection -----------------------
func detectVM() bool {
	out, err := exec.Command("wmic", "computersystem", "get", "model").Output()
	if err != nil {
		return false
	}
	s := strings.ToLower(string(out))
	if strings.Contains(s, "virtual") || strings.Contains(s, "vmware") || strings.Contains(s, "virtualbox") || strings.Contains(s, "qemu") || strings.Contains(s, "hyper-v") {
		return true
	}
	return false
}

// ----------------------- main -----------------------
func main() {
	ensureLogDir()
	logf("ExamGuard starting. selfPID=%d", selfPID)
	// start keyboard blockers
	go startKeyboardBlockers()
	// start auto lockdown
	go autoLockdown(5 * time.Second)

	mux := http.NewServeMux()
	mux.HandleFunc("/check", handleCheck)
	mux.HandleFunc("/scan-and-kill", handleScanAndKill)
	mux.HandleFunc("/start-exam", handleStartExam)
	mux.HandleFunc("/exit", handleExit)
	mux.HandleFunc("/env", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"vm": detectVM(), "time": time.Now().Format(time.RFC3339)})
	})

	handler := cors.New(cors.Options{AllowedOrigins: []string{"*"}, AllowedMethods: []string{"GET", "POST"}}).Handler(mux)
	addr := "localhost:12345"
	logf("listening on %s", addr)
	fmt.Println("ExamGuard running on", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		logf("ListenAndServe error: %v", err)
		fmt.Println("Listen error:", err)
	}
}
