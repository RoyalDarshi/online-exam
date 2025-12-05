/*
  # Create Online Examination System (FIXED VERSION)

  1. Changes from Original
     - Added `is_admin()` SECURITY DEFINER function to fix recursion error 42P17.
     - Updated all "Admin" policies to use `is_admin()` instead of querying the table directly.

  2. Tables & Security
     - profiles: Users manage own, Admins view all.
     - exams: Students view active, Admins manage all.
     - questions: Students view during active exam, Admins manage all.
     - exam_attempts: Students manage own, Admins view all.
*/

-- 1. Create Helper Function to Fix Infinite Recursion
-- This function bypasses RLS to safely check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- FIXED: Uses is_admin() function
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 3. Create exams table
CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 60,
  passing_score integer NOT NULL DEFAULT 60,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read active exams"
  ON exams FOR SELECT
  TO authenticated
  USING (is_active = true);

-- FIXED: Uses is_admin() function
CREATE POLICY "Admins can read all exams"
  ON exams FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can create exams"
  ON exams FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update exams"
  ON exams FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete exams"
  ON exams FOR DELETE
  TO authenticated
  USING (is_admin());

-- 4. Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  question_text text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_answer text NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  points integer NOT NULL DEFAULT 1,
  order_number integer NOT NULL DEFAULT 0
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read questions for active exams"
  ON questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = questions.exam_id
      AND exams.is_active = true
    )
  );

-- FIXED: Uses is_admin() function
CREATE POLICY "Admins can manage questions"
  ON questions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 5. Create exam_attempts table
CREATE TABLE IF NOT EXISTS exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  score integer,
  total_points integer NOT NULL,
  passed boolean,
  tab_switches integer DEFAULT 0,
  answers jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read own attempts"
  ON exam_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students can create own attempts"
  ON exam_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own attempts"
  ON exam_attempts FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- FIXED: Uses is_admin() function
CREATE POLICY "Admins can read all attempts"
  ON exam_attempts FOR SELECT
  TO authenticated
  USING (is_admin());

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON exam_attempts(exam_id);