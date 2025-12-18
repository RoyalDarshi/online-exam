package controllers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"exam-backend/database"
	"exam-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// minimal Redis helpers (use database.Redis* helpers)
func redisGet(key string) (string, error) {
	return database.RedisGet(context.Background(), key)
}
func redisSet(key string, val string, ttl time.Duration) error {
	return database.RedisSet(context.Background(), key, val, ttl)
}
func redisDel(key string) error {
	return database.RedisDel(context.Background(), key)
}

// ExamWebSocket handles a websocket for an exam attempt.
// query params: attempt_id, token, fingerprint (optional)
// ExamWebSocket handles a websocket for an exam attempt.
// backend/controllers/websocket_exam.go

// backend/controllers/websocket_exam.go

func handleDisconnectWithGracePeriod(attemptID string, waitTime time.Duration) {
	// 1. Wait for grace period
	time.Sleep(waitTime)

	// 2. Check for reconnection
	val, _ := redisGet("ws_active:" + attemptID)
	if val != "" {
		return // User returned!
	}

	// 3. Check DB status
	var attempt models.ExamAttempt
	// Preload Exam questions so we can calculate the score
	if err := database.DB.Preload("Exam.Questions").First(&attempt, "id = ?", attemptID).Error; err != nil {
		return
	}

	if attempt.SubmittedAt != nil || attempt.IsTerminated {
		return // Already done
	}

	// 4. AUTO-SUBMIT & SCORE
	// We calculate the score now so the record is complete.
	score, total := evaluateScore(attempt.Exam, attempt.Answers)

	now := time.Now()

	database.DB.Model(&attempt).Updates(map[string]interface{}{
		"submitted_at": now,
		"score":        score,
		"total_points": total,
		"passed":       score >= attempt.Exam.PassingScore,
		// We leave termination_reason empty because this is a valid auto-submit
	})
}

func ExamWebSocket(c *gin.Context) {
	attemptID := c.Query("attempt_id")
	token := c.Query("token")
	fingerprint := c.Query("fingerprint")

	if attemptID == "" || token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_params"})
		return
	}

	// validate attempt id
	aid, err := uuid.Parse(attemptID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_attempt_id"})
		return
	}

	var attempt models.ExamAttempt
	if err := database.DB.First(&attempt, "id = ?", aid).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "attempt_not_found"})
		return
	}

	// token must match stored exam_token
	if attempt.ExamToken == "" || attempt.ExamToken != token {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_token"})
		return
	}

	// enforce single active websocket session
	wsKey := "ws_active:" + attemptID

	// Set the key to mark user as ONLINE
	_ = redisSet(wsKey, token, 2*time.Hour)

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		redisDel(wsKey)
		return
	}

	// CLEANUP: When connection closes (Internet disconnects)
	defer func() {
		conn.Close()

		// 1. Mark user as OFFLINE immediately in Redis
		redisDel(wsKey)

		// 2. Spawn the "Grim Reaper" (Background Timer)
		// This runs independently even after the request finishes
		go handleDisconnectWithGracePeriod(attemptID, 5*time.Minute)
	}()

	heartbeatInterval := 15 * time.Second
	heartbeatTimeout := 2 * heartbeatInterval
	lastBeat := time.Now()

	if fingerprint != "" && attempt.DeviceFingerprint == "" {
		_ = database.DB.Model(&attempt).Update("device_fingerprint", fingerprint).Error
	}

	conn.SetReadLimit(512)
	// Initial deadline
	conn.SetReadDeadline(time.Now().Add(heartbeatTimeout))

	// This PongHandler is only for control frames (which browsers don't send manually),
	// so we mainly rely on the text "ping" check below.
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(heartbeatTimeout))
		lastBeat = time.Now()
		return nil
	})

	for {
		mt, message, err := conn.ReadMessage()
		if err != nil {
			// CONNECTION LOST: Break the loop.
			// Do NOT terminateAttempt() here.
			// The defer func() above will handle the grace period.
			return
		}
		if mt == websocket.TextMessage {
			msg := string(message)

			// FIX IS HERE: Handle text-based pings from React
			if msg == "ping" || msg == "heartbeat" {
				_ = conn.WriteMessage(websocket.TextMessage, []byte("pong"))

				// CRITICAL FIX: Extend the deadline!
				conn.SetReadDeadline(time.Now().Add(heartbeatTimeout))
				lastBeat = time.Now()

				continue
			}

			// Handle JSON commands
			var cmd map[string]interface{}
			if err := json.Unmarshal(message, &cmd); err == nil {
				if cmdType, ok := cmd["type"].(string); ok {
					switch cmdType {
					case "tab-switch":
						_ = database.DB.Model(&attempt).Where("id = ? AND submitted_at IS NULL", attempt.ID).UpdateColumn("tab_switches", gorm.Expr("tab_switches + ?", 1)).Error
						_ = database.DB.First(&attempt, "id = ?", attempt.ID).Error
						if attempt.TabSwitches > 3 {
							terminateAttempt(aid.String(), "tab_switches_exceeded")
							_ = conn.WriteMessage(websocket.TextMessage, []byte("terminated:tab_switches"))
							return
						}
					}
				}
			}
		}

		// Fallback check
		if time.Since(lastBeat) > heartbeatTimeout {
			// CONNECTION TIMEOUT: Break loop, let defer handle it
			return
		}
	}
}

// terminateAttempt marks the attempt terminated in DB and removes redis keys.
func terminateAttempt(attemptID string, reason string) {
	// CRITICAL FIX: Add "AND submitted_at IS NULL"
	// We only want to terminate if the student hasn't already successfully submitted.
	// This prevents the "connection_error" from triggering when the user leaves the page after finishing.

	result := database.DB.Model(&models.ExamAttempt{}).
		Where("id = ? AND submitted_at IS NULL", attemptID).
		Updates(map[string]interface{}{
			"is_terminated":      true,
			"termination_reason": reason,
			"submitted_at":       time.Now(),
		})

	// Only delete Redis key if we actually terminated (or just always delete it to be safe)
	_ = redisDel("ws_active:" + attemptID)

	// Optional: Log if we prevented a false termination
	if result.RowsAffected == 0 {
		// fmt.Printf("Prevented false termination for attempt %s (reason: %s)\n", attemptID, reason)
	}
}
