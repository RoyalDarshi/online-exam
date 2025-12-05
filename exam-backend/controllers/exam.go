package controllers

import (
	"exam-backend/database"
	"exam-backend/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ----------------- helpers -----------------

func computeTimeLeft(exam models.Exam) int {
	now := time.Now()
	if !exam.EndTime.IsZero() {
		secs := int(exam.EndTime.Sub(now).Seconds())
		if secs < 0 {
			return 0
		}
		return secs
	}
	// fallback (no scheduled end set)
	if exam.DurationMinutes <= 0 {
		return 0
	}
	return exam.DurationMinutes * 60
}

// ----------------- exams -----------------

func CreateExam(c *gin.Context) {
	var exam models.Exam
	if err := c.ShouldBindJSON(&exam); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	uidVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}
	userIDStr := uidVal.(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user_id"})
		return
	}
	exam.CreatedByID = userID

	// If StartTime is provided, compute EndTime = StartTime + duration
	if !exam.StartTime.IsZero() && exam.DurationMinutes > 0 {
		exam.EndTime = exam.StartTime.Add(time.Duration(exam.DurationMinutes) * time.Minute)
	}

	if err := database.DB.Create(&exam).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create exam"})
		return
	}
	c.JSON(http.StatusOK, exam)
}

func GetExams(c *gin.Context) {
	var exams []models.Exam

	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)

	query := database.DB
	if role == "student" {
		query = query.Where("is_active = ?", true)
	}

	if err := query.Order("created_at desc").Find(&exams).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load exams"})
		return
	}

	c.JSON(http.StatusOK, exams)
}

func GetExamDetails(c *gin.Context) {
	id := c.Param("id")
	var exam models.Exam
	if err := database.DB.Preload("Questions", func(db *gorm.DB) *gorm.DB {
		return db.Order("order_number asc")
	}).First(&exam, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exam not found"})
		return
	}
	c.JSON(http.StatusOK, exam)
}

// update exam (used mainly for is_active toggle)
func UpdateExam(c *gin.Context) {
	id := c.Param("id")

	var input struct {
		Title           *string    `json:"title"`
		Description     *string    `json:"description"`
		DurationMinutes *int       `json:"duration_minutes"`
		PassingScore    *int       `json:"passing_score"`
		IsActive        *bool      `json:"is_active"`
		StartTime       *time.Time `json:"start_time"`
		EndTime         *time.Time `json:"end_time"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var exam models.Exam
	if err := database.DB.First(&exam, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exam not found"})
		return
	}

	if input.Title != nil {
		exam.Title = *input.Title
	}
	if input.Description != nil {
		exam.Description = *input.Description
	}
	if input.DurationMinutes != nil {
		exam.DurationMinutes = *input.DurationMinutes
	}
	if input.PassingScore != nil {
		exam.PassingScore = *input.PassingScore
	}
	if input.IsActive != nil {
		exam.IsActive = *input.IsActive
	}
	if input.StartTime != nil {
		exam.StartTime = *input.StartTime
	}
	if input.EndTime != nil {
		exam.EndTime = *input.EndTime
	}

	// keep EndTime consistent if StartTime & Duration are set
	if !exam.StartTime.IsZero() && exam.DurationMinutes > 0 && exam.EndTime.IsZero() {
		exam.EndTime = exam.StartTime.Add(time.Duration(exam.DurationMinutes) * time.Minute)
	}

	if err := database.DB.Save(&exam).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update exam"})
		return
	}

	c.JSON(http.StatusOK, exam)
}

func DeleteExam(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Delete(&models.Exam{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete exam"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Exam deleted"})
}

// ----------------- attempts & progress -----------------

// strict scheduled exam start
func StartAttempt(c *gin.Context) {
	var input struct {
		ExamID string `json:"exam_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	examUUID, err := uuid.Parse(input.ExamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid exam_id"})
		return
	}

	var exam models.Exam
	if err := database.DB.First(&exam, "id = ?", examUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exam not found"})
		return
	}

	now := time.Now()
	if !exam.StartTime.IsZero() {
		if now.Before(exam.StartTime) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":      "exam_not_started",
				"start_time": exam.StartTime,
			})
			return
		}
		if !exam.EndTime.IsZero() && now.After(exam.EndTime) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "exam_closed"})
			return
		}
	}

	uidVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}
	userIDStr := uidVal.(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user_id"})
		return
	}

	// resume if an open attempt exists
	var existingAttempt models.ExamAttempt
	if err := database.DB.
		Where("student_id = ? AND exam_id = ?", userID, examUUID).
		Order("started_at desc").
		First(&existingAttempt).Error; err == nil {

		if existingAttempt.SubmittedAt != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "attempt_already_submitted"})
			return
		}

		timeLeft := computeTimeLeft(exam)
		if timeLeft <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "exam_closed"})
			return
		}

		existingAttempt.TimeLeftSeconds = timeLeft
		c.JSON(http.StatusOK, existingAttempt)
		return
	}

	// new attempt
	attempt := models.ExamAttempt{
		ExamID:      examUUID,
		StudentID:   userID,
		StartedAt:   now,
		TabSwitches: 0,
		Answers:     make(map[string]string),
		Snapshots:   []string{},
	}

	if err := database.DB.Create(&attempt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start exam"})
		return
	}

	attempt.TimeLeftSeconds = computeTimeLeft(exam)
	c.JSON(http.StatusOK, attempt)
}

func UpdateProgress(c *gin.Context) {
	var input struct {
		AttemptID   string            `json:"attempt_id"`
		Answers     map[string]string `json:"answers"`
		Snapshot    string            `json:"snapshot"`
		TabSwitches int               `json:"tab_switches"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var attempt models.ExamAttempt
	if err := database.DB.First(&attempt, "id = ?", input.AttemptID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Attempt not found"})
		return
	}

	if attempt.SubmittedAt != nil || attempt.IsTerminated {
		c.JSON(http.StatusForbidden, gin.H{"error": "Exam is closed"})
		return
	}

	if input.Snapshot != "" {
		if len(attempt.Snapshots) >= 10 {
			attempt.Snapshots = attempt.Snapshots[1:]
		}
		attempt.Snapshots = append(attempt.Snapshots, input.Snapshot)
	}

	if input.Answers != nil {
		attempt.Answers = input.Answers
	}
	attempt.TabSwitches = input.TabSwitches

	if err := database.DB.Save(&attempt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update progress"})
		return
	}

	c.Status(http.StatusOK)
}

func SubmitAttempt(c *gin.Context) {
	var input struct {
		AttemptID string `json:"attempt_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var attempt models.ExamAttempt
	if err := database.DB.First(&attempt, "id = ?", input.AttemptID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Attempt not found"})
		return
	}

	if attempt.SubmittedAt != nil {
		c.JSON(http.StatusOK, gin.H{"message": "Already submitted"})
		return
	}

	var exam models.Exam
	if err := database.DB.First(&exam, "id = ?", attempt.ExamID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Exam not found for attempt"})
		return
	}

	// time enforcement based on scheduled EndTime
	if !exam.EndTime.IsZero() && time.Now().After(exam.EndTime) {
		attempt.IsTerminated = true
		attempt.TerminationReason = "Time limit exceeded (Server validation)"
	}

	// score
	var questions []models.Question
	if err := database.DB.Where("exam_id = ?", attempt.ExamID).
		Order("order_number asc").
		Find(&questions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load questions"})
		return
	}

	score := 0
	totalPoints := 0
	for _, q := range questions {
		totalPoints += q.Points
		if userAnswer, ok := attempt.Answers[q.ID.String()]; ok && userAnswer == q.CorrectAnswer {
			score += q.Points
		}
	}
	attempt.Score = score
	attempt.TotalPoints = totalPoints

	if totalPoints > 0 {
		percentage := (float64(score) / float64(totalPoints)) * 100
		attempt.Passed = percentage >= float64(exam.PassingScore)
	} else {
		attempt.Passed = false
	}

	if attempt.TabSwitches >= 3 {
		attempt.Passed = false
		attempt.Score = 0
		attempt.IsTerminated = true
		attempt.TerminationReason = "Proctoring Violations"
	}

	now := time.Now()
	attempt.SubmittedAt = &now

	if err := database.DB.Save(&attempt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save attempt"})
		return
	}

	attempt.TimeLeftSeconds = 0
	c.JSON(http.StatusOK, attempt)
}

// also used by admin + student (for reconnect)
func GetAttemptDetails(c *gin.Context) {
	id := c.Param("id")

	var attempt models.ExamAttempt
	if err := database.DB.
		Preload("Student").
		Preload("Exam").
		First(&attempt, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Attempt not found", "requested_id": id})
		return
	}

	// compute time_left for reconnect scenarios
	attempt.TimeLeftSeconds = computeTimeLeft(attempt.Exam)
	c.JSON(http.StatusOK, attempt)
}

// admin: get attempts for an exam (with student info)
func GetExamAttempts(c *gin.Context) {
	examID := c.Param("id")

	// basic pagination (optional)
	pageStr := c.DefaultQuery("page", "1")
	limitStr := c.DefaultQuery("limit", "50")
	page, _ := strconv.Atoi(pageStr)
	limit, _ := strconv.Atoi(limitStr)
	if page < 1 {
		page = 1
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit

	var attempts []models.ExamAttempt
	if err := database.DB.
		Preload("Student").
		Where("exam_id = ?", examID).
		Order("started_at desc").
		Limit(limit).
		Offset(offset).
		Find(&attempts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load attempts"})
		return
	}

	var total int64
	database.DB.Model(&models.ExamAttempt{}).Where("exam_id = ?", examID).Count(&total)

	c.JSON(http.StatusOK, gin.H{
		"data":       attempts,
		"page":       page,
		"limit":      limit,
		"total":      total,
		"totalPages": (total + int64(limit) - 1) / int64(limit),
	})
}
