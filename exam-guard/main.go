package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/rs/cors"
	"github.com/shirou/gopsutil/v3/process"
)

// --- THE WHITELIST ---
// These apps are ALLOWED to run. Everything else will be killed.
var allowedApps = map[string]bool{
	// 1. The Exam Environment (Names might vary, but PID check covers the active one)
	"examguard.exe": true, "main.exe": true, "cmd.exe": true, "powershell.exe": true,

	// 2. Browsers
	"chrome.exe": true, "msedge.exe": true, "firefox.exe": true, "brave.exe": true,
	"opera.exe": true,

	// 3. Windows Core System
	"system": true, "system idle process": true, "registry": true,
	"smss.exe": true, "csrss.exe": true, "wininit.exe": true,
	"services.exe": true, "lsass.exe": true, "svchost.exe": true,
	"fontdrvhost.exe": true, "winlogon.exe": true, "dwm.exe": true,
	"taskhostw.exe": true, "spoolsv.exe": true, "explorer.exe": true,
	"sihost.exe": true, "ctfmon.exe": true, "smartscreen.exe": true,
	"runtimebroker.exe": true, "searchindexer.exe": true, "searchui.exe": true,
	"conhost.exe": true, "dllhost.exe": true, "taskmgr.exe": true,

	// 4. Hardware Drivers
	"audiodg.exe": true, "nvcontainer.exe": true, "nvidia share.exe": true,
	"realtek.exe": true, "rtkngui64.exe": true,
}

type ScanResult struct {
	Success      bool     `json:"success"`
	Message      string   `json:"message"`
	Killed       []string `json:"killed"`
	FailedToKill []string `json:"failed_to_kill"`
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/scan-and-kill", handleStrictClean)

	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST"},
	})

	fmt.Println("============================================")
	fmt.Println("   🛡️  EXAM GUARD: STRICT LOCKDOWN MODE")
	fmt.Println("============================================")
	fmt.Println("   [!] Whitelist Strategy Active")
	fmt.Println("   [!] PID Protection Active (Won't kill itself)")
	fmt.Println("   [!] Listening on port 12345...")

	http.ListenAndServe("localhost:12345", c.Handler(mux))
}

func handleStrictClean(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	result := executeClean()
	json.NewEncoder(w).Encode(result)
}

func executeClean() ScanResult {
	procs, err := process.Processes()
	result := ScanResult{Success: true}

	if err != nil {
		result.Message = "Error reading processes"
		return result
	}

	// 1. GET MY OWN PROCESS ID (PID)
	myPid := int32(os.Getpid())

	for _, p := range procs {
		// 2. CRITICAL SAFETY CHECK: Is this process ME?
		if p.Pid == myPid {
			continue // Skip myself immediately
		}

		name, _ := p.Name()
		nameLower := strings.ToLower(name)

		// 3. Check Whitelist
		if allowedApps[nameLower] {
			continue // It's safe, skip it
		}

		// Extra Safety for Go execution wrapper
		if strings.Contains(nameLower, "go.exe") {
			continue
		}

		// 4. Not allowed? KILL IT.
		fmt.Printf("⚔️ Terminating: %s (PID: %d)\n", name, p.Pid)
		if err := p.Kill(); err != nil {
			// Some system services cannot be killed even if we try
			result.FailedToKill = append(result.FailedToKill, name)
		} else {
			result.Killed = append(result.Killed, name)
		}
	}

	if len(result.Killed) > 0 {
		result.Message = fmt.Sprintf("Environment Locked. Closed %d background applications.", len(result.Killed))
	} else {
		result.Message = "System Clean."
	}

	return result
}
