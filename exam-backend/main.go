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
	database.DB.AutoMigrate(&models.User{}, &models.Exam{}, &models.Question{}, &models.ExamAttempt{})

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
		// exams
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
			admin.POST("/exams", controllers.CreateExam)
			admin.PUT("/exams/:id", controllers.UpdateExam)
			admin.DELETE("/exams/:id", controllers.DeleteExam)

			admin.GET("/exams/:id/attempts", controllers.GetExamAttempts)
			admin.GET("/attempts/:id", controllers.GetAttemptDetails)
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
