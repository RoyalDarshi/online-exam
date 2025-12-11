// main.go  (OS-SAFE Mode)
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

var (
	// Logging paths
	logDir  = `C:\ExamGuard\logs`
	logFile = filepath.Join(logDir, "lockdown.log")

	// Shutdown flag for graceful stop
	shuttingDown int32 = 0

	// Our self PID - always allowed
	selfPID = os.Getpid()
)

// ------------------ Allow lists (supportive but not primary) ------------------
// These are kept for quick checks but we rely primarily on OS detection logic.
var allowedApps = map[string]bool{
	"examguard.exe": true,
	"main.exe":      true,
	"chrome.exe":    true,
	"msedge.exe":    true,
}

// Shell/UI that we want to keep (explorer kept by default in Mode 1)
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
	"aggregatorhost.exe":          true,
	"widgetboard.exe":             true,
	"widgetservice.exe":           true,
	"useroobebroker.exe":          true,
	"monotificationux.exe":        true,
	"crossdeviceresume.exe":       true,
	"phoneexperiencehost.exe":     true,
	"systemsettings.exe":          true,
	"smartscreen.exe":             true,
}

// ------------------ Windows API / keyboard hook (best-effort) ------------------
var (
	user32              = syscall.NewLazyDLL("user32.dll")
	setWindowsHookEx    = user32.NewProc("SetWindowsHookExW")
	callNextHookEx      = user32.NewProc("CallNextHookEx")
	getMessage          = user32.NewProc("GetMessageW")
	getAsyncKeyStatePtr = user32.NewProc("GetAsyncKeyState")
)

const (
	WH_KEYBOARD_LL = 13

	WM_KEYDOWN    = 0x0100
	WM_SYSKEYDOWN = 0x0104

	VK_ESCAPE = 0x1B
	VK_F11    = 0x7A
	VK_F4     = 0x73
	VK_TAB    = 0x09

	VK_LWIN = 0x5B
	VK_RWIN = 0x5C
	VK_APPS = 0x5D

	VK_MENU    = 0x12 // Alt
	VK_CONTROL = 0x11 // Ctrl
)

type KBDLLHOOKSTRUCT struct {
	VkCode    uint32
	ScanCode  uint32
	Flags     uint32
	Time      uint32
	ExtraInfo uintptr
}

type POINT struct{ X, Y int32 }
type MSG struct {
	Hwnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      POINT
}

// getAsyncKeyState returns true if key is down (best-effort)
func getAsyncKeyState(vk int) bool {
	ret, _, _ := getAsyncKeyStatePtr.Call(uintptr(vk))
	return (int32(ret) & 0x8000) != 0
}

func keyboardHook(nCode int, wParam uintptr, lParam uintptr) uintptr {
	if nCode == 0 && (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN) {
		kb := (*KBDLLHOOKSTRUCT)(unsafe.Pointer(lParam))
		vk := int(kb.VkCode)

		altDown := getAsyncKeyState(VK_MENU)
		winDown := getAsyncKeyState(VK_LWIN) || getAsyncKeyState(VK_RWIN)

		// Block common disruptive keys/combinations (best-effort from user-mode)
		switch vk {
		case VK_ESCAPE:
			return 1
		case VK_F11:
			return 1
		case VK_APPS:
			return 1
		case VK_LWIN, VK_RWIN:
			return 1
		case VK_F4:
			// block Alt+F4 and block F4 generally as a safety measure
			if altDown || true {
				return 1
			}
		case VK_TAB:
			// block Alt+Tab and Win+Tab by blocking Tab when Alt or Win is down
			if altDown || winDown {
				return 1
			}
		}
	}
	ret, _, _ := callNextHookEx.Call(0, uintptr(nCode), wParam, lParam)
	return ret
}

func startKeyboardBlocker() {
	runtime.LockOSThread()
	cb := syscall.NewCallback(keyboardHook)
	h, _, err := setWindowsHookEx.Call(
		uintptr(WH_KEYBOARD_LL),
		cb,
		0,
		0,
	)
	if h == 0 {
		log("keyboard hook failed: %v", err)
		return
	}
	var msg MSG
	for {
		ret, _, _ := getMessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
		if int32(ret) <= 0 {
			break
		}
	}
}

// ------------------ Logging ------------------

func ensureLogDir() {
	_ = os.MkdirAll(logDir, 0o755)
}

func log(format string, args ...interface{}) {
	ensureLogDir()
	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		// fallback to stdout
		fmt.Printf(format+"\n", args...)
		return
	}
	defer f.Close()
	ts := time.Now().Format(time.RFC3339)
	line := fmt.Sprintf(ts+" "+format+"\n", args...)
	_, _ = f.WriteString(line)
}

// ------------------ Utilities for OS-safe checks ------------------

// isSystemAccount returns true for common Windows service accounts
func isSystemAccount(user string) bool {
	u := strings.ToLower(user)
	return strings.Contains(u, "system") || strings.Contains(u, "local service") || strings.Contains(u, "network service") || strings.Contains(u, "nt authority")
}

// exeInWindowsDir returns true if the exe path starts with C:\Windows (case-insensitive)
func exeInWindowsDir(exePath string) bool {
	if exePath == "" {
		return false
	}
	p := strings.ToLower(exePath)
	// normalize paths
	p = filepath.Clean(p)
	return strings.HasPrefix(p, strings.ToLower(`c:\windows`))
}

// isAllowedProcess performs OS-safe checks to decide whether a process is safe to leave running.
func isAllowedProcess(p *process.Process) bool {
	// Always allow our own PID (ExamGuard) to avoid self-kill
	if int(p.Pid) == selfPID {
		return true
	}

	// try to get name & exe & username; if any call errors, be conservative (allow)
	name, errName := p.Name()
	exePath, errExe := p.Exe()
	userName, errUser := p.Username()

	// if any of the calls failed unexpectedly, allow that process (fail-safe)
	if errName != nil || errExe != nil || errUser != nil {
		// some short-lived system procs or protected procs may error; allow them
		return true
	}

	nameLower := strings.ToLower(name)
	exeLower := strings.ToLower(exePath)
	userLower := strings.ToLower(userName)

	// Always allow known shell processes (keeps the desktop stable)
	if shellProcesses[nameLower] {
		return true
	}

	// If this process runs from C:\Windows (or System32), never kill it
	if exeInWindowsDir(exeLower) {
		return true
	}

	// If process is running under a system/service account, allow it
	if isSystemAccount(userLower) {
		return true
	}

	// Allow processes that are explicitly allowed (browser & examguard)
	if allowedApps[nameLower] {
		return true
	}

	// As an additional safe rule: allow processes that are children of services (status == "service")
	// gopsutil does not directly report session id reliably cross-systems, but username check above handles services.

	// By default: this is a user-level process (candidate for termination)
	return false
}

// ------------------ Kill logic (OS-SAFE) ------------------

// executeKillOnce scans processes and terminates unsafe user-level processes.
func executeKillOnce() ScanResult {
	procs, err := process.Processes()
	res := ScanResult{Success: true}
	if err != nil {
		res.Success = false
		res.Message = "error listing processes: " + err.Error()
		log("ERROR: %s", res.Message)
		return res
	}

	for _, p := range procs {
		// stop if we are shutting down
		if atomic.LoadInt32(&shuttingDown) == 1 {
			break
		}

		// skip ourselves
		if int(p.Pid) == selfPID {
			continue
		}

		// safe-check
		allowed := isAllowedProcess(p)
		if allowed {
			continue
		}

		// Now we will terminate this process (best-effort)
		// kill children first (best-effort)
		children, _ := p.Children()
		for _, c := range children {
			_ = c.Terminate()
			_ = c.Kill()
			log("killed child %s (parent %s pid=%d)", childDesc(c), childDesc(p))
		}

		// terminate parent
		_ = p.Terminate()
		_ = p.Kill()

		// record name
		n, _ := p.Name()
		res.Killed = append(res.Killed, n)
		log("killed %s (pid=%d exe=%s user=%s)", n, p.Pid, tryExe(p), tryUser(p))
	}

	res.Message = "OS-safe kill executed"
	return res
}

func childDesc(p *process.Process) string {
	n, _ := p.Name()
	return fmt.Sprintf("%s[%d]", n, p.Pid)
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

// autoLockdown runs executeKillOnce every interval until shutdown
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
			_ = executeKillOnce()
		}()
	}
}

// ------------------ Kiosk launcher helpers ------------------

var commonBrowserPaths = []string{
	`C:\Program Files\Google\Chrome\Application\chrome.exe`,
	`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
	`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
	`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
}

func findBrowserPath(prefer string) string {
	if strings.Contains(strings.ToLower(prefer), "edge") {
		for _, p := range commonBrowserPaths {
			if strings.Contains(strings.ToLower(p), "msedge") {
				if _, err := os.Stat(p); err == nil {
					return p
				}
			}
		}
	} else {
		for _, p := range commonBrowserPaths {
			if strings.Contains(strings.ToLower(p), "chrome") {
				if _, err := os.Stat(p); err == nil {
					return p
				}
			}
		}
	}
	for _, p := range commonBrowserPaths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return prefer
}

func launchKiosk(prefer, url string) (*exec.Cmd, error) {
	path := findBrowserPath(prefer)
	args := []string{
		"--kiosk",
		"--no-first-run",
		"--disable-extensions",
		"--disable-popup-blocking",
		"--incognito",
		"--no-default-browser-check",
		"--disable-background-networking",
		"--disable-sync",
		"--disable-translate",
		url,
	}
	cmd := exec.Command(path, args...)
	if err := cmd.Start(); err != nil {
		// fallback to command name
		if strings.Contains(strings.ToLower(prefer), "edge") {
			cmd = exec.Command("msedge", args...)
		} else {
			cmd = exec.Command("chrome", args...)
		}
		if err2 := cmd.Start(); err2 != nil {
			log("failed to start kiosk: %v / %v", err, err2)
			return nil, err2
		}
	}
	log("launched kiosk %s pid=%d", path, cmd.Process.Pid)
	return cmd, nil
}

// ------------------ HTTP handlers ------------------

func handleCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"active": true,
		"time":   time.Now().Format(time.RFC3339),
	})
}

func handleEnv(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"vm_detected": detectVM(),
		"time":        time.Now().Format(time.RFC3339),
	})
}

func handleScanAndKill(w http.ResponseWriter, r *http.Request) {
	res := executeKillOnce()
	w.Header().Set("Content-Type", "application/json")
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
		http.Error(w, "missing url param", http.StatusBadRequest)
		return
	}
	browser := q.Get("browser")
	if browser == "" {
		browser = "chrome"
	}
	// mark allowed for the session
	if strings.Contains(strings.ToLower(browser), "edge") {
		allowedApps["msedge.exe"] = true
	} else {
		allowedApps["chrome.exe"] = true
	}

	// quick cleanup before launching
	_ = executeKillOnce()
	cmd, err := launchKiosk(browser, url)
	if err != nil {
		http.Error(w, "failed to launch kiosk: "+err.Error(), http.StatusInternalServerError)
		return
	}
	pid := 0
	if cmd != nil && cmd.Process != nil {
		pid = cmd.Process.Pid
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"launched": true, "pid": pid})
}

func handleExit(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"closing": true})
	go func() {
		atomic.StoreInt32(&shuttingDown, 1)
		time.Sleep(700 * time.Millisecond)
		log("shutting down by request")
		os.Exit(0)
	}()
}

// ------------------ VM detection ------------------

func detectVM() bool {
	out, err := exec.Command("wmic", "computersystem", "get", "model").Output()
	if err != nil {
		return false
	}
	s := strings.ToLower(string(out))
	if strings.Contains(s, "virtual") ||
		strings.Contains(s, "vmware") ||
		strings.Contains(s, "qemu") ||
		strings.Contains(s, "hyper-v") ||
		strings.Contains(s, "virtualbox") {
		return true
	}
	return false
}

// ------------------ main ------------------

func main() {
	ensureLogDir()
	log("ExamGuard starting (OS-SAFE Mode). selfPID=%d", selfPID)

	// keyboard hook (best effort)
	go startKeyboardBlocker()

	// start auto lockdown every 5 seconds
	go autoLockdown(5 * time.Second)

	// HTTP endpoints
	mux := http.NewServeMux()
	mux.HandleFunc("/check", handleCheck)
	mux.HandleFunc("/env", handleEnv)
	mux.HandleFunc("/scan-and-kill", handleScanAndKill)
	mux.HandleFunc("/start-exam", handleStartExam)
	mux.HandleFunc("/exit", handleExit)

	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST"},
	})

	addr := "localhost:12345"
	log("listening on %s", addr)
	fmt.Println("ExamGuard (OS-SAFE) listening on", addr)
	if err := http.ListenAndServe(addr, c.Handler(mux)); err != nil {
		log("ListenAndServe error: %v", err)
		fmt.Println("Listen error:", err)
	}
}
