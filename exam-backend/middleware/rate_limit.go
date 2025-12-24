package middleware

import (
	"net/http"
	"strconv"
	"time"

	"exam-backend/database"

	"github.com/gin-gonic/gin"
)

func RateLimit(key string, limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {

		uid := c.GetString("userID")
		if uid == "" {
			uid = c.ClientIP() // fallback
		}

		redisKey := "rl:" + key + ":" + uid

		count, err := database.RedisIncr(c.Request.Context(), redisKey)
		if err != nil {
			// Redis failure = FAIL CLOSED for exams
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "rate_limit_unavailable"})
			c.Abort()
			return
		}

		if count == 1 {
			_ = database.RedisExpire(c.Request.Context(), redisKey, window)
		}

		if count > int64(limit) {
			retryAfter := strconv.Itoa(int(window.Seconds()))
			c.Header("Retry-After", retryAfter)
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "rate_limited",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
