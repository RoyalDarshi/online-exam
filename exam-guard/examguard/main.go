// main.go
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

var logDir = `C:\ExamGuard\logs`
var logFile = filepath.Join(logDir, "lockdown.log")
var shuttingDown int32 = 0

// ------------------ Allow lists (semi-strict, explorer allowed) ------------------
var systemProcesses = map[string]bool{
	"system":              true,
	"system idle process": true,
	"registry":            true,
	"smss.exe":            true,
	"csrss.exe":           true,
	"wininit.exe":         true,
	"services.exe":        true,
	"lsass.exe":           true,
	"svchost.exe":         true,
	"winlogon.exe":        true,
	"fontdrvhost.exe":     true,
	"dwm.exe":             true,
	"memory compression":  true,
	"secure system":       true,
}

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

var allowedApps = map[string]bool{
	"examguard.exe": true,
	"main.exe":      true,
	"chrome.exe":    true,
	"msedge.exe":    true,
}

// ------------------ Windows API / keyboard hook (stricter) ------------------
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

// getAsyncKeyState returns high bit set if key pressed
func getAsyncKeyState(vk int) bool {
	ret, _, _ := getAsyncKeyStatePtr.Call(uintptr(vk))
	// high-order bit = 0x8000 indicates down
	return (int32(ret) & 0x8000) != 0
}

func keyboardHook(nCode int, wParam uintptr, lParam uintptr) uintptr {
	if nCode == 0 && (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN) {
		kb := (*KBDLLHOOKSTRUCT)(unsafe.Pointer(lParam))
		vk := int(kb.VkCode)

		altDown := getAsyncKeyState(VK_MENU)
		ctrlDown := getAsyncKeyState(VK_CONTROL)
		winDown := getAsyncKeyState(VK_LWIN) || getAsyncKeyState(VK_RWIN)

		// Block a set of keys/combinations (best-effort from user-mode)
		// - Esc
		// - F11 (fullscreen)
		// - Alt+Tab
		// - Ctrl+Esc
		// - Alt+F4
		// - Win keys and Win+Tab/Win+R/Win+D etc.
		// - Apps key

		switch vk {
		case VK_ESCAPE:
			// block always (so menus / escapes don't exit)
			return 1
		case VK_F11:
			return 1
		case VK_APPS:
			return 1
		case VK_LWIN, VK_RWIN:
			return 1
		case VK_F4:
			// block Alt+F4 (if Alt down) and block F4 generally for safety
			if altDown || true {
				return 1
			}
		case VK_TAB:
			// block Alt+Tab and Win+Tab: if Alt or Win is down then block Tab
			if altDown || winDown {
				return 1
			}
		}

		// Block Ctrl+Esc (Start menu)
		if vk == VK_ESCAPE && ctrlDown {
			return 1
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

func log(msg string, args ...interface{}) {
	ensureLogDir()
	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		// fallback to stdout
		fmt.Printf(msg+"\n", args...)
		return
	}
	defer f.Close()
	ts := time.Now().Format(time.RFC3339)
	line := fmt.Sprintf(ts+" "+msg+"\n", args...)
	_, _ = f.WriteString(line)
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

// ------------------ Kill logic ------------------

func isAllowed(name string) bool {
	l := strings.ToLower(name)
	if systemProcesses[l] || shellProcesses[l] || allowedApps[l] {
		return true
	}
	return false
}

func executeKillOnce() ScanResult {
	procs, err := process.Processes()
	res := ScanResult{Success: true}
	if err != nil {
		res.Success = false
		res.Message = "error reading processes: " + err.Error()
		log("error reading processes: %v", err)
		return res
	}
	myPid := int32(os.Getpid())

	for _, p := range procs {
		if atomic.LoadInt32(&shuttingDown) == 1 {
			break
		}
		if p.Pid == myPid {
			continue
		}
		name, _ := p.Name()
		if name == "" {
			continue
		}
		lower := strings.ToLower(name)
		if isAllowed(lower) {
			continue
		}

		// Kill children first
		children, _ := p.Children()
		for _, c := range children {
			_ = c.Terminate()
			_ = c.Kill()
			log("killed child %s (parent %s)", c.String(), name)
		}

		_ = p.Terminate()
		_ = p.Kill()
		res.Killed = append(res.Killed, name)
		log("killed %s", name)
	}

	res.Message = "semi-strict kill executed"
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
		executeKillOnce()
	}
}

// ------------------ Kiosk launcher ------------------

var commonBrowserPaths = []string{
	`C:\Program Files\Google\Chrome\Application\chrome.exe`,
	`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
	`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
	`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
}

func findBrowserPath(prefer string) string {
	if prefer == "edge" {
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
	return prefer // rely on PATH fallback
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
		if prefer == "edge" {
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
		http.Error(w, "missing url", http.StatusBadRequest)
		return
	}
	browser := q.Get("browser")
	if browser == "" {
		browser = "chrome"
	}
	// mark allowed
	if strings.Contains(strings.ToLower(browser), "edge") {
		allowedApps["msedge.exe"] = true
	} else {
		allowedApps["chrome.exe"] = true
	}
	// run quick cleanup
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
		// small grace for response to be delivered
		time.Sleep(700 * time.Millisecond)
		log("shutting down by request")
		os.Exit(0)
	}()
}

// ------------------ main ------------------

func main() {
	ensureLogDir()
	log("ExamGuard starting (semi-strict).")
	// start keyboard hook
	go startKeyboardBlocker()
	// start auto lockdown every 5s
	go autoLockdown(5 * time.Second)

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
	fmt.Println("ExamGuard running. HTTP on", addr)
	if err := http.ListenAndServe(addr, c.Handler(mux)); err != nil {
		log("ListenAndServe error: %v", err)
		fmt.Println("Listen error:", err)
	}
}
