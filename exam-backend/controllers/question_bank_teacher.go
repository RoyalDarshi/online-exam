package controllers

import (
	"exam-backend/database"
	"exam-backend/models"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
)

// helper: get current teacher id
func currentUserUUID(c *gin.Context) (uuid.UUID, error) {
	uidVal, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, gin.Error{}
	}
	uidStr, ok := uidVal.(string)
	if !ok {
		return uuid.Nil, gin.Error{}
	}
	return uuid.Parse(uidStr)
}

// POST /api/teacher/question-bank/upload (xlsx with header)
func TeacherUploadQuestionBank(c *gin.Context) {
	teacherID := c.GetString("userID") // From JWT

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
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

	// Skip header row
	for i, row := range rows {
		if i == 0 {
			continue
		}

		qb := models.QuestionBank{
			ID:           uuid.New(),
			TeacherID:    uuid.MustParse(teacherID),
			Subject:      safe(row, 0),
			Complexity:   safe(row, 1),
			Topic:        safe(row, 2),
			Type:         safe(row, 3),
			QuestionText: safe(row, 4),
			Option1:      safe(row, 5),
			Option2:      safe(row, 6),
			Option3:      safe(row, 7),
			Option4:      safe(row, 8),
			Correct:      safe(row, 9),
		}

		if err := database.DB.Create(&qb).Error; err != nil {
			fmt.Println("Insert error:", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Uploaded successfully"})
}

func safe(row []string, idx int) string {
	if idx >= len(row) {
		return ""
	}
	return row[idx]
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
