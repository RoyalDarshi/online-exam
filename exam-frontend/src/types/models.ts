// src/types/models.ts

export type Question = {
    id: string;
    type: 'single-choice' | 'multi-select' | 'true-false' | 'descriptive'; // NEW
    complexity: 'easy' | 'medium' | 'hard'; // NEW
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    marks: number;
    negative_marks: number;
    order_number: number;
    section: string;
};

export type Exam = {
    id: string;
    title: string;
    description: string;
    duration_minutes: number;
    passing_score: number;
    is_active: boolean;
    start_time: string; // ISO 8601 string
    end_time: string;   // ISO 8601 string
    subject: string;
    marks_easy: number;
    marks_medium: number;
    marks_hard: number;
    enable_negative_marking: boolean;
    negative_mark_easy: number;
    negative_mark_medium: number;
    negative_mark_hard: number;
    section_locking: boolean;
    questions?: Question[];
};

export type ExamAttempt = {
    id: string;
    exam_id: string;
    student_id: string;
    started_at: string;
    submitted_at: string | null;
    score: number;
    total_points: number;
    passed: boolean;
    is_terminated: boolean;
    termination_reason: string | null;
    tab_switches: number;
    time_left: number;
    exam: Exam;
};

// Response from GET /api/student/attempts
export type AttemptHistory = ExamAttempt & {
    exam: Exam; // Include the full exam object for display
}