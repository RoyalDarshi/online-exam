// launcher.go
package main

import (
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"time"
)

func main() {
	// path to ExamGuard.exe (adjust if you put elsewhere)
	procPath := "../examguard/ExamGuard.exe"

	// exam URL to open in kiosk
	examURL := "https://localhost:5173" // <--- REPLACE with real URL

	// optional: browser preference: "chrome" or "edge"
	browserPref := "chrome"

	// Start ExamGuard (detached)
	cmd := exec.Command(procPath)
	if err := cmd.Start(); err != nil {
		fmt.Println("failed to start ExamGuard.exe:", err)
		return
	}
	fmt.Println("ExamGuard started, pid:", cmd.Process.Pid)

	// wait a bit for server to come up
	time.Sleep(1500 * time.Millisecond)

	// call start-exam endpoint
	startURL := "" + urlEncode(examURL) + "&browser=" + browserPref
	resp, err := http.Post(startURL, "application/json", nil)
	if err != nil {
		fmt.Println("failed to call start-exam:", err)
		return
	}
	defer resp.Body.Close()
	fmt.Println("start-exam called, status:", resp.Status)
	// launcher can exit now
}
func urlEncode(s string) string {
	return (&urlValue{v: s}).Encode()
}

// small helper to avoid importing net/url for single encode
type urlValue struct{ v string }

func (u *urlValue) Encode() string {
	// minimal encode for : / ?
	s := u.v
	s = strings.ReplaceAll(s, " ", "%20")
	s = strings.ReplaceAll(s, ":", "%3A")
	s = strings.ReplaceAll(s, "/", "%2F")
	s = strings.ReplaceAll(s, "?", "%3F")
	s = strings.ReplaceAll(s, "&", "%26")
	s = strings.ReplaceAll(s, "=", "%3D")
	return s
}
