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

type SubjectSummary struct {
	Subject string `json:"subject"`
	Count   int    `json:"count"`
}

type TopicSummary struct {
	Topic  string `json:"topic"`
	Easy   int    `json:"easy"`
	Medium int    `json:"medium"`
	Hard   int    `json:"hard"`
	Total  int    `json:"total"`
}

// GET /api/admin/bank/subjects
func AdminGetSubjects(c *gin.Context) {
	rows := []SubjectSummary{}
	if err := database.DB.Model(&models.QuestionBank{}).
		Select("subject, COUNT(*) as count").
		Group("subject").
		Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load subjects"})
		return
	}
	c.JSON(http.StatusOK, rows)
}

// GET /api/admin/bank/subjects/:subject/topics
func AdminGetTopicsForSubject(c *gin.Context) {
	subject := c.Param("subject")
	var records []models.QuestionBank
	if err := database.DB.Where("subject = ?", subject).Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load topics"})
		return
	}

	byTopic := map[string]*TopicSummary{}
	for _, q := range records {
		t := q.Topic
		if t == "" {
			t = "Uncategorized"
		}
		entry, ok := byTopic[t]
		if !ok {
			entry = &TopicSummary{Topic: t}
			byTopic[t] = entry
		}
		entry.Total++
		switch strings.ToLower(q.Complexity) {
		case "easy":
			entry.Easy++
		case "medium":
			entry.Medium++
		case "hard":
			entry.Hard++
		}
	}

	out := make([]TopicSummary, 0, len(byTopic))
	for _, v := range byTopic {
		out = append(out, *v)
	}
	c.JSON(http.StatusOK, out)
}

// -------------- PREVIEW & CREATE EXAM --------------

type ExamPreviewRequest struct {
	Subject string   `json:"subject"`
	Topics  []string `json:"topics"`

	TotalQuestions int `json:"total_questions"`

	Difficulty struct {
		Easy   int `json:"easy"`
		Medium int `json:"medium"`
		Hard   int `json:"hard"`
	} `json:"difficulty"`

	// optional: per-topic desired counts
	TopicDistribution map[string]int `json:"topic_distribution"`
}

type ExamPreviewResponse struct {
	Possible  bool   `json:"possible"`
	Error     string `json:"error,omitempty"`
	Available struct {
		Easy   int            `json:"easy"`
		Medium int            `json:"medium"`
		Hard   int            `json:"hard"`
		Total  int            `json:"total"`
		Topics map[string]int `json:"topics"`
	} `json:"available"`
}

// POST /api/admin/exams/preview
// func ExamBankPreview(c *gin.Context) {
// 	var req ExamPreviewRequest
// 	if err := c.ShouldBindJSON(&req); err != nil {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
// 		return
// 	}
// 	if req.Subject == "" || req.TotalQuestions <= 0 {
// 		c.JSON(http.StatusBadRequest, gin.H{"error": "subject and total_questions required"})
// 		return
// 	}

// 	// load questions matching subject + topics
// 	var bank []models.QuestionBank
// 	query := database.DB.Where("subject = ?", req.Subject)
// 	if len(req.Topics) > 0 {
// 		query = query.Where("topic IN ?", req.Topics)
// 	}
// 	if err := query.Find(&bank).Error; err != nil {
// 		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load question bank"})
// 		return
// 	}

// 	if len(bank) < req.TotalQuestions {
// 		c.JSON(http.StatusOK, ExamPreviewResponse{
// 			Possible: false,
// 			Error:    "Not enough total questions in bank",
// 		})
// 		return
// 	}

// 	// difficulty buckets
// 	easy := 0
// 	medium := 0
// 	hard := 0
// 	byTopic := map[string]int{}

// 	for _, q := range bank {
// 		byTopic[q.Topic]++
// 		switch strings.ToLower(q.Complexity) {
// 		case "easy":
// 			easy++
// 		case "medium":
// 			medium++
// 		case "hard":
// 			hard++
// 		}
// 	}

// 	needEasy := req.TotalQuestions * req.Difficulty.Easy / 100
// 	needMedium := req.TotalQuestions * req.Difficulty.Medium / 100
// 	needHard := req.TotalQuestions - needEasy - needMedium

// 	if easy < needEasy {
// 		c.JSON(http.StatusOK, ExamPreviewResponse{
// 			Possible: false,
// 			Error:    "Not enough EASY questions in bank",
// 		})
// 		return
// 	}
// 	if medium < needMedium {
// 		c.JSON(http.StatusOK, ExamPreviewResponse{
// 			Possible: false,
// 			Error:    "Not enough MEDIUM questions in bank",
// 		})
// 		return
// 	}
// 	if hard < needHard {
// 		c.JSON(http.StatusOK, ExamPreviewResponse{
// 			Possible: false,
// 			Error:    "Not enough HARD questions in bank",
// 		})
// 		return
// 	}

// 	// topic distribution checks (optional)
// 	if len(req.TopicDistribution) > 0 {
// 		for topic, need := range req.TopicDistribution {
// 			avail := byTopic[topic]
// 			if avail < need {
// 				c.JSON(http.StatusOK, ExamPreviewResponse{
// 					Possible: false,
// 					Error:    "Not enough questions in topic: " + topic,
// 				})
// 				return
// 			}
// 		}
// 	}

// 	resp := ExamPreviewResponse{Possible: true}
// 	resp.Available.Easy = easy
// 	resp.Available.Medium = medium
// 	resp.Available.Hard = hard
// 	resp.Available.Total = len(bank)
// 	resp.Available.Topics = byTopic

// 	c.JSON(http.StatusOK, resp)
// }

// POST /api/admin/exams/from-bank
// Body: same as preview + regular exam fields (title, description, duration, passing_score, start_time)
type CreateExamFromBankRequest struct {
	ExamPreviewRequest

	Title           string    `json:"title"`
	Description     string    `json:"description"`
	DurationMinutes int       `json:"duration_minutes"`
	PassingScore    int       `json:"passing_score"`
	StartTime       time.Time `json:"start_time"`
	Subject         string    `json:"subject"`

	PointsConfig struct {
		Easy   int `json:"easy"`
		Medium int `json:"medium"`
		Hard   int `json:"hard"`
	} `json:"points_config"`

	// Receive nested JSON from frontend
	EnableNegativeMarking bool `json:"enable_negative_marking"`
	NegativeConfig        struct {
		Easy   float64 `json:"easy"`
		Medium float64 `json:"medium"`
		Hard   float64 `json:"hard"`
	} `json:"negative_config"`
}

func CreateExamFromBank(c *gin.Context) {
	var req CreateExamFromBankRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Fetch Questions
	var bank []models.QuestionBank
	query := database.DB.Where("subject = ?", req.Subject)
	if len(req.Topics) > 0 {
		query = query.Where("topic IN ?", req.Topics)
	}
	if err := query.Find(&bank).Error; err != nil || len(bank) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No questions available"})
		return
	}

	// 2. Filter by Complexity
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

	// 3. Validation
	total := req.TotalQuestions
	needEasy := total * req.Difficulty.Easy / 100
	needMedium := total * req.Difficulty.Medium / 100
	needHard := total - needEasy - needMedium

	if len(easyQs) < needEasy || len(medQs) < needMedium || len(hardQs) < needHard {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Not enough questions for this distribution"})
		return
	}

	// 4. Shuffle
	rand.Seed(time.Now().UnixNano())
	shuffle := func(qs []models.QuestionBank) {
		rand.Shuffle(len(qs), func(i, j int) { qs[i], qs[j] = qs[j], qs[i] })
	}
	shuffle(easyQs)
	shuffle(medQs)
	shuffle(hardQs)

	// 5. Create Exam (Map nested JSON to Flat DB Columns)
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
		StartTime:             req.StartTime.In(istLocation),
		EnableNegativeMarking: req.EnableNegativeMarking,
		// Map Flat Fields
		NegativeMarkEasy:   req.NegativeConfig.Easy,
		NegativeMarkMedium: req.NegativeConfig.Medium,
		NegativeMarkHard:   req.NegativeConfig.Hard,
	}

	if exam.DurationMinutes > 0 {
		exam.EndTime = exam.StartTime.Add(time.Duration(exam.DurationMinutes) * time.Minute)
	}

	if err := database.DB.Create(&exam).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create exam"})
		return
	}

	// 6. Insert Questions (Assign specific NegativePoints)
	questionsToInsert := []models.Question{}

	addQs := func(source []models.QuestionBank, count int, points int, negPoints float64) {
		for i := 0; i < count; i++ {
			qb := source[i]

			finalNeg := 0.0
			if req.EnableNegativeMarking {
				finalNeg = negPoints
			}

			questionsToInsert = append(questionsToInsert, models.Question{
				ExamID:         exam.ID,
				QuestionText:   qb.QuestionText,
				Type:           qb.Type,
				OptionA:        qb.Option1,
				OptionB:        qb.Option2,
				OptionC:        qb.Option3,
				OptionD:        qb.Option4,
				CorrectAnswer:  qb.Correct,
				Points:         points,
				NegativePoints: finalNeg, // Store specific penalty
				OrderNumber:    0,
				Complexity:     qb.Complexity,
			})
		}
	}

	// Use config values for points and negative marks
	addQs(easyQs, needEasy, req.PointsConfig.Easy, req.NegativeConfig.Easy)
	addQs(medQs, needMedium, req.PointsConfig.Medium, req.NegativeConfig.Medium)
	addQs(hardQs, needHard, req.PointsConfig.Hard, req.NegativeConfig.Hard)

	for i := range questionsToInsert {
		questionsToInsert[i].OrderNumber = i + 1
		database.DB.Create(&questionsToInsert[i])
	}

	c.JSON(http.StatusOK, gin.H{"message": "Exam generated", "exam_id": exam.ID})
}

// PUT /api/admin/exams/:id/regenerate
func RegenerateExam(c *gin.Context) {
	id := c.Param("id")
	var req CreateExamFromBankRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Find Existing Exam
	var exam models.Exam
	if err := database.DB.First(&exam, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exam not found"})
		return
	}

	// 2. Validate Bank Availability (Same logic as Create)
	var bank []models.QuestionBank
	query := database.DB.Where("subject = ?", req.Subject)
	if len(req.Topics) > 0 {
		query = query.Where("topic IN ?", req.Topics)
	}
	if err := query.Find(&bank).Error; err != nil || len(bank) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No questions available for this subject"})
		return
	}

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

	total := req.TotalQuestions
	needEasy := total * req.Difficulty.Easy / 100
	needMedium := total * req.Difficulty.Medium / 100
	needHard := total - needEasy - needMedium

	if len(easyQs) < needEasy || len(medQs) < needMedium || len(hardQs) < needHard {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Not enough questions in bank for this distribution"})
		return
	}

	// 3. Shuffle
	rand.Seed(time.Now().UnixNano())
	shuffle := func(qs []models.QuestionBank) {
		rand.Shuffle(len(qs), func(i, j int) { qs[i], qs[j] = qs[j], qs[i] })
	}
	shuffle(easyQs)
	shuffle(medQs)
	shuffle(hardQs)

	// 4. Update Exam Metadata
	exam.Title = req.Title
	exam.Description = req.Description
	exam.Subject = req.Subject
	exam.DurationMinutes = req.DurationMinutes
	exam.PassingScore = req.PassingScore
	exam.StartTime = req.StartTime.In(istLocation)
	if exam.DurationMinutes > 0 {
		exam.EndTime = exam.StartTime.Add(time.Duration(exam.DurationMinutes) * time.Minute)
	}

	// Update Negative Marking Config
	exam.EnableNegativeMarking = req.EnableNegativeMarking
	exam.NegativeMarkEasy = req.NegativeConfig.Easy
	exam.NegativeMarkMedium = req.NegativeConfig.Medium
	exam.NegativeMarkHard = req.NegativeConfig.Hard

	// 5. Transaction: Save Exam + Replace Questions
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&exam).Error; err != nil {
			return err
		}

		// DELETE OLD QUESTIONS
		if err := tx.Where("exam_id = ?", exam.ID).Delete(&models.Question{}).Error; err != nil {
			return err
		}

		// INSERT NEW QUESTIONS
		questionsToInsert := []models.Question{}
		addQs := func(source []models.QuestionBank, count int, points int, negPoints float64) {
			for i := 0; i < count; i++ {
				qb := source[i]
				finalNeg := 0.0
				if req.EnableNegativeMarking {
					finalNeg = negPoints
				}
				questionsToInsert = append(questionsToInsert, models.Question{
					ExamID:         exam.ID,
					QuestionText:   qb.QuestionText,
					Type:           qb.Type,
					OptionA:        qb.Option1,
					OptionB:        qb.Option2,
					OptionC:        qb.Option3,
					OptionD:        qb.Option4,
					CorrectAnswer:  qb.Correct,
					Points:         points,
					NegativePoints: finalNeg,
					OrderNumber:    0,
					Complexity:     qb.Complexity,
				})
			}
		}

		addQs(easyQs, needEasy, req.PointsConfig.Easy, req.NegativeConfig.Easy)
		addQs(medQs, needMedium, req.PointsConfig.Medium, req.NegativeConfig.Medium)
		addQs(hardQs, needHard, req.PointsConfig.Hard, req.NegativeConfig.Hard)

		for i := range questionsToInsert {
			questionsToInsert[i].OrderNumber = i + 1
			if err := tx.Create(&questionsToInsert[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update exam"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Exam updated and regenerated successfully"})
}
