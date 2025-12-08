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

// POST /api/admin/exams/from-bank
// Body: same as preview + regular exam fields (title, description, duration, passing_score, start_time)
type CreateExamFromBankRequest struct {
	ExamPreviewRequest

	Title           string    `json:"title"`
	Description     string    `json:"description"`
	DurationMinutes int       `json:"duration_minutes"`
	PassingScore    int       `json:"passing_score"`
	StartTime       time.Time `json:"start_time"`

	PointsConfig struct {
		Easy   int `json:"easy"`
		Medium int `json:"medium"`
		Hard   int `json:"hard"`
	} `json:"points_config"`
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "No questions available for this selection"})
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

	// 3. Calculate requirements
	total := req.TotalQuestions
	needEasy := total * req.Difficulty.Easy / 100
	needMedium := total * req.Difficulty.Medium / 100
	needHard := total - needEasy - needMedium // Remainder goes to Hard to ensure sum matches total

	// 4. Validate counts
	if len(easyQs) < needEasy || len(medQs) < needMedium || len(hardQs) < needHard {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Not enough questions in the bank for this difficulty distribution"})
		return
	}

	// 5. Randomize (Shuffle)
	rand.Seed(time.Now().UnixNano())
	shuffle := func(qs []models.QuestionBank) {
		rand.Shuffle(len(qs), func(i, j int) {
			qs[i], qs[j] = qs[j], qs[i]
		})
	}
	shuffle(easyQs)
	shuffle(medQs)
	shuffle(hardQs)

	// 6. Create Exam Record
	uidVal, _ := c.Get("userID") // Use "userID" to match middleware key
	adminIDStr, _ := uidVal.(string)
	adminID, _ := uuid.Parse(adminIDStr)

	// Defaults for points if not provided
	if req.PointsConfig.Easy == 0 {
		req.PointsConfig.Easy = 1
	}
	if req.PointsConfig.Medium == 0 {
		req.PointsConfig.Medium = 2
	}
	if req.PointsConfig.Hard == 0 {
		req.PointsConfig.Hard = 3
	}

	exam := models.Exam{
		Title:           req.Title,
		Description:     req.Description,
		DurationMinutes: req.DurationMinutes,
		PassingScore:    req.PassingScore,
		CreatedByID:     adminID,
		StartTime:       req.StartTime.In(istLocation),
	}
	if exam.DurationMinutes > 0 {
		exam.EndTime = exam.StartTime.Add(time.Duration(exam.DurationMinutes) * time.Minute)
	}

	if err := database.DB.Create(&exam).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create exam record"})
		return
	}

	// 7. Insert Questions into Exam
	questionsToInsert := []models.Question{}

	addQs := func(source []models.QuestionBank, count int, points int) {
		for i := 0; i < count; i++ {
			qb := source[i]
			questionsToInsert = append(questionsToInsert, models.Question{
				ExamID:        exam.ID,
				QuestionText:  qb.QuestionText,
				OptionA:       qb.Option1,
				OptionB:       qb.Option2,
				OptionC:       qb.Option3,
				OptionD:       qb.Option4,
				CorrectAnswer: qb.Correct,
				Points:        points,
				OrderNumber:   0, // Will assign index later if needed, or let DB handle it
			})
		}
	}

	addQs(easyQs, needEasy, req.PointsConfig.Easy)
	addQs(medQs, needMedium, req.PointsConfig.Medium)
	addQs(hardQs, needHard, req.PointsConfig.Hard)

	// Batch insert for performance
	// Note: You might want to assign OrderNumber i here
	for i := range questionsToInsert {
		questionsToInsert[i].OrderNumber = i + 1
		database.DB.Create(&questionsToInsert[i])
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "Exam generated successfully",
		"exam_id":         exam.ID,
		"total_questions": len(questionsToInsert),
	})
}
