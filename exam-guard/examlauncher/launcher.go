package main

import (
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"time"
)

func main() {
	// IMPORTANT — USE FULL ABSOLUTE PATH
	procPath := "C:\\Curat-React\\online-exam\\exam-guard\\examguard\\ExamGuard.exe"

	examURL := "http://localhost:5173"
	browserPref := "chrome"

	fmt.Println("Starting ExamGuard from:", procPath)

	cmd := exec.Command(procPath)
	err := cmd.Start()
	if err != nil {
		fmt.Println("ERROR: Cannot start ExamGuard.exe")
		fmt.Println("Go error:", err)
		time.Sleep(5 * time.Second)
		return
	}
	fmt.Println("ExamGuard started PID:", cmd.Process.Pid)

	// wait for server
	if !waitForServer() {
		fmt.Println("ERROR: ExamGuard server never responded!")
		time.Sleep(5 * time.Second)
		return
	}

	// Start browser
	url := fmt.Sprintf(
		"http://localhost:12345/start-exam?url=%s&browser=%s",
		urlEncode(examURL),
		browserPref,
	)

	fmt.Println("Calling:", url)

	resp, err := http.Post(url, "application/json", nil)
	if err != nil {
		fmt.Println("ERROR calling /start-exam:", err)
		time.Sleep(5 * time.Second)
		return
	}

	fmt.Println("Browser launch request sent. Status:", resp.Status)
	time.Sleep(5 * time.Second)
}

func waitForServer() bool {
	for i := 0; i < 20; i++ {
		_, err := http.Get("http://localhost:12345/check")
		if err == nil {
			return true
		}
		time.Sleep(500 * time.Millisecond)
	}
	return false
}

func urlEncode(s string) string {
	r := strings.ReplaceAll
	s = r(s, " ", "%20")
	s = r(s, ":", "%3A")
	s = r(s, "/", "%2F")
	s = r(s, "?", "%3F")
	s = r(s, "&", "%26")
	s = r(s, "=", "%3D")
	return s
}
