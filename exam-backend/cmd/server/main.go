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
	config.AllowOrigins = []string{"http://192.168.1.9:5173", "http://localhost:5173"}
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
		api.GET("/student/attempts", controllers.GetStudentAttempts)

		// admin-only
		admin := api.Group("/admin")
		admin.Use(middleware.AdminOnly())
		{
			admin.GET("/exams", controllers.GetExams)
			admin.POST("/exams", controllers.CreateExam)
			admin.DELETE("/exams/:id", controllers.DeleteExam)

			// ✅ CHANGED: Use UpdateExam (Metadata only) instead of UpdateExamWithQuestions
			// This prevents admins from accidentally deleting questions they can't see.
			admin.PUT("/exams/:id", controllers.UpdateExam)
			admin.PUT("/exams/:id/regenerate", controllers.RegenerateExam)

			admin.GET("/exams/:id/attempts", controllers.GetExamAttempts)
			admin.GET("/attempts/:id", controllers.GetAttemptDetails)

			admin.POST("/exams/preview", controllers.ExamBankPreview)
			admin.POST("/exams/from-bank", controllers.CreateExamFromBank)

			admin.GET("/bank/subjects", controllers.AdminGetSubjects)
			admin.GET("/bank/subjects/:subject/topics", controllers.AdminGetTopicsForSubject)
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
