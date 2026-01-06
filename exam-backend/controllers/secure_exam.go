package controllers

import (
	"errors"
	"exam-backend/database"
	"exam-backend/models"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Keep IST location as you had
var istLocation, _ = time.LoadLocation("Asia/Kolkata")

func nowIST() time.Time {
	return time.Now().In(istLocation)
}

// ------------------------- Sanitizer (student-facing) -------------------------
func sanitizeQuestions(questions []models.Question) []gin.H {
	clean := make([]gin.H, 0, len(questions))

	sort.SliceStable(questions, func(i, j int) bool {
		return questions[i].OrderNumber < questions[j].OrderNumber
	})

	for _, q := range questions {
		clean = append(clean, gin.H{
			"id":             q.ID,
			"type":           q.Type,
			"question_text":  q.QuestionText,
			"option_a":       q.OptionA,
			"option_b":       q.OptionB,
			"option_c":       q.OptionC,
			"option_d":       q.OptionD,
			"complexity":     q.Complexity,
			"order_number":   q.OrderNumber,
			"marks":          q.Points,
			"negative_marks": q.NegativePoints,
		})
	}

	return clean
}

// ------------------------- EXAM DETAILS (student) -------------------------
func GetExamDetails(c *gin.Context) {
	id := c.Param("id")
	var exam models.Exam
	if err := database.DB.Preload("Questions").First(&exam, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exam not found"})
		return
	}

	// Student-facing sanitized payload (no correct answers or points)
	resp := gin.H{
		"id":               exam.ID,
		"title":            exam.Title,
		"description":      exam.Description,
		"duration_minutes": exam.DurationMinutes,
		"start_time":       exam.StartTime,
		"end_time":         exam.EndTime,
		"is_active":        exam.IsActive,
		"section_locking":  exam.SectionLocking,
		"questions":        sanitizeQuestions(exam.Questions),
	}

	c.JSON(http.StatusOK, resp)
}

// ------------------------- START ATTEMPT (student) -------------------------
func StartAttempt(c *gin.Context) {
	var input struct {
		ExamID      string `json:"exam_id"`
		Fingerprint string `json:"fingerprint,omitempty"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	examUUID, err := uuid.Parse(input.ExamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_exam_id"})
		return
	}

	var exam models.Exam
	if err := database.DB.Preload("Questions").First(&exam, "id = ?", examUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "exam_not_found"})
		return
	}

	// simple scheduling checks
	now := time.Now().In(istLocation)
	if !exam.StartTime.IsZero() && now.Before(exam.StartTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "exam_not_started", "start_time": exam.StartTime})
		return
	}
	if !exam.EndTime.IsZero() && now.After(exam.EndTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "exam_closed"})
		return
	}
	// user can not start exam after 5 min of delay and no attempt active
	// if !exam.StartTime.IsZero() && now.After(exam.StartTime.Add(5*time.Minute)) {
	// 	c.JSON(http.StatusBadRequest, gin.H{"error": "exam_delayed"})
	// 	return
	// }
	uidVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not in context"})
		return
	}
	userIDStr := uidVal.(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user id"})
		return
	}

	// Use a DB transaction to check and create atomically
	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 1) Look for an existing ACTIVE attempt to RESUME (unsubmitted + not terminated)
	var existing models.ExamAttempt
	if err := tx.
		Where("student_id = ? AND exam_id = ? AND submitted_at IS NULL AND is_terminated = false", userID, examUUID).
		Order("started_at desc").
		First(&existing).Error; err == nil {

		// Resume existing attempt: return its id and reissue current exam_token if missing
		if existing.ExamToken == "" {
			existing.ExamToken = uuid.New().String()
			tx.Model(&existing).Update("exam_token", existing.ExamToken)
			_ = database.RedisSet(c.Request.Context(), "attempt_session:"+existing.ID.String(), existing.ExamToken, 2*time.Hour)
		}
		tx.Commit()

		c.JSON(http.StatusOK, gin.H{
			"id":           existing.ID,
			"exam_id":      existing.ExamID,
			"started_at":   existing.StartedAt,
			"time_left":    computeTimeLeftSeconds(exam, existing),
			"exam_token":   existing.ExamToken,
			"answers":      existing.Answers,
			"tab_switches": existing.TabSwitches,
			"status":       "resumed",
		})
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error checking active attempt"})
		return
	}

	// 2) Look for ANY past attempt (Submitted or Terminated)
	var oldAttempt models.ExamAttempt
	if err := tx.
		Where("student_id = ? AND exam_id = ?", userID, examUUID).
		First(&oldAttempt).Error; err == nil {

		tx.Rollback()
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "attempt_limit_reached",
			"message": "You have already attempted this exam.",
		})
		return
	}

	// 3) Create new attempt (Only if user has NEVER touched this exam before)
	
	// Generate ID and Token BEFORE creating
	newID := uuid.New()
	examToken := uuid.New().String()

	attempt := models.ExamAttempt{
		ID:          newID,        // Explicitly set ID
		ExamToken:   examToken,    // Explicitly set Token
		ExamID:      examUUID,
		StudentID:   userID,
		StartedAt:   time.Now(),
		TabSwitches: 0,
		Answers:     map[string]string{},
		Snapshots:   []string{},
	}

	// Single DB call (Create) containing the token and ID
	if err := tx.Create(&attempt).Error; err != nil {
		tx.Rollback()
		if strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "another_active_attempt_exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start exam"})
		return
	}

	// best-effort: store exam token in redis for fast checks
	_ = database.RedisSet(c.Request.Context(), "attempt_session:"+attempt.ID.String(), examToken, 2*time.Hour)

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"id":         attempt.ID,
		"exam_id":    attempt.ExamID,
		"started_at": attempt.StartedAt,
		"time_left":  computeTimeLeftSeconds(exam, attempt),
		"exam_token": examToken,
		"status":     "started",
	})
}

// computeTimeLeftSeconds: helper calculates remaining seconds
// computeTimeLeftSeconds: helper calculates remaining seconds
func computeTimeLeftSeconds(exam models.Exam, attempt models.ExamAttempt) int64 {
	if exam.DurationMinutes <= 0 {
		return 0
	}

	// 1. Calculate when the attempt MUST end based on duration
	attemptExpiry := attempt.StartedAt.Add(time.Duration(exam.DurationMinutes) * time.Minute)

	// 2. If the Exam has a hard global deadline (e.g. closes at 5:00 PM), respect it
	// (Only if EndTime is set and is earlier than the attempt expiry)
	if !exam.EndTime.IsZero() && attemptExpiry.After(exam.EndTime) {
		attemptExpiry = exam.EndTime
	}

	// 3. Calculate remaining seconds from NOW
	// We use time.Until(attemptExpiry) which is equivalent to attemptExpiry.Sub(time.Now())
	left := int64(time.Until(attemptExpiry).Seconds())

	if left < 0 {
		return 0
	}
	return left
}

// ------------------------- AUTOSAVE / PROGRESS -------------------------
// controllers/secure_exam.go

func UpdateProgress(c *gin.Context) {
	var input struct {
		AttemptID   string            `json:"attempt_id"`
		Answers     map[string]string `json:"answers"`
		Snapshot    string            `json:"snapshot"`
		TabSwitches int               `json:"tab_switches"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "invalid_payload"})
		return
	}

	ctx := c.Request.Context()
	attemptID := input.AttemptID

	answersKey := "attempt:answers:" + attemptID
	tabsKey := "attempt:tabs:" + attemptID
	dirtyKey := "attempt:dirty:" + attemptID

	// 1️⃣ Save answers to Redis
	if input.Answers != nil {
		_ = database.RedisSetJSON(ctx, answersKey, input.Answers, 3*time.Hour)
	}

	// 2️⃣ Save tab switches
	if input.TabSwitches > 0 {
		_ = database.RedisSet(ctx, tabsKey, strconv.Itoa(input.TabSwitches), 3*time.Hour)
	}

	// 3️⃣ Mark attempt as dirty (needs DB flush)
	_ = database.RedisSet(ctx, dirtyKey, "1", 3*time.Hour)

	c.JSON(200, gin.H{"status": "ok"})
}


// ------------------------- SUBMIT ATTEMPT (student) -------------------------
func SubmitAttempt(c *gin.Context) {
	var input struct {
		AttemptID string `json:"attempt_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	attemptUUID, err := uuid.Parse(input.AttemptID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid attempt_id"})
		return
	}

	var attempt models.ExamAttempt
	if err := database.DB.Preload("Exam.Questions").First(&attempt, "id = ?", attemptUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "attempt not found"})
		return
	}

	if attempt.SubmittedAt != nil || attempt.IsTerminated {
		c.JSON(http.StatusBadRequest, gin.H{"error": "attempt_already_finalized"})
		return
	}

	ctx := c.Request.Context()
	attemptID := attempt.ID.String()

	answersKey := "attempt:answers:" + attemptID
	tabsKey := "attempt:tabs:" + attemptID

	// 🔥 FORCE LOAD LATEST ANSWERS FROM REDIS
	var redisAnswers map[string]string
	if err := database.RedisGetJSON(ctx, answersKey, &redisAnswers); err == nil && redisAnswers != nil {
		attempt.Answers = redisAnswers
	}

	// 🔥 FORCE LOAD TAB SWITCHES
	tabsStr, _ := database.RedisGet(ctx, tabsKey)
	if tabs, err := strconv.Atoi(tabsStr); err == nil {
		attempt.TabSwitches = tabs
	}

	// Evaluate score using robust logic
	score, total := evaluateScore(attempt.Exam, attempt.Answers)

	attempt.Score = score
	attempt.TotalPoints = total

	percentage := 0.0
	if total > 0 {
		percentage = (float64(score) / float64(total)) * 100
	}

	attempt.Passed = percentage >= float64(attempt.Exam.PassingScore)

	now := nowIST()
	gracePeriod := time.Duration(2) * time.Minute
	if !attempt.Exam.EndTime.IsZero() && now.After(attempt.Exam.EndTime.Add(gracePeriod)) {
		attempt.IsTerminated = true
		attempt.TerminationReason = "Time limit exceeded (Server validation)"
	}
	attempt.SubmittedAt = &now

	if err := database.DB.Save(&attempt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to finalize attempt"})
		return
	}

	// Return results (student sees score after submission)
	c.JSON(http.StatusOK, gin.H{
		"score":        attempt.Score,
		"total_points": attempt.TotalPoints,
		"passed":       attempt.Passed,
		"submitted_at": attempt.SubmittedAt,
	})
}

// ------------------------- ADMIN: GetAttemptDetails -------------------------
func GetAttemptDetails(c *gin.Context) {
	id := c.Param("id")

	var attempt models.ExamAttempt
	if err := database.DB.Preload("Exam.Questions").Preload("Student").First(&attempt, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "attempt not found"})
		return
	}

	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	uidVal, _ := c.Get("userID")
	userIDStr, _ := uidVal.(string)

	if role != "admin" && role != "teacher" {
		if attempt.SubmittedAt == nil || userIDStr != attempt.StudentID.String() {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
	}

	c.JSON(http.StatusOK, attempt)
}

// ------------------------- Evaluation helper (Robust) -------------------------
func evaluateScore(exam models.Exam, answers map[string]string) (int, int) {
	totalPoints := 0
	var finalScore float64 = 0.0 // Use float for precise negative marking calculation

	// Map to find questions easily
	qmap := map[string]models.Question{}
	for _, q := range exam.Questions {
		qmap[q.ID.String()] = q
		totalPoints += q.Points
	}

	for qid, given := range answers {
		q, ok := qmap[qid]
		if !ok || given == "" {
			continue // Skip invalid or empty answers
		}

		// Normalize Input
		givenClean := strings.ToLower(strings.TrimSpace(given))
		correctClean := strings.ToLower(strings.TrimSpace(q.CorrectAnswer))

		isCorrect := false

		switch q.Type {
		case "multi-select":
			// Split by comma, trim, sort, rejoin
			userParts := splitAndTrim(givenClean)
			correctParts := splitAndTrim(correctClean)

			sort.Strings(userParts)
			sort.Strings(correctParts)

			userStr := strings.Join(userParts, ",")
			correctStr := strings.Join(correctParts, ",")

			if userStr == correctStr {
				isCorrect = true
			}

		case "true-false":
			// Explicit boolean check logic
			// normalize: "true" == "true", "t" == "t"
			if givenClean == correctClean {
				isCorrect = true
			}

		case "descriptive":
			// Strict match (case-insensitive)
			// Note: Usually descriptive needs manual grading.
			// Here we auto-grade based on exact keyword match provided in 'CorrectAnswer'
			if givenClean == correctClean {
				isCorrect = true
			}

		default:
			// "single-choice" and others
			if givenClean == correctClean {
				isCorrect = true
			}
		}

		// Apply Points
		if isCorrect {
			finalScore += float64(q.Points)
		} else {
			if exam.EnableNegativeMarking {
				finalScore -= q.NegativePoints
			}
		}
	}

	// Floor at 0
	if finalScore < 0 {
		finalScore = 0
	}

	// Return rounded integer score
	return int(math.Round(finalScore)), totalPoints
}

// Helper for multi-select splitting
func splitAndTrim(s string) []string {
	parts := strings.Split(s, ",")
	var cleaned []string
	for _, p := range parts {
		t := strings.TrimSpace(p)
		if t != "" {
			cleaned = append(cleaned, t)
		}
	}
	return cleaned
}
