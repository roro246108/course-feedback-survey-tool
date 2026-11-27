-- Review-only seed for Student Home course cards.
-- Run with psql only after replacing these four placeholders with existing
-- active test-account emails and an exact semester name/year from the database.
-- Recommended: psql -v ON_ERROR_STOP=1 -f student_dashboard_test_data.sql
-- This script inserts test data only, never updates or deletes existing rows.
\set test_student_email 'REPLACE_WITH_EXISTING_TEST_STUDENT_EMAIL'
\set test_instructor_email 'REPLACE_WITH_EXISTING_ACTIVE_INSTRUCTOR_EMAIL'
\set test_semester_name 'REPLACE_WITH_EXISTING_SEMESTER_NAME'
\set test_academic_year 'REPLACE_WITH_EXISTING_ACADEMIC_YEAR'

BEGIN;

SET LOCAL app.seed_student_email = :'test_student_email';
SET LOCAL app.seed_instructor_email = :'test_instructor_email';
SET LOCAL app.seed_semester_name = :'test_semester_name';
SET LOCAL app.seed_academic_year = :'test_academic_year';

-- These scalar subqueries must identify exactly one existing student,
-- instructor, and semester. Missing values fail the NOT NULL insert.
CREATE TEMP TABLE _student_home_seed_context (
  student_id integer NOT NULL,
  instructor_id integer NOT NULL,
  semester_id integer NOT NULL
) ON COMMIT DROP;

INSERT INTO _student_home_seed_context (student_id, instructor_id, semester_id)
VALUES (
  (
    SELECT user_id
    FROM public.users
    WHERE email = current_setting('app.seed_student_email')
      AND role = 'Student'
      AND account_status = 'Active'
  ),
  (
    SELECT user_id
    FROM public.users
    WHERE email = current_setting('app.seed_instructor_email')
      AND role = 'Instructor'
      AND account_status = 'Active'
  ),
  (
    SELECT semester_id
    FROM public.semesters
    WHERE semester_name = current_setting('app.seed_semester_name')
      AND academic_year = current_setting('app.seed_academic_year')
  )
);

CREATE TEMP TABLE _student_home_course_seed (
  course_code character varying NOT NULL,
  course_name character varying NOT NULL,
  description text NOT NULL,
  survey_title character varying NOT NULL
) ON COMMIT DROP;

INSERT INTO _student_home_course_seed
  (course_code, course_name, description, survey_title)
VALUES
  ('ZZTST-AF-101', 'TEST DATA: Computer Networks',
   'TEST DATA ONLY: course card layout sample.', 'TEST DATA: Feedback - Computer Networks'),
  ('ZZTST-AF-102', 'TEST DATA: Human-Computer Interaction',
   'TEST DATA ONLY: course card layout sample.', 'TEST DATA: Feedback - Human-Computer Interaction'),
  ('ZZTST-AF-103', 'TEST DATA: Software Testing',
   'TEST DATA ONLY: course card layout sample.', 'TEST DATA: Feedback - Software Testing');

-- Fail instead of attaching test enrollments/surveys to an unrelated course
-- if one of the deliberately distinctive test codes already belongs elsewhere.
DO $check_test_codes$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM _student_home_course_seed seed
    JOIN public.courses c ON c.course_code = seed.course_code
    WHERE c.course_name IS DISTINCT FROM seed.course_name
  ) THEN
    RAISE EXCEPTION 'A test course code already exists with a different course name; no seed rows should be added.';
  END IF;
END;
$check_test_codes$;

INSERT INTO public.courses (course_code, course_name, description)
SELECT course_code, course_name, description
FROM _student_home_course_seed
ON CONFLICT (course_code) DO NOTHING;

INSERT INTO public.course_instructors (course_id, semester_id, instructor_id)
SELECT c.course_id, context.semester_id, context.instructor_id
FROM _student_home_course_seed seed
JOIN public.courses c ON c.course_code = seed.course_code
CROSS JOIN _student_home_seed_context context
ON CONFLICT (course_id, semester_id, instructor_id) DO NOTHING;

-- Enroll only the explicitly selected existing test student.
INSERT INTO public.enrollments (student_id, course_id, semester_id)
SELECT context.student_id, c.course_id, context.semester_id
FROM _student_home_course_seed seed
JOIN public.courses c ON c.course_code = seed.course_code
CROSS JOIN _student_home_seed_context context
ON CONFLICT (student_id, course_id, semester_id) DO NOTHING;

INSERT INTO public.surveys (
  title, description, course_instructor_id, created_by,
  opening_date, closing_date, status
)
SELECT
  seed.survey_title,
  'TEST DATA ONLY: survey for Student Home layout verification.',
  ci.course_instructor_id,
  context.instructor_id,
  CURRENT_TIMESTAMP - INTERVAL '1 day',
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  'Published'
FROM _student_home_course_seed seed
JOIN public.courses c ON c.course_code = seed.course_code
CROSS JOIN _student_home_seed_context context
JOIN public.course_instructors ci
  ON ci.course_id = c.course_id
  AND ci.semester_id = context.semester_id
  AND ci.instructor_id = context.instructor_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.surveys existing
  WHERE existing.course_instructor_id = ci.course_instructor_id
    AND existing.title = seed.survey_title
);

CREATE TEMP TABLE _student_home_question_seed (
  question_text text NOT NULL,
  question_type character varying NOT NULL,
  is_required boolean NOT NULL,
  display_order integer NOT NULL
) ON COMMIT DROP;

INSERT INTO _student_home_question_seed
  (question_text, question_type, is_required, display_order)
VALUES
  ('TEST DATA: Rate the overall learning experience.', 'Rating', true, 1),
  ('TEST DATA: What is one thing that helped your learning?', 'Text', false, 2);

INSERT INTO public.questions
  (survey_id, question_text, question_type, is_required, display_order)
SELECT s.survey_id, question.question_text, question.question_type,
       question.is_required, question.display_order
FROM _student_home_course_seed seed
JOIN public.courses c ON c.course_code = seed.course_code
CROSS JOIN _student_home_seed_context context
JOIN public.course_instructors ci
  ON ci.course_id = c.course_id
  AND ci.semester_id = context.semester_id
  AND ci.instructor_id = context.instructor_id
JOIN public.surveys s
  ON s.course_instructor_id = ci.course_instructor_id
  AND s.title = seed.survey_title
CROSS JOIN _student_home_question_seed question
WHERE NOT EXISTS (
  SELECT 1
  FROM public.questions existing
  WHERE existing.survey_id = s.survey_id
    AND existing.question_text = question.question_text
);

-- Review inserted/existing test rows without showing student identity.
SELECT c.course_code, c.course_name, sem.semester_name, sem.academic_year,
       u.full_name AS instructor_name, s.title AS test_survey_title
FROM _student_home_course_seed seed
JOIN public.courses c ON c.course_code = seed.course_code
CROSS JOIN _student_home_seed_context context
JOIN public.semesters sem ON sem.semester_id = context.semester_id
JOIN public.course_instructors ci
  ON ci.course_id = c.course_id
  AND ci.semester_id = context.semester_id
  AND ci.instructor_id = context.instructor_id
JOIN public.users u ON u.user_id = ci.instructor_id
JOIN public.surveys s
  ON s.course_instructor_id = ci.course_instructor_id
  AND s.title = seed.survey_title
ORDER BY c.course_code;

COMMIT;
