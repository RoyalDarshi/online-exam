package controllers

import (
	"exam-backend/database"
	"exam-backend/models"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Shared Request Payload for Create & Update
type ExamUpsertRequest struct {
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	Subject         string    `json:"subject"`
	DurationMinutes int       `json:"duration_minutes"`
	PassingScore    int       `json:"passing_score"`
	StartTime       time.Time `json:"start_time"`
	IsActive        *bool     `json:"is_active"` // Pointer to handle false vs nil

	// --- Question Generation Configuration ---
	// If TotalQuestions > 0, the backend will generate/regenerate questions
	TotalQuestions int      `json:"total_questions"`
	Topics         []string `json:"topics"`

	Difficulty struct {
		Easy   int `json:"easy"`   // Percentage (0-100)
		Medium int `json:"medium"` // Percentage
		Hard   int `json:"hard"`   // Percentage
	} `json:"difficulty"`

	PointsConfig struct {
		Easy   int `json:"easy"`
		Medium int `json:"medium"`
		Hard   int `json:"hard"`
	} `json:"points_config"`

	EnableNegativeMarking bool `json:"enable_negative_marking"`
	NegativeConfig        struct {
		Easy   float64 `json:"easy"`
		Medium float64 `json:"medium"`
		Hard   float64 `json:"hard"`
	} `json:"negative_config"`
}

// ----------------------
// HELPER: Generator Logic
// ----------------------
func generateQuestionsFromBank(tx *gorm.DB, examID uuid.UUID, req ExamUpsertRequest) error {
	// 1. Fetch Candidates
	var bank []models.QuestionBank
	query := tx.Where("subject = ?", req.Subject)
	if len(req.Topics) > 0 {
		query = query.Where("topic IN ?", req.Topics)
	}
	if err := query.Find(&bank).Error; err != nil {
		return err
	}

	// 2. Buckets
	var easyQs, medQs, hardQs []models.QuestionBank
	for _, q := range bank {
		switch strings.ToLower(q.Complexity) {
		case "easy":
			easyQs = append(easyQs, q)
		case "medium":
			medQs = append(medQs, q)
		case "hard":
			hardQs = append(hardQs, q)
		}
	}

	// 3. Calculate Counts based on Percentages
	total := req.TotalQuestions
	needEasy := int(float64(total) * float64(req.Difficulty.Easy) / 100.0)
	needMedium := int(float64(total) * float64(req.Difficulty.Medium) / 100.0)
	needHard := total - needEasy - needMedium // Remainder goes to hard to ensure sum matches

	// 4. Validate Availability
	if len(easyQs) < needEasy || len(medQs) < needMedium || len(hardQs) < needHard {
		return gorm.ErrInvalidData // Or custom error "Not enough questions"
	}

	// 5. Shuffle & Pick
	rand.Seed(time.Now().UnixNano())
	shuffle := func(qs []models.QuestionBank) {
		rand.Shuffle(len(qs), func(i, j int) { qs[i], qs[j] = qs[j], qs[i] })
	}
	shuffle(easyQs)
	shuffle(medQs)
	shuffle(hardQs)

	// 6. Insert Logic
	questionsToInsert := []models.Question{}
	addQs := func(source []models.QuestionBank, count int, points int, negPoints float64) {
		for i := 0; i < count; i++ {
			qb := source[i]
			finalNeg := 0.0
			if req.EnableNegativeMarking {
				finalNeg = negPoints
			}
			questionsToInsert = append(questionsToInsert, models.Question{
				ExamID:         examID,
				QuestionText:   qb.QuestionText,
				Type:           qb.Type,
				OptionA:        qb.Option1,
				OptionB:        qb.Option2,
				OptionC:        qb.Option3,
				OptionD:        qb.Option4,
				CorrectAnswer:  qb.Correct,
				Points:         points,
				NegativePoints: finalNeg,
				Complexity:     qb.Complexity,
			})
		}
	}

	addQs(easyQs, needEasy, req.PointsConfig.Easy, req.NegativeConfig.Easy)
	addQs(medQs, needMedium, req.PointsConfig.Medium, req.NegativeConfig.Medium)
	addQs(hardQs, needHard, req.PointsConfig.Hard, req.NegativeConfig.Hard)

	// Save
	for i := range questionsToInsert {
		questionsToInsert[i].OrderNumber = i + 1
		if err := tx.Create(&questionsToInsert[i]).Error; err != nil {
			return err
		}
	}

	return nil
}

// ----------------------
// UNIFIED HANDLERS
// ----------------------

// POST /api/admin/exams
// Handles both "Manual Setup" (if TotalQuestions=0) and "From Bank" (if TotalQuestions>0)
func CreateExam(c *gin.Context) {
	var req ExamUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get Admin ID
	uidVal, _ := c.Get("userID")
	adminIDStr, _ := uidVal.(string)
	adminID, _ := uuid.Parse(adminIDStr)

	exam := models.Exam{
		Title:                 req.Title,
		Description:           req.Description,
		DurationMinutes:       req.DurationMinutes,
		PassingScore:          req.PassingScore,
		Subject:               req.Subject,
		CreatedByID:           adminID,
		StartTime:             req.StartTime.In(istLocation), // Ensure you have istLocation defined globally or locally
		EnableNegativeMarking: req.EnableNegativeMarking,
		NegativeMarkEasy:      req.NegativeConfig.Easy,
		NegativeMarkMedium:    req.NegativeConfig.Medium,
		NegativeMarkHard:      req.NegativeConfig.Hard,
		IsActive:              true, // Default active on create
	}

	if req.IsActive != nil {
		exam.IsActive = *req.IsActive
	}
	if exam.DurationMinutes > 0 {
		exam.EndTime = exam.StartTime.Add(time.Duration(exam.DurationMinutes) * time.Minute)
	}

	// Transaction: Create Exam -> Generate Questions
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&exam).Error; err != nil {
			return err
		}

		// Only generate if configuration is present
		if req.TotalQuestions > 0 {
			if err := generateQuestionsFromBank(tx, exam.ID, req); err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to create exam: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Exam created successfully", "id": exam.ID})
}

// PUT /api/admin/exams/:id
// Updates metadata. If generation config is present, REGENERATES questions.
func UpdateExam(c *gin.Context) {
	id := c.Param("id")
	var req ExamUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var exam models.Exam
	if err := database.DB.First(&exam, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exam not found"})
		return
	}

	// Update Metadata
	exam.Title = req.Title
	exam.Description = req.Description
	exam.Subject = req.Subject
	exam.DurationMinutes = req.DurationMinutes
	exam.PassingScore = req.PassingScore
	exam.StartTime = req.StartTime.In(istLocation)
	exam.EnableNegativeMarking = req.EnableNegativeMarking
	exam.NegativeMarkEasy = req.NegativeConfig.Easy
	exam.NegativeMarkMedium = req.NegativeConfig.Medium
	exam.NegativeMarkHard = req.NegativeConfig.Hard

	if req.IsActive != nil {
		exam.IsActive = *req.IsActive
	}
	if exam.DurationMinutes > 0 {
		exam.EndTime = exam.StartTime.Add(time.Duration(exam.DurationMinutes) * time.Minute)
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&exam).Error; err != nil {
			return err
		}

		// If generation config is provided, DELETE OLD and REGENERATE
		if req.TotalQuestions > 0 {
			// Wipe old questions
			if err := tx.Where("exam_id = ?", exam.ID).Delete(&models.Question{}).Error; err != nil {
				return err
			}
			// Generate new ones
			if err := generateQuestionsFromBank(tx, exam.ID, req); err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update exam: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Exam updated successfully"})
}

func ExamBankPreview(c *gin.Context) {
	var req ExamPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Subject == "" || req.TotalQuestions <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "subject and total_questions required"})
		return
	}

	// load questions matching subject + topics
	var bank []models.QuestionBank
	query := database.DB.Where("subject = ?", req.Subject)
	if len(req.Topics) > 0 {
		query = query.Where("topic IN ?", req.Topics)
	}
	if err := query.Find(&bank).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load question bank"})
		return
	}

	if len(bank) < req.TotalQuestions {
		c.JSON(http.StatusOK, ExamPreviewResponse{
			Possible: false,
			Error:    "Not enough total questions in bank",
		})
		return
	}

	// difficulty buckets
	easy := 0
	medium := 0
	hard := 0
	byTopic := map[string]int{}

	for _, q := range bank {
		byTopic[q.Topic]++
		switch strings.ToLower(q.Complexity) {
		case "easy":
			easy++
		case "medium":
			medium++
		case "hard":
			hard++
		}
	}

	needEasy := req.TotalQuestions * req.Difficulty.Easy / 100
	needMedium := req.TotalQuestions * req.Difficulty.Medium / 100
	needHard := req.TotalQuestions - needEasy - needMedium

	if easy < needEasy {
		c.JSON(http.StatusOK, ExamPreviewResponse{
			Possible: false,
			Error:    "Not enough EASY questions in bank",
		})
		return
	}
	if medium < needMedium {
		c.JSON(http.StatusOK, ExamPreviewResponse{
			Possible: false,
			Error:    "Not enough MEDIUM questions in bank",
		})
		return
	}
	if hard < needHard {
		c.JSON(http.StatusOK, ExamPreviewResponse{
			Possible: false,
			Error:    "Not enough HARD questions in bank",
		})
		return
	}

	// topic distribution checks (optional)
	if len(req.TopicDistribution) > 0 {
		for topic, need := range req.TopicDistribution {
			avail := byTopic[topic]
			if avail < need {
				c.JSON(http.StatusOK, ExamPreviewResponse{
					Possible: false,
					Error:    "Not enough questions in topic: " + topic,
				})
				return
			}
		}
	}

	resp := ExamPreviewResponse{Possible: true}
	resp.Available.Easy = easy
	resp.Available.Medium = medium
	resp.Available.Hard = hard
	resp.Available.Total = len(bank)
	resp.Available.Topics = byTopic

	c.JSON(http.StatusOK, resp)
}
