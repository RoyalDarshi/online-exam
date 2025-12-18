package controllers

import (
	"exam-backend/database"
	"exam-backend/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ... [Existing GetExams function remains unchanged] ...
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

func AdminGetExam(c *gin.Context) {
	id := c.Param("id")

	var exam models.Exam
	err := database.DB.
		Preload("Questions", func(db *gorm.DB) *gorm.DB {
			return db.Order("order_number asc")
		}).
		First(&exam, "id = ?", id).Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exam not found"})
		return
	}

	// count questions
	easy := 0
	medium := 0
	hard := 0
	for _, q := range exam.Questions {
		switch q.Complexity {
		case "easy":
			easy++
		case "medium":
			medium++
		case "hard":
			hard++
		}
	}

	response := gin.H{
		"id":               exam.ID,
		"title":            exam.Title,
		"description":      exam.Description,
		"duration_minutes": exam.DurationMinutes,
		"passing_score":    exam.PassingScore,
		"is_active":        exam.IsActive,
		"start_time":       exam.StartTime,
		"end_time":         exam.EndTime,
		"created_by":       exam.CreatedByID,
		"created_at":       exam.CreatedAt,
		"subject":          exam.Subject,

		// Updated to use DB values
		"points_config": gin.H{
			"easy":   exam.MarksEasy,
			"medium": exam.MarksMedium,
			"hard":   exam.MarksHard,
		},

		"negative_config": gin.H{
			"easy":   exam.NegativeMarkEasy,
			"medium": exam.NegativeMarkMedium,
			"hard":   exam.NegativeMarkHard,
		},

		"enable_negative_marking": exam.EnableNegativeMarking,

		"easy_count":   easy,
		"medium_count": medium,
		"hard_count":   hard,

		"total_questions": easy + medium + hard,

		"questions": exam.Questions,
	}

	c.JSON(200, response)
}

// ... [Remainder of existing functions (DeleteExam, etc.) remain unchanged] ...
func DeleteExam(c *gin.Context) {
	id := c.Param("id")

	if err := database.DB.Delete(&models.Exam{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete exam"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Exam deleted"})
}
func GetExamAttempts(c *gin.Context) {
	// ... [Original Implementation] ...
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

	var attempts []models.ExamAttempt
	if err := database.DB.
		Preload("Exam").
		Where("student_id = ?", userID).
		Order("started_at desc").
		Find(&attempts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load attempts"})
		return
	}

	c.JSON(http.StatusOK, attempts)
}
