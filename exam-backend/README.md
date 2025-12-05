# Exam Backend System (Go + Gin + PostgreSQL)

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
