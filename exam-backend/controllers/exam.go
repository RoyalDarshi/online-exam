package controllers

import (
	"exam-backend/database"
	"exam-backend/models"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Global IST location
var istLocation, _ = time.LoadLocation("Asia/Kolkata")

func nowIST() time.Time {
	return time.Now().In(istLocation)
}

// Compute remaining time in seconds based on exam.EndTime (IST)
func computeTimeLeft(exam models.Exam) int {
	now := nowIST()

	if !exam.EndTime.IsZero() {
		// ensure EndTime is also interpreted in IST
		end := exam.EndTime.In(istLocation)
		secs := int(end.Sub(now).Seconds())
		if secs < 0 {
			return 0
		}
		return secs
	}

	// Fallback if EndTime not set
	if exam.DurationMinutes <= 0 {
		return 0
	}
	return exam.DurationMinutes * 60
}

// ----------------- EXAMS -----------------

// Admin: create exam + questions
func CreateExam(c *gin.Context) {
	var exam models.Exam
	if err := c.ShouldBindJSON(&exam); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	uidVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}
	userIDStr, ok := uidVal.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid userID type"})
		return
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid userID"})
		return
	}
	exam.CreatedByID = userID

	// IMPORTANT: normalize StartTime to IST and compute EndTime
	if !exam.StartTime.IsZero() && exam.DurationMinutes > 0 {
		exam.StartTime = exam.StartTime.In(istLocation)
		exam.EndTime = exam.StartTime.Add(time.Duration(exam.DurationMinutes) * time.Minute)
	}

	if err := database.DB.Create(&exam).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create exam"})
		return
	}
	c.JSON(http.StatusOK, exam)
}

// List exams (students only see active ones)
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

// Get exam details (with questions)
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

// Admin: update exam (used for is_active, schedule changes, etc.)
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
		exam.StartTime = input.StartTime.In(istLocation)
	}
	if input.EndTime != nil {
		exam.EndTime = input.EndTime.In(istLocation)
	}

	// If we have StartTime + Duration but no EndTime, recompute
	if !exam.StartTime.IsZero() && exam.DurationMinutes > 0 && exam.EndTime.IsZero() {
		exam.EndTime = exam.StartTime.Add(time.Duration(exam.DurationMinutes) * time.Minute)
	}

	if err := database.DB.Save(&exam).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update exam"})
		return
	}

	c.JSON(http.StatusOK, exam)
}

// Admin: delete exam (questions & attempts cascade if FK set)
func DeleteExam(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Delete(&models.Exam{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete exam"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Exam deleted"})
}

// ----------------- ATTEMPTS & PROGRESS -----------------

// Student: start/resume attempt with strict scheduled window
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

	now := nowIST()
	start := exam.StartTime.In(istLocation)
	end := exam.EndTime.In(istLocation)

	// Not started yet
	if !start.IsZero() && now.Before(start) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":      "exam_not_started",
			"start_time": start,
		})
		return
	}

	// Already closed
	if !end.IsZero() && now.After(end) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "exam_closed"})
		return
	}

	uidVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found in context"})
		return
	}
	userIDStr, ok := uidVal.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid userID type"})
		return
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid userID"})
		return
	}

	// Resume existing attempt if any
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

	// Create new attempt
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

// Autosave progress + snapshots
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

// Helper to sort "A,C,B" -> "A,B,C" for comparison
func sortAnswer(ans string) string {
	parts := strings.Split(ans, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	sort.Strings(parts)
	return strings.Join(parts, ",")
}

// Submit attempt – server-side final time validation & scoring
func SubmitAttempt(c *gin.Context) {
	var input struct {
		AttemptID string            `json:"attempt_id"`
		Answers   map[string]string `json:"answers"`
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

	if input.Answers != nil {
		attempt.Answers = input.Answers
		// Save them immediately so scoring logic uses the latest data
		if err := database.DB.Save(&attempt).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save final answers"})
			return
		}
	}

	var exam models.Exam
	if err := database.DB.First(&exam, "id = ?", attempt.ExamID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Exam not found for attempt"})
		return
	}

	now := nowIST()
	end := exam.EndTime.In(istLocation)

	// If time is over according to server, terminate
	if !end.IsZero() && now.After(end) {
		attempt.IsTerminated = true
		attempt.TerminationReason = "Time limit exceeded (Server validation)"
	}

	// Score calculation
	var questions []models.Question
	if err := database.DB.Where("exam_id = ?", attempt.ExamID).
		Find(&questions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load questions"})
		return
	}

	score := 0.0 // Use float for calculation
	totalPoints := 0

	for _, q := range questions {
		totalPoints += q.Points

		userAnswer, answered := attempt.Answers[q.ID.String()]

		if answered && userAnswer != "" {
			isCorrect := false

			if q.Type == "multi-select" {
				// Strict Matching: Sort both and compare string equality
				// DB Correct: "A,C" | User: "C,A" -> Both become "A,C"
				if sortAnswer(userAnswer) == sortAnswer(q.CorrectAnswer) {
					isCorrect = true
				}
			} else {
				// Single Choice
				if userAnswer == q.CorrectAnswer {
					isCorrect = true
				}
			}

			if isCorrect {
				score += float64(q.Points)
			} else {
				score -= q.NegativePoints
			}
		}
	}

	if score < 0 {
		score = 0
	}

	attempt.Score = int(score) // Store as integer (rounded down) or update DB schema to float
	attempt.TotalPoints = totalPoints

	if totalPoints > 0 {
		percentage := (float64(score) / float64(totalPoints)) * 100
		attempt.Passed = percentage >= float64(exam.PassingScore)
	} else {
		attempt.Passed = false
	}

	// Proctoring rule
	if attempt.TabSwitches >= 3 {
		attempt.Passed = false
		attempt.Score = 0
		attempt.IsTerminated = true
		attempt.TerminationReason = "Proctoring Violations"
	}

	nowPtr := now
	attempt.SubmittedAt = &nowPtr

	if err := database.DB.Save(&attempt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save attempt"})
		return
	}

	attempt.TimeLeftSeconds = 0
	c.JSON(http.StatusOK, attempt)
}

// For reconnect & admin review
func GetAttemptDetails(c *gin.Context) {
	id := c.Param("id")

	// Load attempt + exam + questions
	var attempt models.ExamAttempt
	if err := database.DB.
		Preload("Exam").
		Preload("Exam.Questions", func(db *gorm.DB) *gorm.DB {
			return db.Order("order_number asc")
		}).
		First(&attempt, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Attempt not found"})
		return
	}

	// We NEVER return user's answers during exam – only after submission
	if attempt.SubmittedAt == nil {
		attempt.Answers = map[string]string{} // hide answers
	}

	attempt.TimeLeftSeconds = computeTimeLeft(attempt.Exam)

	c.JSON(http.StatusOK, attempt)
}

// Admin: all attempts for an exam (with pagination)
func GetExamAttempts(c *gin.Context) {
	examID := c.Param("id")

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

func GetStudentAttempts(c *gin.Context) {
	// 1. Get logged-in user ID
	uidVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userIDStr, _ := uidVal.(string)
	userID, _ := uuid.Parse(userIDStr)

	// 2. Query attempts
	var attempts []models.ExamAttempt
	if err := database.DB.
		Preload("Exam"). // Load Exam title/details
		Where("student_id = ?", userID).
		Order("started_at desc").
		Find(&attempts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load attempts"})
		return
	}

	c.JSON(http.StatusOK, attempts)
}

// Admin: Update exam + overwrite questions
func UpdateExamWithQuestions(c *gin.Context) {
	examID := c.Param("id")

	var input struct {
		Title           *string                `json:"title"`
		Description     *string                `json:"description"`
		DurationMinutes *int                   `json:"duration_minutes"`
		PassingScore    *int                   `json:"passing_score"`
		IsActive        *bool                  `json:"is_active"`
		StartTime       *time.Time             `json:"start_time"`
		Questions       []models.QuestionInput `json:"questions"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var exam models.Exam
	if err := database.DB.First(&exam, "id = ?", examID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exam not found"})
		return
	}

	// Update exam fields
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
		exam.StartTime = input.StartTime.In(istLocation)
		exam.EndTime = exam.StartTime.Add(time.Duration(exam.DurationMinutes) * time.Minute)
	}

	// Update questions: remove old, add new
	database.DB.Where("exam_id = ?", exam.ID).Delete(&models.Question{})

	for _, q := range input.Questions {
		newQ := models.Question{
			ExamID:        exam.ID,
			Type:          q.Type,
			QuestionText:  q.QuestionText,
			OptionA:       q.OptionA,
			OptionB:       q.OptionB,
			OptionC:       q.OptionC,
			OptionD:       q.OptionD,
			CorrectAnswer: q.CorrectAnswer,
			Points:        q.Points,
			OrderNumber:   q.OrderNumber,
		}
		database.DB.Create(&newQ)
	}

	// Save final exam
	database.DB.Save(&exam)

	c.JSON(http.StatusOK, gin.H{
		"message": "Exam updated successfully",
		"exam":    exam,
	})
}
