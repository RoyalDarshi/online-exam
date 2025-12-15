package controllers

import (
	"errors"
	"exam-backend/database"
	"exam-backend/models"
	"net/http"
	"sort"
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

// computeTimeLeft same as earlier
func computeTimeLeft(exam models.Exam) int {
	now := nowIST()

	if !exam.EndTime.IsZero() {
		end := exam.EndTime.In(istLocation)
		secs := int(end.Sub(now).Seconds())
		if secs < 0 {
			return 0
		}
		return secs
	}

	if exam.DurationMinutes <= 0 {
		return 0
	}
	return exam.DurationMinutes * 60
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
// StartAttempt creates or resumes an exam attempt and returns an exam_token for WS connection.
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
	// user can not start exam after 5 min of delay
	if !exam.StartTime.IsZero() && now.After(exam.StartTime.Add(5*time.Minute)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "exam_delayed"})
		return
	}
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
			"id":         existing.ID,
			"exam_id":    existing.ExamID,
			"started_at": existing.StartedAt,
			"time_left":  computeTimeLeftSeconds(exam, existing),
			"exam_token": existing.ExamToken,
			"status":     "resumed",
		})
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error checking active attempt"})
		return
	}

	// 2) [NEW SECURITY CHECK] Look for ANY past attempt (Submitted or Terminated)
	// If we are here, step 1 failed, meaning no active attempt exists.
	// So if we find ANY record now, it MUST be a finished/failed one.
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
	attempt := models.ExamAttempt{
		ExamID:      examUUID,
		StudentID:   userID,
		StartedAt:   time.Now(),
		TabSwitches: 0,
		Answers:     map[string]string{},
		Snapshots:   []string{},
	}

	if err := tx.Create(&attempt).Error; err != nil {
		tx.Rollback()
		if strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "another_active_attempt_exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start exam"})
		return
	}

	// generate exam_token and persist
	examToken := uuid.New().String()
	if err := tx.Model(&attempt).Update("exam_token", examToken).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create exam token"})
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

// computeTimeLeftSeconds: helper calculates remaining seconds based on exam duration or per-attempt time-left
func computeTimeLeftSeconds(exam models.Exam, attempt models.ExamAttempt) int64 {
	// example: use exam.DurationMinutes as time limit
	if exam.DurationMinutes <= 0 {
		return 0
	}
	left := int64(exam.EndTime.Sub(attempt.StartedAt).Seconds())
	if left < 0 {
		return 0
	}
	return left
}

// ------------------------- AUTOSAVE / PROGRESS -------------------------
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

	attemptUUID, err := uuid.Parse(input.AttemptID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid attempt_id"})
		return
	}

	var attempt models.ExamAttempt
	if err := database.DB.First(&attempt, "id = ?", attemptUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "attempt not found"})
		return
	}

	// if already submitted or terminated -> reject updates
	if attempt.SubmittedAt != nil || attempt.IsTerminated {
		c.JSON(http.StatusBadRequest, gin.H{"error": "attempt_locked"})
		return
	}

	// Merge answers (server-side truth)
	if input.Answers != nil {
		// Overwrite server map with incoming answers for those keys
		for k, v := range input.Answers {
			// basic normalization
			attempt.Answers[k] = v
		}
	}

	// Append snapshot if provided (keep small — real system should store blobs externally)
	if input.Snapshot != "" {
		attempt.Snapshots = append(attempt.Snapshots, input.Snapshot)
		// optional: limit number of snapshots kept
		if len(attempt.Snapshots) > 50 {
			attempt.Snapshots = attempt.Snapshots[len(attempt.Snapshots)-50:]
		}
	}

	// Tab-switch enforcement (example threshold; you can configure)
	const MAX_TAB_SWITCHES = 5
	if input.TabSwitches > attempt.TabSwitches {
		attempt.TabSwitches = input.TabSwitches
	}
	if attempt.TabSwitches > MAX_TAB_SWITCHES {
		attempt.IsTerminated = true
		attempt.TerminationReason = "too_many_tab_switches"
	}

	if err := database.DB.Save(&attempt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save progress"})
		return
	}

	// IMPORTANT: Do NOT return attempt.Answers or snapshots to client while exam ongoing
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
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

	// Evaluate server-side using the saved attempt.Answers (server's source-of-truth)
	score, total := evaluateScore(attempt.Exam, attempt.Answers)

	attempt.Score = score
	attempt.TotalPoints = total

	percentage := 0.0
	if total > 0 {
		percentage = (float64(score) / float64(total)) * 100
	}

	// Check if percentage >= PassingScore (assuming PassingScore is e.g., 33, 40, 50)
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

// ------------------------- ADMIN: GetAttemptDetails (full access) -------------------------
func GetAttemptDetails(c *gin.Context) {
	id := c.Param("id")

	var attempt models.ExamAttempt
	if err := database.DB.Preload("Exam.Questions").Preload("Student").First(&attempt, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "attempt not found"})
		return
	}

	// Only admins or the owner (after submission) can see answers
	roleVal, _ := c.Get("role")
	role, _ := roleVal.(string)
	uidVal, _ := c.Get("userID")
	userIDStr, _ := uidVal.(string)

	if role != "admin" && role != "teacher" {
		// student: only allow if attempt.SubmittedAt != nil and belongs to them
		if attempt.SubmittedAt == nil || userIDStr != attempt.StudentID.String() {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
	}

	c.JSON(http.StatusOK, attempt)
}

// ------------------------- Evaluation helper -------------------------
func evaluateScore(exam models.Exam, answers map[string]string) (int, int) {
	totalPoints := 0
	score := 0

	// Build a map for quick lookup
	qmap := map[string]models.Question{}
	for _, q := range exam.Questions {
		qmap[q.ID.String()] = q
		totalPoints += q.Points
	}

	for qid, given := range answers {
		q, ok := qmap[qid]
		if !ok {
			continue
		}
		// normalize
		givenTrim := strings.TrimSpace(strings.ToLower(given))
		correct := strings.TrimSpace(strings.ToLower(q.CorrectAnswer))

		if q.Type == "multi-select" {
			// treat as unordered set of comma-separated tokens
			givenSet := make(map[string]bool)
			for _, p := range strings.Split(givenTrim, ",") {
				if s := strings.TrimSpace(p); s != "" {
					givenSet[s] = true
				}
			}
			correctSet := make(map[string]bool)
			for _, p := range strings.Split(correct, ",") {
				if s := strings.TrimSpace(p); s != "" {
					correctSet[s] = true
				}
			}
			// equality check
			equal := len(givenSet) == len(correctSet)
			if equal {
				for k := range givenSet {
					if !correctSet[k] {
						equal = false
						break
					}
				}
			}
			if equal {
				score += q.Points
			} else if exam.EnableNegativeMarking {
				// Deduct (rounded to nearest int)
				score -= int(q.NegativePoints)
			}
		} else {
			if givenTrim == correct {
				score += q.Points
			} else if exam.EnableNegativeMarking {
				score -= int(q.NegativePoints)
			}
		}
	}

	// ensure non-negative score
	if score < 0 {
		score = 0
	}
	return score, totalPoints
}
