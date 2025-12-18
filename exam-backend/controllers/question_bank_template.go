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

	// Create the sheet (index 0)
	index, _ := f.NewSheet(sheet)
	f.SetActiveSheet(index)

	// 1. Set Headers (Row 1)
	headers := []string{
		"Subject", "Complexity", "Topic", "Type",
		"Question", "A", "B", "C", "D", "Correct",
	}

	// Style: Bold Header
	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "#FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#4F81BD"}, Pattern: 1},
	})

	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, style)
	}

	// 2. Add Data Validation (Dropdowns)

	// Complexity Dropdown (Column B)
	dvComplexity := excelize.NewDataValidation(true)
	dvComplexity.Sqref = "B2:B1000" // Apply to first 1000 rows
	dvComplexity.SetDropList([]string{"easy", "medium", "hard"})
	if err := f.AddDataValidation(sheet, dvComplexity); err != nil {
		// Log error but continue
	}

	// Type Dropdown (Column D)
	dvType := excelize.NewDataValidation(true)
	dvType.Sqref = "D2:D1000"
	dvType.SetDropList([]string{"single-choice", "multi-select", "true-false"})
	if err := f.AddDataValidation(sheet, dvType); err != nil {
		// Log error
	}

	// 3. Add Example Rows (Instructional)
	examples := []struct {
		Values []string
	}{
		{[]string{"Math", "easy", "Algebra", "single-choice", "What is 2+2?", "4", "3", "5", "6", "A"}},
		{[]string{"Science", "medium", "Physics", "multi-select", "Select SI units", "Meter", "Second", "Liter", "Foot", "A,B"}},
		{[]string{"History", "easy", "World War", "true-false", "WW2 ended in 1945.", "", "", "", "", "True"}},
		// {[]string{"English", "hard", "Essay", "descriptive", "Write about nature.", "", "", "", "", ""}},
	}

	for r, ex := range examples {
		for c, val := range ex.Values {
			cell, _ := excelize.CoordinatesToCellName(c+1, r+2)
			f.SetCellValue(sheet, cell, val)
		}
	}

	// 4. Auto-width columns (approximation)
	f.SetColWidth(sheet, "A", "A", 15) // Subject
	f.SetColWidth(sheet, "B", "B", 12) // Complexity
	f.SetColWidth(sheet, "C", "C", 15) // Topic
	f.SetColWidth(sheet, "D", "D", 15) // Type
	f.SetColWidth(sheet, "E", "E", 40) // Question
	f.SetColWidth(sheet, "F", "I", 15) // Options
	f.SetColWidth(sheet, "J", "J", 20) // Correct

	// Write to buffer
	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate template"})
		return
	}

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=question_bank_template.xlsx")
	c.Data(http.StatusOK, "application/octet-stream", buf.Bytes())
}
