package main

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
	// ✅ Include QuestionBank in migrations
	if err := database.DB.AutoMigrate(
		&models.User{},
		&models.Exam{},
		&models.Question{},
		&models.ExamAttempt{},
		&models.QuestionBank{},
	); err != nil {
		log.Println("AutoMigrate error:", err)
	}

	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:5173"}
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	r.Use(cors.New(config))

	// Auth
	r.POST("/api/auth/register", controllers.Register)
	r.POST("/api/auth/login", controllers.Login)

	// Protected API
	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware())
	{
		// exams (shared)
		api.GET("/exams", controllers.GetExams)
		api.GET("/exams/:id", controllers.GetExamDetails)

		// attempts (student)
		api.POST("/attempts/start", controllers.StartAttempt)
		api.POST("/attempts/submit", controllers.SubmitAttempt)
		api.POST("/progress", controllers.UpdateProgress)
		api.GET("/attempts/:id", controllers.GetAttemptDetails)

		// admin-only
		admin := api.Group("/admin")
		admin.Use(middleware.AdminOnly())
		{
			// classic exam CRUD
			admin.GET("/exams", controllers.GetExams)
			admin.POST("/exams", controllers.CreateExam)
			admin.DELETE("/exams/:id", controllers.DeleteExam)
			admin.PUT("/exams/:id", controllers.UpdateExamWithQuestions)
			admin.GET("/exams/:id/attempts", controllers.GetExamAttempts)
			admin.GET("/attempts/:id", controllers.GetAttemptDetails)

			// NEW: create exam from teacher question bank
			admin.POST("/exams/preview", controllers.ExamBankPreview)
			admin.POST("/exams/from-bank", controllers.CreateExamFromBank)

			// NEW: subject/topic helpers (read-only)
			admin.GET("/bank/subjects", controllers.AdminGetSubjects)
			admin.GET("/bank/subjects/:subject/topics", controllers.AdminGetTopicsForSubject)

			// ❌ Admin NO longer uploads/edit/deletes question bank.
			// That is ONLY for teachers.
		}

		// teacher-only routes (you already have these; keep them)
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
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
