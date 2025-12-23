package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type QuestionBank struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	TeacherID    uuid.UUID      `gorm:"type:uuid;index" json:"teacher_id"`
	Subject      string         `gorm:"size:100;index" json:"subject"`
	Topic        string         `gorm:"size:100;index" json:"topic"`
	Complexity   string         `gorm:"size:20;index" json:"complexity"` // "easy","medium","hard"
	Type         string         `gorm:"size:50" json:"type"`             // "single-choice","multi-select","true-false","descriptive"
	QuestionText string         `gorm:"type:text" json:"question_text"`
	Option1      string         `gorm:"type:text" json:"option1"`
	Option2      string         `gorm:"type:text" json:"option2"`
	Option3      string         `gorm:"type:text" json:"option3"`
	Option4      string         `gorm:"type:text" json:"option4"`
	Correct      string         `gorm:"type:text" json:"correct"` // for multi-select: "A,C" etc.
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (q *QuestionBank) BeforeCreate(tx *gorm.DB) (err error) {
	if q.ID == uuid.Nil {
		q.ID = uuid.New()
	}
	return
}
