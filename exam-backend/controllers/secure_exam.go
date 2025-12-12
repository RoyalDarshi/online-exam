package controllers

import (
	"exam-backend/database"
	"exam-backend/models"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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
            "id":            q.ID,
            "type":          q.Type,
            "question_text": q.QuestionText,
            "option_a":      q.OptionA,
            "option_b":      q.OptionB,
            "option_c":      q.OptionC,
            "option_d":      q.OptionD,
            "complexity":    q.Complexity,
            "order_number":  q.OrderNumber,
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
	if err := database.DB.Preload("Questions").First(&exam, "id = ?", examUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exam not found"})
		return
	}

	now := nowIST()
	start := exam.StartTime.In(istLocation)
	end := exam.EndTime.In(istLocation)

	if !start.IsZero() && now.Before(start) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "exam_not_started", "start_time": start})
		return
	}
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

	// Resume existing if any unfinished
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

		// Do NOT return Answers or Snapshots while exam is in progress
		existingAttempt.Answers = nil
		existingAttempt.Snapshots = nil
		existingAttempt.TimeLeftSeconds = timeLeft

		c.JSON(http.StatusOK, gin.H{
			"id":        existingAttempt.ID,
			"exam_id":   existingAttempt.ExamID,
			"started_at": existingAttempt.StartedAt,
			"time_left": existingAttempt.TimeLeftSeconds,
		})
		return
	}

	// Create new attempt (Answers map initially empty on server)
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
	c.JSON(http.StatusOK, gin.H{
		"id":        attempt.ID,
		"exam_id":   attempt.ExamID,
		"started_at": attempt.StartedAt,
		"time_left": attempt.TimeLeftSeconds,
	})
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
	attempt.Passed = score >= attempt.Exam.PassingScore
	now := nowIST()
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
