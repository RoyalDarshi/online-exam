package controllers

// import (
// 	"exam-backend/database"
// 	"exam-backend/models"
// 	"net/http"
// 	"time"

// 	"github.com/gin-gonic/gin"
// 	"github.com/google/uuid"
// 	"gorm.io/gorm"
// )

// // ---------------------------
// // Admin helper: subject/topic
// // ---------------------------

// // GET /api/admin/bank/subjects
// // Returns distinct subjects from ALL teachers' question banks.
// func AdminGetSubjects(c *gin.Context) {
// 	var subjects []string

// 	if err := database.DB.
// 		Model(&models.QuestionBank{}).
// 		Where("deleted_at IS NULL").
// 		Distinct().
// 		Pluck("subject", &subjects).Error; err != nil {

// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load subjects"})
// 		return
// 	}

// 	c.JSON(http.StatusOK, gin.H{"subjects": subjects})
// }

// // GET /api/admin/bank/subjects/:subject/topics
// // Returns distinct topics for a given subject.
// func AdminGetTopicsForSubject(c *gin.Context) {
// 	subject := c.Param("subject")

// 	var topics []string
// 	if err := database.DB.
// 		Model(&models.QuestionBank{}).
// 		Where("subject = ? AND deleted_at IS NULL", subject).
// 		Distinct().
// 		Pluck("topic", &topics).Error; err != nil {

// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load topics"})
// 		return
// 	}

// 	c.JSON(http.StatusOK, gin.H{
// 		"subject": subject,
// 		"topics":  topics,
// 	})
// }

// // -------------------------------------------
// // Admin exam generator: request/response types
// // -------------------------------------------

// // Admin sends ABSOLUTE counts (already computed from percentages in frontend).
// // This keeps backend simple and 100% validates feasibility.
// type TopicDifficultyConfig struct {
// 	Topic       string `json:"topic"`
// 	EasyCount   int    `json:"easy_count"`
// 	MediumCount int    `json:"medium_count"`
// 	HardCount   int    `json:"hard_count"`
// }

// // Payload used by BOTH preview and create endpoints.
// // For preview, title/description/etc can be empty.
// type ExamFromBankRequest struct {
// 	Subject         string                  `json:"subject"`
// 	Title           string                  `json:"title"`
// 	Description     string                  `json:"description"`
// 	DurationMinutes int                     `json:"duration_minutes"`
// 	PassingScore    int                     `json:"passing_score"`
// 	StartTime       string                  `json:"start_time"` // RFC3339 from frontend: "2025-12-05T10:00:00+05:30"
// 	Topics          []TopicDifficultyConfig `json:"topics"`
// }

// type Shortage struct {
// 	Topic      string `json:"topic"`
// 	Complexity string `json:"complexity"`
// 	Requested  int    `json:"requested"`
// 	Available  int64  `json:"available"`
// }

// // -------------------------
// // Shared validation helper
// // -------------------------

// func validateBankAvailability(req ExamFromBankRequest) ([]Shortage, error) {
// 	shortages := []Shortage{}

// 	for _, t := range req.Topics {
// 		// easy / medium / hard loop
// 		type pair struct {
// 			label string
// 			count int
// 		}
// 		checks := []pair{
// 			{"easy", t.EasyCount},
// 			{"medium", t.MediumCount},
// 			{"hard", t.HardCount},
// 		}

// 		for _, chk := range checks {
// 			if chk.count <= 0 {
// 				continue
// 			}
// 			var available int64
// 			if err := database.DB.Model(&models.QuestionBank{}).
// 				Where("subject = ? AND topic = ? AND complexity = ? AND deleted_at IS NULL",
// 					req.Subject, t.Topic, chk.label).
// 				Count(&available).Error; err != nil {
// 				return nil, err
// 			}

// 			if available < int64(chk.count) {
// 				shortages = append(shortages, Shortage{
// 					Topic:      t.Topic,
// 					Complexity: chk.label,
// 					Requested:  chk.count,
// 					Available:  available,
// 				})
// 			}
// 		}
// 	}

// 	return shortages, nil
// }

// // ---------------------------
// // POST /api/admin/exams/preview
// // ---------------------------
// // ONLY validates feasibility; does NOT expose question texts to admin.
// func ExamBankPreview(c *gin.Context) {
// 	var req ExamFromBankRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload", "details": err.Error()})
// 		return
// 	}

// 	if req.Subject == "" || len(req.Topics) == 0 {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": "Subject and at least one topic are required"})
// 		return
// 	}

// 	shortages, err := validateBankAvailability(req)
// 	if err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate question bank"})
// 		return
// 	}

// 	if len(shortages) > 0 {
// 		c.JSON(http.StatusBadRequest, gin.H{
// 			"ok":        false,
// 			"message":   "Not enough questions in bank for requested config",
// 			"shortages": shortages,
// 		})
// 		return
// 	}

// 	// Return only aggregated info; still no question texts.
// 	totalQuestions := 0
// 	for _, t := range req.Topics {
// 		totalQuestions += t.EasyCount + t.MediumCount + t.HardCount
// 	}

// 	c.JSON(http.StatusOK, gin.H{
// 		"ok":              true,
// 		"subject":         req.Subject,
// 		"total_questions": totalQuestions,
// 		"topics":          req.Topics,
// 	})
// }

// // ---------------------------------
// // POST /api/admin/exams/from-bank
// // ---------------------------------
// // Validates availability AND creates an Exam + Questions from teacher bank.
// // Admin NEVER sees question_text here – only students do during exam.
// func CreateExamFromBank(c *gin.Context) {
// 	var req ExamFromBankRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload", "details": err.Error()})
// 		return
// 	}

// 	if req.Subject == "" || req.Title == "" || len(req.Topics) == 0 {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": "Subject, title and topics are required"})
// 		return
// 	}

// 	shortages, err := validateBankAvailability(req)
// 	if err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate question bank"})
// 		return
// 	}
// 	if len(shortages) > 0 {
// 		c.JSON(http.StatusBadRequest, gin.H{
// 			"ok":        false,
// 			"message":   "Not enough questions in bank for requested config",
// 			"shortages": shortages,
// 		})
// 		return
// 	}

// 	// Parse start time (if provided)
// 	var startTime time.Time
// 	if req.StartTime != "" {
// 		t, err := time.Parse(time.RFC3339, req.StartTime)
// 		if err != nil {
// 			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_time format, expected RFC3339"})
// 			return
// 		}
// 		startTime = t
// 	} else {
// 		startTime = time.Now()
// 	}

// 	// Admin id from token
// 	userIDStr, _ := c.Get("user_id")
// 	userID, _ := uuid.Parse(userIDStr.(string))

// 	// Create the exam
// 	exam := models.Exam{
// 		Title:           req.Title,
// 		Description:     req.Description,
// 		DurationMinutes: req.DurationMinutes,
// 		PassingScore:    req.PassingScore,
// 		IsActive:        true,
// 		CreatedByID:     userID,
// 		CreatedAt:       time.Now(),
// 		// If your Exam model has StartTime, set it here
// 		// StartTime:       startTime,
// 	}

// 	// We will create exam + questions in a transaction
// 	if err := database.DB.Transaction(func(tx *gorm.DB) error {
// 		if err := tx.Create(&exam).Error; err != nil {
// 			return err
// 		}

// 		order := 0

// 		// Helper closure to pick questions for one (topic,complexity)
// 		pick := func(topic, complexity string, count int) error {
// 			if count <= 0 {
// 				return nil
// 			}

// 			var bankQuestions []models.QuestionBank
// 			if err := tx.Where(
// 				"subject = ? AND topic = ? AND complexity = ? AND deleted_at IS NULL",
// 				req.Subject, topic, complexity,
// 			).
// 				Order("RANDOM()").
// 				Limit(count).
// 				Find(&bankQuestions).Error; err != nil {
// 				return err
// 			}

// 			for _, qb := range bankQuestions {
// 				q := models.Question{
// 					ExamID:       exam.ID,
// 					QuestionText: qb.QuestionText,
// 					OptionA:      qb.Option1,
// 					OptionB:      qb.Option2,
// 					OptionC:      qb.Option3,
// 					OptionD:      qb.Option4,
// 					// For now we assume "Correct" already stores something compatible
// 					// with your current single-answer logic ("A"/"B"/"C"/"D").
// 					CorrectAnswer: qb.Correct,
// 					Points:        1, // or derive from complexity if you want
// 					OrderNumber:   order,
// 				}
// 				order++

// 				if err := tx.Create(&q).Error; err != nil {
// 					return err
// 				}
// 			}

// 			return nil
// 		}

// 		for _, tcfg := range req.Topics {
// 			if err := pick(tcfg.Topic, "easy", tcfg.EasyCount); err != nil {
// 				return err
// 			}
// 			if err := pick(tcfg.Topic, "medium", tcfg.MediumCount); err != nil {
// 				return err
// 			}
// 			if err := pick(tcfg.Topic, "hard", tcfg.HardCount); err != nil {
// 				return err
// 			}
// 		}

// 		return nil
// 	}); err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create exam from bank", "details": err.Error()})
// 		return
// 	}

// 	// Return only exam meta (no questions text leaked to admin)
// 	c.JSON(http.StatusOK, gin.H{
// 		"ok":   true,
// 		"exam": exam,
// 	})
// }
