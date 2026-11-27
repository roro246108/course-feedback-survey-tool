
const pool = require("../../database/db");

// Get courses in which the authenticated student is enrolled.
async function getEnrolledCourses(studentId, db = pool) {
  const query = `
    SELECT
      c.course_id,
      c.course_name,
      c.course_code,
      sem.semester_name,
      sem.academic_year,
      COALESCE(
        STRING_AGG(DISTINCT u.full_name, ', ' ORDER BY u.full_name),
        'Instructor not assigned'
      ) AS instructor_name,
      COUNT(DISTINCT s.survey_id) FILTER (
        WHERE s.status = 'Published'
          AND s.opening_date <= CURRENT_TIMESTAMP
          AND s.closing_date > CURRENT_TIMESTAMP
          AND NOT EXISTS (
            SELECT 1
            FROM participation p
            WHERE p.survey_id = s.survey_id
              AND p.student_id = e.student_id
          )
      ) AS available_survey_count
    FROM enrollments e
    JOIN courses c
      ON c.course_id = e.course_id
    JOIN semesters sem
      ON sem.semester_id = e.semester_id
    LEFT JOIN course_instructors ci
      ON ci.course_id = e.course_id
      AND ci.semester_id = e.semester_id
    LEFT JOIN users u
      ON u.user_id = ci.instructor_id
    LEFT JOIN surveys s
      ON s.course_instructor_id = ci.course_instructor_id
    WHERE e.student_id = $1
    GROUP BY
      c.course_id,
      c.course_name,
      c.course_code,
      sem.semester_id,
      sem.semester_name,
      sem.academic_year,
      sem.start_date
    ORDER BY sem.start_date DESC, c.course_name ASC;
  `;

  const result = await db.query(query, [studentId]);
  return result.rows;
}

// Get all published surveys available to the authenticated student.
async function getAvailableSurveys(studentId, db = pool) {
  const query = `
    SELECT
      s.survey_id,
      s.title,
      s.description,
      s.status,
      s.opening_date,
      s.closing_date,
      c.course_id,
      c.course_name,
      c.course_code,
      u.full_name AS instructor_name,
      sem.semester_name,
      sem.academic_year

    FROM surveys s

    INNER JOIN course_instructors ci
      ON s.course_instructor_id = ci.course_instructor_id

    INNER JOIN courses c
      ON ci.course_id = c.course_id

    INNER JOIN users u
      ON ci.instructor_id = u.user_id

    INNER JOIN semesters sem
      ON ci.semester_id = sem.semester_id

    WHERE
      s.status = 'Published'
      AND s.opening_date <= CURRENT_TIMESTAMP
      AND s.closing_date > CURRENT_TIMESTAMP

      AND EXISTS (
        SELECT 1
        FROM enrollments e
        WHERE
          e.student_id = $1
          AND e.course_id = ci.course_id
          AND e.semester_id = ci.semester_id
      )

      AND NOT EXISTS (
        SELECT 1
        FROM participation p
        WHERE
          p.survey_id = s.survey_id
          AND p.student_id = $1
      )

    ORDER BY s.closing_date ASC;
  `;

  const result = await db.query(query, [studentId]);

  return result.rows;
}

// Get details and questions of a survey available to the student.
async function getSurveyById(surveyId, studentId, db = pool) {
  const surveyQuery = `
    SELECT
      s.survey_id,
      s.title,
      s.description,
      s.status,
      s.opening_date,
      s.closing_date,
      c.course_id,
      c.course_code,
      c.course_name,
      u.full_name AS instructor_name,
      sem.semester_name,
      sem.academic_year

    FROM surveys s

    INNER JOIN course_instructors ci
      ON s.course_instructor_id = ci.course_instructor_id

    INNER JOIN courses c
      ON ci.course_id = c.course_id

    INNER JOIN users u
      ON ci.instructor_id = u.user_id

    INNER JOIN semesters sem
      ON ci.semester_id = sem.semester_id

    WHERE
      s.survey_id = $1
      AND s.status = 'Published'
      AND s.opening_date <= CURRENT_TIMESTAMP
      AND s.closing_date > CURRENT_TIMESTAMP

      AND EXISTS (
        SELECT 1
        FROM enrollments e
        WHERE
          e.student_id = $2
          AND e.course_id = ci.course_id
          AND e.semester_id = ci.semester_id
      )

      AND NOT EXISTS (
        SELECT 1
        FROM participation p
        WHERE
          p.survey_id = s.survey_id
          AND p.student_id = $2
      );
  `;

  const surveyResult = await db.query(surveyQuery, [
    surveyId,
    studentId,
  ]);

  if (surveyResult.rows.length === 0) {
    return null;
  }

  const survey = surveyResult.rows[0];

  const questionsQuery = `
    SELECT
      question_id,
      question_text,
      question_type,
      is_required,
      display_order

    FROM questions

    WHERE survey_id = $1

    ORDER BY display_order ASC;
  `;

  const questionsResult = await db.query(questionsQuery, [
    surveyId,
  ]);

  return {
    ...survey,
    questions: questionsResult.rows,
  };
}

// Check student eligibility and submission status for one survey.
async function getSurveySubmissionStatus(surveyId, studentId, db = pool) {
  const query = `
    SELECT
      s.survey_id,
      s.status,
      s.opening_date,
      s.closing_date,

      EXISTS (
        SELECT 1
        FROM enrollments e
        WHERE
          e.student_id = $2
          AND e.course_id = ci.course_id
          AND e.semester_id = ci.semester_id
      ) AS is_eligible,

      EXISTS (
        SELECT 1
        FROM participation p
        WHERE
          p.survey_id = s.survey_id
          AND p.student_id = $2
      ) AS already_submitted,

      (
        s.status = 'Published'
        AND s.opening_date <= CURRENT_TIMESTAMP
        AND s.closing_date > CURRENT_TIMESTAMP
      ) AS is_open

    FROM surveys s

    INNER JOIN course_instructors ci
      ON s.course_instructor_id = ci.course_instructor_id

    WHERE s.survey_id = $1;
  `;

  const result = await db.query(query, [
    surveyId,
    studentId,
  ]);

  if (result.rows.length === 0) {
    return null;
  }

  const survey = result.rows[0];

  const isEligible = survey.is_eligible;
  const alreadySubmitted = survey.already_submitted;
  const isOpen = survey.is_open;

  let reason = "CAN_SUBMIT";

  if (!isEligible) {
    reason = "NOT_ENROLLED";
  } else if (alreadySubmitted) {
    reason = "ALREADY_SUBMITTED";
  } else if (survey.status !== "Published") {
    reason = "NOT_PUBLISHED";
  } else if (!isOpen) {
    reason = "SURVEY_NOT_OPEN";
  }

  return {
    survey_id: survey.survey_id,
    is_eligible: isEligible,
    already_submitted: alreadySubmitted,
    is_open: isOpen,
    can_submit: isEligible && !alreadySubmitted && isOpen,
    reason,
  };
}

module.exports = {
  getEnrolledCourses,
  getAvailableSurveys,
  getSurveyById,
  getSurveySubmissionStatus,
};
