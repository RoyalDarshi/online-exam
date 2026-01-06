package workers

import (
	"context"
	"strconv"
	"strings"
	"time"

	"exam-backend/database"
	"exam-backend/models"
)

func StartAutosaveFlusher() {
	ticker := time.NewTicker(5 * time.Second)

	go func() {
		for range ticker.C {
			flushDirtyAttempts()
		}
	}()
}

func flushDirtyAttempts() {
	ctx := context.Background()

	keys, err := database.RedisKeys(ctx, "attempt:dirty:*")
	if err != nil {
		return
	}

	for _, dirtyKey := range keys {
		attemptID := strings.TrimPrefix(dirtyKey, "attempt:dirty:")

		answersKey := "attempt:answers:" + attemptID
		tabsKey := "attempt:tabs:" + attemptID

		var answers map[string]string
		_ = database.RedisGetJSON(ctx, answersKey, &answers)

		tabsStr, _ := database.RedisGet(ctx, tabsKey)
		tabs, _ := strconv.Atoi(tabsStr)

		// Flush to DB
		database.DB.Model(&models.ExamAttempt{}).
			Where("id = ? AND submitted_at IS NULL", attemptID).
			Updates(map[string]interface{}{
				"answers":      answers,
				"tab_switches": tabs,
			})

		// Clear dirty flag
		_ = database.RedisDel(ctx, dirtyKey)
	}
}
