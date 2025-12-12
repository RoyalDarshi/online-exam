package controllers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"exam-backend/database"
	"exam-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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
	existing, _ := redisGet(wsKey)
	if existing != "" {
		c.JSON(http.StatusConflict, gin.H{"error": "another_session_active"})
		return
	}

	_ = redisSet(wsKey, token, 2*time.Hour)

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		redisDel(wsKey)
		return
	}
	defer func() {
		conn.Close()
		redisDel(wsKey)
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
			// This triggers if the ReadDeadline expires (30s)
			terminateAttempt(aid.String(), "connection_error")
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
						_ = database.DB.Model(&attempt).Where("id = ?", attempt.ID).UpdateColumn("tab_switches", gorm.Expr("tab_switches + ?", 1)).Error
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
			terminateAttempt(aid.String(), "heartbeat_timeout")
			return
		}
	}
}

// terminateAttempt marks the attempt terminated in DB and removes redis keys.
func terminateAttempt(attemptID string, reason string) {
	database.DB.Model(&models.ExamAttempt{}).Where("id = ?", attemptID).
		Updates(map[string]interface{}{
			"is_terminated":      true,
			"termination_reason": reason,
			"submitted_at":       time.Now(),
		})
	_ = redisDel("ws_active:" + attemptID)
}
