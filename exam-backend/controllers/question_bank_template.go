package controllers

import (
	"bytes"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

// GET /api/teacher/question-bank/template
func TeacherDownloadTemplate(c *gin.Context) {
	f := excelize.NewFile()
	sheet := "Sheet1"
	f.SetSheetName("Sheet1", sheet)

	// Header row
	headers := []string{
		"subject", "complexity", "topic", "type",
		"question", "option1", "option2", "option3", "option4", "correct",
	}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	// Example rows (5 types)
	examples := [][]string{
		// Single Choice
		{"Math", "easy", "Algebra", "single-choice",
			"What is 2 + 2?", "4", "3", "5", "6", "4"},

		// Multi Select
		{"Science", "medium", "Physics", "multi-select",
			"Which are SI units?", "Meter", "Second", "Horsepower", "Tesla", "Meter,Second,Tesla"},

		// True/False
		{"Biology", "easy", "Cells", "true-false",
			"All cells have a nucleus", "True", "False", "", "", "False"},

		// Descriptive
		{"English", "hard", "Grammar", "descriptive",
			"Explain past perfect tense.", "", "", "", "", ""},

		// Fill in the blanks
		{"History", "medium", "WW2", "fill-blanks",
			"World War II ended in ____.", "", "", "", "", "1945"},
	}

	for r, row := range examples {
		for c, value := range row {
			cell, _ := excelize.CoordinatesToCellName(c+1, r+2)
			f.SetCellValue(sheet, cell, value)
		}
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate template"})
		return
	}

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=question_bank_template.xlsx")
	c.Data(http.StatusOK, "application/octet-stream", buf.Bytes())
}
