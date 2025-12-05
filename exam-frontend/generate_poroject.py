import zipfile
import os

# --- File Contents ---

go_mod_content = """module exam-backend

go 1.21

require (
	github.com/gin-contrib/cors v1.5.0
	github.com/gin-gonic/gin v1.9.1
	github.com/golang-jwt/jwt/v5 v5.2.0
	github.com/google/uuid v1.5.0
	github.com/joho/godotenv v1.5.1
	golang.org/x/crypto v0.17.0
	gorm.io/driver/postgres v1.5.4
	gorm.io/gorm v1.25.5
)
"""

env_content = """DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=exam_db
DB_PORT=5432
JWT_SECRET=supersecretkey_change_this
PORT=8080
"""

main_go_content = """package main

import (
	"exam-backend/controllers"
	"exam-backend/database"
	"exam-backend/middleware"
	"exam-backend/models"
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Note: .env file not found, using system env")
	}

	database.Connect()
	database.DB.AutoMigrate(&models.User{}, &models.Exam{}, &models.Question{}, &models.ExamAttempt{})

	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:5173"} 
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	r.Use(cors.New(config))

	r.POST("/api/auth/register", controllers.Register)
	r.POST("/api/auth/login", controllers.Login)

	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware())
	{
		api.GET("/exams", controllers.GetExams)
		api.GET("/exams/:id", controllers.GetExamDetails)
		api.POST("/attempts", controllers.SubmitAttempt)

		admin := api.Group("/admin")
		admin.Use(middleware.AdminOnly())
		{
			admin.POST("/exams", controllers.CreateExam)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	r.Run(":" + port)
}
"""

db_go_content = """package database

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect() {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Kolkata",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database: ", err)
	}

	fmt.Println("🚀 Database connected successfully")
}
"""

models_go_content = """package models

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
	ID              uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Title           string     `json:"title"`
	Description     string     `json:"description"`
	DurationMinutes int        `json:"duration_minutes"`
	PassingScore    int        `json:"passing_score"`
	IsActive        bool       `gorm:"default:true" json:"is_active"`
	CreatedByID     uuid.UUID  `json:"created_by"`
	CreatedAt       time.Time  `json:"created_at"`
	Questions       []Question `gorm:"foreignKey:ExamID;constraint:OnDelete:CASCADE;" json:"questions,omitempty"`
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
	QuestionText  string    `json:"question_text"`
	OptionA       string    `json:"option_a"`
	OptionB       string    `json:"option_b"`
	OptionC       string    `json:"option_c"`
	OptionD       string    `json:"option_d"`
	CorrectAnswer string    `json:"correct_answer"`
	Points        int       `json:"points"`
	OrderNumber   int       `json:"order_number"`
}

func (q *Question) BeforeCreate(tx *gorm.DB) (err error) {
	if q.ID == uuid.Nil {
		q.ID = uuid.New()
	}
	return
}

type ExamAttempt struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ExamID      uuid.UUID      `json:"exam_id"`
	StudentID   uuid.UUID      `json:"student_id"`
	Student     User           `gorm:"foreignKey:StudentID" json:"student,omitempty"`
	StartedAt   time.Time      `json:"started_at"`
	SubmittedAt *time.Time     `json:"submitted_at"`
	Score       int            `json:"score"`
	TotalPoints int            `json:"total_points"`
	Passed      bool           `json:"passed"`
	TabSwitches int            `json:"tab_switches"`
	Answers     map[string]string `gorm:"serializer:json" json:"answers"`
}

func (ea *ExamAttempt) BeforeCreate(tx *gorm.DB) (err error) {
	if ea.ID == uuid.Nil {
		ea.ID = uuid.New()
	}
	return
}
"""

auth_middleware_content = """package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token required"})
			return
		}

		tokenString = strings.Replace(tokenString, "Bearer ", "", 1)
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(os.Getenv("JWT_SECRET")), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			return
		}

		c.Set("user_id", claims["user_id"])
		c.Set("role", claims["role"])
		c.Next()
	}
}

func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			return
		}
		c.Next()
	}
}
"""

auth_controller_content = """package controllers

import (
	"exam-backend/database"
	"exam-backend/models"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func Register(c *gin.Context) {
	var input models.User
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashed, _ := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	input.Password = string(hashed)

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Could not create user. Email might already exist."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User registered successfully"})
}

func Login(c *gin.Context) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := database.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"role":    user.Role,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
	})

	tokenString, _ := token.SignedString([]byte(os.Getenv("JWT_SECRET")))

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user":  user,
	})
}
"""

exam_controller_content = """package controllers

import (
	"exam-backend/database"
	"exam-backend/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func CreateExam(c *gin.Context) {
	var exam models.Exam
	if err := c.ShouldBindJSON(&exam); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	exam.CreatedByID = userID

	if err := database.DB.Create(&exam).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, exam)
}

func GetExams(c *gin.Context) {
	var exams []models.Exam
	role, _ := c.Get("role")

	query := database.DB
	if role == "student" {
		query = query.Where("is_active = ?", true)
	}
	query.Order("created_at desc").Find(&exams)
	c.JSON(http.StatusOK, exams)
}

func GetExamDetails(c *gin.Context) {
	id := c.Param("id")
	var exam models.Exam
	if err := database.DB.Preload("Questions").First(&exam, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Exam not found"})
		return
	}
	c.JSON(http.StatusOK, exam)
}

func SubmitAttempt(c *gin.Context) {
	var attempt models.ExamAttempt
	if err := c.ShouldBindJSON(&attempt); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	attempt.StudentID = userID
	
	var questions []models.Question
	database.DB.Where("exam_id = ?", attempt.ExamID).Find(&questions)

	score := 0
	totalPoints := 0
	
	for _, q := range questions {
		totalPoints += q.Points
		if userAnswer, exists := attempt.Answers[q.ID.String()]; exists {
			if userAnswer == q.CorrectAnswer {
				score += q.Points
			}
		}
	}

	var exam models.Exam
	database.DB.First(&exam, "id = ?", attempt.ExamID)

	attempt.Score = score
	attempt.TotalPoints = totalPoints
	if totalPoints > 0 {
		attempt.Passed = (float64(score)/float64(totalPoints))*100 >= float64(exam.PassingScore)
	} else {
		attempt.Passed = false
	}
	
	now := time.Now()
	attempt.SubmittedAt = &now

	if err := database.DB.Create(&attempt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, attempt)
}
"""

readme_content = """# Exam Backend System (Go + Gin + PostgreSQL)

## Setup Instructions

1. **Database:**
   Ensure you have a PostgreSQL database running. Create a database named `exam_db`.
   
2. **Environment Variables:**
   Check the `.env` file. Update `DB_PASSWORD` to your local Postgres password.

3. **Install Dependencies:**
   Run the following command in your terminal:
   go mod tidy

4. **Run Server:**
   go run main.go

The server will start at `http://localhost:8080`.
"""

# --- Zip Generation ---

files = {
    "go.mod": go_mod_content,
    ".env": env_content,
    "main.go": main_go_content,
    "database/db.go": db_go_content,
    "models/models.go": models_go_content,
    "middleware/auth_middleware.go": auth_middleware_content,
    "controllers/auth.go": auth_controller_content,
    "controllers/exam.go": exam_controller_content,
    "README.md": readme_content
}

def create_zip():
    zip_filename = "exam-backend.zip"
    with zipfile.ZipFile(zip_filename, 'w') as zipf:
        for filename, content in files.items():
            zipf.writestr(filename, content)
            print(f"Adding {filename}...")
    
    print(f"\nSUCCESS: Created {zip_filename}")
    print("Extract this file, then run 'go mod tidy' inside the folder.")

if __name__ == "__main__":
    create_zip()