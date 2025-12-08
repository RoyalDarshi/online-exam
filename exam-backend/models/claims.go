package models

import "github.com/golang-jwt/jwt/v5"

type Claims struct {
	UserID string `json:"userId"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}
