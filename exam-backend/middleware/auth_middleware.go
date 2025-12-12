package middleware

import (
	"exam-backend/database"
	"exam-backend/models"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware validates JWT and ensures the token's JTI is active in user_sessions.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")

		if tokenString == "" {
			c.JSON(401, gin.H{"error": "Missing Authorization header"})
			c.Abort()
			return
		}

		tokenString = strings.TrimPrefix(tokenString, "Bearer ")

		claims := &models.Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(os.Getenv("JWT_SECRET")), nil
		})

		if err != nil || !token.Valid {
			c.JSON(401, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// STORE USER ID + ROLE IN CONTEXT
		c.Set("userID", claims.UserID)
		c.Set("role", claims.Role)

		// validate JTI (token id) exists and is active in user_sessions
		jti := claims.ID
		if jti != "" {
			var sess models.UserSession
			if err := database.DB.Where("jti = ? AND active = true", jti).First(&sess).Error; err != nil {
				// If not found or DB error -> reject
				c.JSON(401, gin.H{"error": "session_not_active_or_invalid"})
				c.Abort()
				return
			}
			// store jti in context for downstream use
			c.Set("jti", jti)
		}

		c.Next()
	}
}

// AdminOnly middleware
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, _ := c.Get("role")
		role := fmt.Sprint(roleVal)

		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			return
		}
		c.Next()
	}
}

// TeacherOnly middleware
func TeacherOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString("role")

		if role != "teacher" {
			c.JSON(403, gin.H{"error": "Only teachers can access this"})
			c.Abort()
			return
		}

		c.Next()
	}
}
