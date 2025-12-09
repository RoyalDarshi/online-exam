package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Email     string    `gorm:"uniqueIndex;not null" json:"email"`
	Password  string    `json:"-"`
	FullName  string    `json:"full_name"`
	Role      string    `gorm:"default:'student'" json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}

type Exam struct {
	ID              uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	DurationMinutes int       `json:"duration_minutes"`
	PassingScore    int       `json:"passing_score"`
	IsActive        bool      `gorm:"default:true" json:"is_active"`

	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`

	// --- NEGATIVE MARKING FIELDS (FLATTENED) ---
	EnableNegativeMarking bool    `json:"enable_negative_marking"`
	NegativeMarkEasy      float64 `json:"negative_mark_easy"`
	NegativeMarkMedium    float64 `json:"negative_mark_medium"`
	NegativeMarkHard      float64 `json:"negative_mark_hard"`

	CreatedByID uuid.UUID  `json:"created_by"`
	CreatedAt   time.Time  `json:"created_at"`
	Questions   []Question `gorm:"foreignKey:ExamID;constraint:OnDelete:CASCADE;" json:"questions,omitempty"`
}

func (e *Exam) BeforeCreate(tx *gorm.DB) (err error) {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return
}

type Question struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ExamID        uuid.UUID `json:"exam_id"`
	Type          string    `json:"type"` // NEW: "single-choice" or "multi-select"
	QuestionText  string    `json:"question_text"`
	OptionA       string    `json:"option_a"`
	OptionB       string    `json:"option_b"`
	OptionC       string    `json:"option_c"`
	OptionD       string    `json:"option_d"`
	CorrectAnswer string    `json:"correct_answer"`

	Points         int     `json:"points"`          // Score for correct answer
	NegativePoints float64 `json:"negative_points"` // Deduction for wrong answer (NEW)

	OrderNumber int `json:"order_number"`
}

func (q *Question) BeforeCreate(tx *gorm.DB) (err error) {
	if q.ID == uuid.Nil {
		q.ID = uuid.New()
	}
	return
}

// ... ExamAttempt and QuestionInput remain the same ...
type ExamAttempt struct {
	ID uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`

	ExamID uuid.UUID `json:"exam_id"`
	Exam   Exam      `gorm:"foreignKey:ExamID" json:"exam"`

	StudentID uuid.UUID `json:"student_id"`
	Student   User      `gorm:"foreignKey:StudentID" json:"student,omitempty"`

	StartedAt   time.Time  `json:"started_at"`
	SubmittedAt *time.Time `json:"submitted_at"`
	Score       int        `json:"score"`
	TotalPoints int        `json:"total_points"`
	Passed      bool       `json:"passed"`

	IsTerminated      bool   `gorm:"default:false" json:"is_terminated"`
	TerminationReason string `json:"termination_reason"`

	TabSwitches int               `json:"tab_switches"`
	Answers     map[string]string `gorm:"serializer:json" json:"answers"`
	Snapshots   []string          `gorm:"serializer:json" json:"snapshots"`

	TimeLeftSeconds int `gorm:"-" json:"time_left"`
}

type QuestionInput struct {
	QuestionText  string `json:"question_text"`
	OptionA       string `json:"option_a"`
	OptionB       string `json:"option_b"`
	OptionC       string `json:"option_c"`
	OptionD       string `json:"option_d"`
	CorrectAnswer string `json:"correct_answer"`
	Points        int    `json:"points"`
	OrderNumber   int    `json:"order_number"`
}

func (ea *ExamAttempt) BeforeCreate(tx *gorm.DB) (err error) {
	if ea.ID == uuid.Nil {
		ea.ID = uuid.New()
	}
	return
}
