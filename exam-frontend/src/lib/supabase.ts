import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'student';
  created_at: string;
};

export type Exam = {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  passing_score: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
};

export type Question = {
  id: string;
  exam_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  points: number;
  order_number: number;
};

export type ExamAttempt = {
  id: string;
  exam_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total_points: number;
  passed: boolean | null;
  tab_switches: number;
  answers: Record<string, string>;
};
