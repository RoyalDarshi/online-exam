package main

import (
	"context"
	"exam-backend/controllers"
	"exam-backend/database"
	"exam-backend/middleware"
	"exam-backend/models"
	"exam-backend/workers"
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Note: .env file not found, using system env")
	}

	database.Connect()

	// AutoMigrate models
	if err := database.DB.AutoMigrate(
		&models.User{},
		&models.Exam{},
		&models.Question{},
		&models.ExamAttempt{},
		&models.QuestionBank{},
		&models.UserSession{},
	); err != nil {
		log.Println("AutoMigrate error:", err)
	}

	// Create a partial unique index to prevent multiple active attempts per (exam_id, student_id).
	// This requires Postgres. If you use another DB, remove/adjust this.
	if err := database.DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_attempt
		ON exam_attempts (exam_id, student_id)
		WHERE submitted_at IS NULL AND is_terminated = false;`).Error; err != nil {
		log.Println("Could not create partial unique index (safe to ignore if not Postgres):", err)
	}

	// Initialize Redis (if configured)
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379" // fallback for dev
	}
	if err := database.InitializeRedis(redisAddr); err != nil {
		log.Fatalf("❌ Redis is REQUIRED. Startup failed: %v", err)
	}
	log.Println("✅ Redis connected")

	err := database.RedisHealthCheck(context.Background())
	if err != nil {
		log.Fatal("Redis unhealthy:", err)
	}
	workers.StartAutosaveFlusher()


	// Start the background worker to clean up old exams
	controllers.StartExamCleanupTask()

	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"*"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	r.Use(cors.New(config))

	// Auth
	r.POST("/api/auth/register", controllers.Register)
	r.POST("/api/auth/login",middleware.RateLimit("login", 5, time.Minute), controllers.Login)
	r.GET("/ws/exam", controllers.ExamWebSocket)

	// Protected API
	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware())
	{
		// exams (shared)
		api.GET("/exams", controllers.GetExams)
		api.GET("/exams/:id", controllers.GetExamDetails)
		api.POST("/attempts/start",middleware.RateLimit("start_exam", 2, time.Minute), controllers.StartAttempt)
		api.POST("/progress",middleware.RateLimit("progress", 6, time.Second), controllers.UpdateProgress)
		api.POST("/attempts/submit",middleware.RateLimit("submit_attempt", 2, time.Minute), controllers.SubmitAttempt)
		api.GET("/attempts/:id", controllers.GetAttemptDetails)
		api.GET("/student/attempts", controllers.GetStudentAttempts)

		// admin-only
		admin := api.Group("/admin")
		admin.Use(middleware.AdminOnly())
		{
			admin.GET("/exams", controllers.GetExams)
			admin.POST("/exams", controllers.CreateExam)
			admin.GET("/exams/:id", controllers.AdminGetExam)
			admin.DELETE("/exams/:id", controllers.DeleteExam)

			admin.PUT("/exams/:id", controllers.UpdateExam)

			admin.GET("/exams/:id/attempts", controllers.GetExamAttempts)
			admin.GET("/attempts/:id", controllers.GetAttemptDetails)

			admin.POST("/exams/preview", controllers.ExamBankPreview)

			admin.GET("/bank/subjects", controllers.AdminGetSubjects)
			admin.GET("/bank/topics/:subject", controllers.AdminGetTopicsForSubject)
		}

		teacher := api.Group("/teacher")
		teacher.Use(middleware.TeacherOnly())
		{
			teacher.POST("/question-bank/upload", controllers.TeacherUploadQuestionBank)
			teacher.GET("/question-bank", controllers.TeacherGetQuestionBank)
			teacher.PUT("/question-bank/:id", controllers.TeacherUpdateQuestion)
			teacher.DELETE("/question-bank/:id", controllers.TeacherDeleteQuestion)
			teacher.GET("/question-bank/template", controllers.TeacherDownloadTemplate)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if err := r.Run("0.0.0.0:" + port); err != nil {
		log.Fatal(err)
	}
}
