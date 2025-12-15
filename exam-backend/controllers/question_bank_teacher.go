package controllers

import (
	"exam-backend/database"
	"exam-backend/models"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

// helper: get current teacher id
// func currentUserUUID(c *gin.Context) (uuid.UUID, error) {
// 	uidVal, exists := c.Get("user_id")
// 	if !exists {
// 		return uuid.Nil, gin.Error{}
// 	}
// 	uidStr, ok := uidVal.(string)
// 	if !ok {
// 		return uuid.Nil, gin.Error{}
// 	}
// 	return uuid.Parse(uidStr)
// }

// POST /api/teacher/question-bank/upload (xlsx with header)
func TeacherUploadQuestionBank(c *gin.Context) {
	teacherID := c.GetString("userID")

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cannot open file"})
		return
	}
	defer f.Close()

	xl, err := excelize.OpenReader(f)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Excel file"})
		return
	}

	sheet := xl.GetSheetName(0)
	rows, err := xl.GetRows(sheet)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read sheet"})
		return
	}

	var questionsToInsert []models.QuestionBank

	// 1. Parse and Validate all rows in memory first
	for i, row := range rows {
		if i == 0 {
			continue // Skip header
		}

		// Helper to normalize strings
		clean := func(idx int) string {
			return strings.TrimSpace(safe(row, idx))
		}

		qb := models.QuestionBank{
			ID:           uuid.New(),
			TeacherID:    uuid.MustParse(teacherID),
			Subject:      clean(0),
			Complexity:   strings.ToLower(clean(1)),
			Topic:        clean(2),
			Type:         strings.ToLower(clean(3)),
			QuestionText: clean(4),
			Option1:      clean(5),
			Option2:      clean(6),
			Option3:      clean(7),
			Option4:      clean(8),
			Correct:      clean(9),
		}

		// Server-side Logic Validation
		if err := validateQuestion(&qb, i+1); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		questionsToInsert = append(questionsToInsert, qb)
	}

	if len(questionsToInsert) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File contains no data rows"})
		return
	}

	// 2. Batch Insert with Transaction
	// If any insertion fails, the whole batch is rolled back.
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.CreateInBatches(questionsToInsert, 100).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Successfully imported %d questions", len(questionsToInsert)),
	})
}

// Helper: safe slice access
func safe(row []string, idx int) string {
	if idx >= len(row) {
		return ""
	}
	return row[idx]
}

// Helper: Business Logic Validation
func validateQuestion(q *models.QuestionBank, rowNum int) error {
	if q.Subject == "" || q.Topic == "" || q.QuestionText == "" {
		return fmt.Errorf("row %d: missing required fields (subject, topic, or question)", rowNum)
	}

	// Validate Complexity
	switch q.Complexity {
	case "easy", "medium", "hard":
		// OK
	default:
		return fmt.Errorf("row %d: invalid complexity '%s'. use easy, medium, or hard", rowNum, q.Complexity)
	}

	// Validate Type logic
	switch q.Type {
	case "single-choice", "multi-select":
		if q.Option1 == "" || q.Option2 == "" {
			return fmt.Errorf("row %d: mcq requires at least option 1 and option 2", rowNum)
		}
		if q.Correct == "" {
			return fmt.Errorf("row %d: answer key missing", rowNum)
		}
	case "true-false":
		lowerCorrect := strings.ToLower(q.Correct)
		if lowerCorrect != "true" && lowerCorrect != "false" {
			return fmt.Errorf("row %d: true/false answer must be 'true' or 'false'", rowNum)
		}
	case "descriptive":
		// Descriptive just needs the question text (checked above)
	default:
		return fmt.Errorf("row %d: invalid type '%s'", rowNum, q.Type)
	}

	return nil
}

// GET /api/teacher/question-bank
func TeacherGetQuestionBank(c *gin.Context) {
	teacherID := c.GetString("userID")

	var list []models.QuestionBank
	if err := database.DB.
		Where("teacher_id = ?", teacherID).
		Order("created_at DESC").
		Find(&list).Error; err != nil {

		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch"})
		return
	}

	c.JSON(http.StatusOK, list)
}

// PUT /api/teacher/question-bank/:id
func TeacherUpdateQuestion(c *gin.Context) {
	teacherID := c.GetString("userID")
	id := c.Param("id")

	var qb models.QuestionBank
	if err := database.DB.
		Where("id = ? AND teacher_id = ?", id, teacherID).
		First(&qb).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}

	var body struct {
		Subject, Topic, Complexity, Type, QuestionText string
		Option1, Option2, Option3, Option4, Correct    string
	}

	if err := c.BindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid"})
		return
	}

	qb.Subject = body.Subject
	qb.Topic = body.Topic
	qb.Complexity = body.Complexity
	qb.Type = body.Type
	qb.QuestionText = body.QuestionText
	qb.Option1 = body.Option1
	qb.Option2 = body.Option2
	qb.Option3 = body.Option3
	qb.Option4 = body.Option4
	qb.Correct = body.Correct

	database.DB.Save(&qb)

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

// DELETE /api/teacher/question-bank/:id
func TeacherDeleteQuestion(c *gin.Context) {
	teacherID := c.GetString("userID")
	id := c.Param("id")

	if err := database.DB.
		Where("id = ? AND teacher_id = ?", id, teacherID).
		Delete(&models.QuestionBank{}).Error; err != nil {

		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}
