package controllers

import (
	"exam-backend/database"
	"exam-backend/models"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

//
// 1. UPLOAD QUESTION BANK (EXCEL)
//

func UploadQuestionBank(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot open file"})
		return
	}
	defer f.Close()

	// Parse Excel
	xlsx, err := excelize.OpenReader(f)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid excel format"})
		return
	}

	rows, err := xlsx.GetRows("Sheet1")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read Sheet1"})
		return
	}

	// Skip header
	for i, r := range rows {
		if i == 0 {
			continue
		}
		if len(r) < 10 {
			continue
		}

		qb := models.QuestionBank{
			Subject:      r[0],
			Complexity:   strings.ToLower(r[1]),
			Topic:        r[2],
			Type:         strings.ToLower(r[3]),
			QuestionText: r[4],
			Option1:      r[5],
			Option2:      r[6],
			Option3:      r[7],
			Option4:      r[8],
			Correct:      r[9],
		}

		database.DB.Create(&qb)
	}

	c.JSON(http.StatusOK, gin.H{"message": "question bank uploaded"})
}

//
// 2. GET QUESTION BANK LIST
//

func GetQuestionBank(c *gin.Context) {
	var list []models.QuestionBank

	subject := c.Query("subject")
	topic := c.Query("topic")

	q := database.DB.Model(&models.QuestionBank{})

	if subject != "" {
		q = q.Where("subject = ?", subject)
	}
	if topic != "" {
		q = q.Where("topic = ?", topic)
	}

	if err := q.Order("id desc").Find(&list).Error; err != nil {
		c.JSON(500, gin.H{"error": "cannot fetch question bank"})
		return
	}

	c.JSON(200, list)
}

//
// 3. UPDATE QUESTION BANK ROW
//

func UpdateQuestionBankRow(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "invalid ID"})
		return
	}

	var row models.QuestionBank
	if err := database.DB.First(&row, id).Error; err != nil {
		c.JSON(404, gin.H{"error": "row not found"})
		return
	}

	var input models.QuestionBank
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	row.Subject = input.Subject
	row.Complexity = strings.ToLower(input.Complexity)
	row.Topic = input.Topic
	row.Type = input.Type
	row.QuestionText = input.QuestionText
	row.Option1 = input.Option1
	row.Option2 = input.Option2
	row.Option3 = input.Option3
	row.Option4 = input.Option4
	row.Correct = input.Correct

	if err := database.DB.Save(&row).Error; err != nil {
		c.JSON(500, gin.H{"error": "update failed"})
		return
	}

	c.JSON(200, row)
}

//
// 4. DELETE QUESTION BANK ROW
//

func DeleteQuestionBankRow(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "invalid ID"})
		return
	}

	if err := database.DB.Delete(&models.QuestionBank{}, id).Error; err != nil {
		c.JSON(500, gin.H{"error": "delete failed"})
		return
	}

	c.JSON(200, gin.H{"message": "deleted"})
}

//
// 5. TOPIC-WISE DIFFICULTY ANALYTICS
//

type TopicAnalytics struct {
	Topic  string `json:"topic"`
	Easy   int    `json:"easy"`
	Medium int    `json:"medium"`
	Hard   int    `json:"hard"`
	Total  int    `json:"total"`
}

type OverallAnalytics struct {
	Easy   int `json:"easy"`
	Medium int `json:"medium"`
	Hard   int `json:"hard"`
	Total  int `json:"total"`
}

func GetQuestionBankAnalytics(c *gin.Context) {
	subject := c.Query("subject")

	var qb []models.QuestionBank
	q := database.DB.Model(&models.QuestionBank{})

	if subject != "" {
		q = q.Where("subject = ?", subject)
	}

	if err := q.Find(&qb).Error; err != nil {
		c.JSON(500, gin.H{"error": "cannot load analytics"})
		return
	}

	byTopic := map[string]*TopicAnalytics{}
	overall := OverallAnalytics{}

	for _, q := range qb {
		topic := q.Topic
		if topic == "" {
			topic = "Uncategorized"
		}

		if _, ok := byTopic[topic]; !ok {
			byTopic[topic] = &TopicAnalytics{Topic: topic}
		}

		entry := byTopic[topic]
		entry.Total++
		overall.Total++

		switch strings.ToLower(q.Complexity) {
		case "easy":
			entry.Easy++
			overall.Easy++
		case "medium":
			entry.Medium++
			overall.Medium++
		case "hard":
			entry.Hard++
			overall.Hard++
		}
	}

	var result []TopicAnalytics
	for _, v := range byTopic {
		result = append(result, *v)
	}

	c.JSON(200, gin.H{
		"by_topic": result,
		"overall":  overall,
	})
}
