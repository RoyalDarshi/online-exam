package controllers

import (
	"exam-backend/database"
	"exam-backend/models"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func Register(c *gin.Context) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		FullName string `json:"full_name"`
		Role     string `json:"role"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(input.Password) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password must be at least 6 characters"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := models.User{
		Email:    input.Email,
		Password: string(hashed),
		FullName: input.FullName,
		Role:     input.Role,
	}

	if user.Role == "" {
		user.Role = "student"
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Could not create user. Email might already exist."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User registered successfully"})
}

// LoginRequest updated to include Fingerprint
type LoginRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	Fingerprint string `json:"fingerprint"` // Add this field
}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}

	var user models.User
	if err := database.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_credentials"})
		return
	}

	// ---------------- SECURITY CHECK ----------------
	// Check if user has an ACTIVE exam
	var activeAttempt models.ExamAttempt
	err := database.DB.Where("student_id = ? AND submitted_at IS NULL AND is_terminated = false", user.ID).First(&activeAttempt).Error

	if err == nil {
		// User HAS an active exam.
		// We must ONLY allow login if it is the EXACT SAME BROWSER (Crash Recovery).

		var activeSession models.UserSession
		if err := database.DB.Where("user_id = ? AND active = true", user.ID).
			Order("created_at desc").
			First(&activeSession).Error; err == nil {

			// 1. IP Check
			if activeSession.IP != c.ClientIP() {
				c.JSON(http.StatusForbidden, gin.H{
					"error":   "exam_in_progress",
					"message": "Login denied. Exam active on another network.",
				})
				return
			}

			// 2. FINGERPRINT CHECK (The Fix)
			// If the fingerprints don't match, it means it's a
			// DIFFERENT screen/window on the SAME computer. BLOCK IT.
			if activeSession.DeviceFingerprint != "" && req.Fingerprint != "" {
				if activeSession.DeviceFingerprint != req.Fingerprint {
					c.JSON(http.StatusForbidden, gin.H{
						"error":   "exam_in_progress",
						"message": "Login denied. Exam active on another window/browser.",
					})
					return
				}
			}
		}
	}
	// ------------------------------------------------

	jti := uuid.New().String()

	claims := &models.Claims{
		UserID: user.ID.String(),
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        jti,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	jwtSecret := []byte(os.Getenv("JWT_SECRET"))
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Invalidate previous sessions
	if user.Role == "student" {
		database.DB.Model(&models.UserSession{}).Where("user_id = ? AND active = true", user.ID).Update("active", false)
	}

	exp := time.Now().Add(72 * time.Hour)
	sess := models.UserSession{
		ID:                uuid.New(),
		UserID:            user.ID,
		Jti:               jti,
		DeviceFingerprint: req.Fingerprint, // Save fingerprint for the next check
		IP:                c.ClientIP(),
		Active:            true,
		CreatedAt:         time.Now(),
		ExpiresAt:         &exp,
	}
	database.DB.Create(&sess)

	c.JSON(200, gin.H{
		"token": tokenString,
		"user": gin.H{
			"id":        user.ID.String(),
			"email":     user.Email,
			"full_name": user.FullName,
			"role":      user.Role,
		},
	})
}
