const CANDIDATE_QUERY = `
  WITH cairo_clock AS (
    SELECT CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Cairo' AS local_now
  )
  SELECT DISTINCT
    s.survey_id,
    s.title AS survey_title,
    s.status AS survey_status,
    s.opening_date::date::text AS opening_date,
    s.closing_date::date::text AS closing_date,
    ci.course_id,
    ci.semester_id,
    e.course_id AS enrolled_course_id,
    e.semester_id AS enrolled_semester_id,
    c.course_name,
    student.user_id AS student_id,
    student.full_name AS student_name,
    student.email AS student_email,
    student.role AS student_role,
    student.account_status,
    student.email_verified
  FROM surveys AS s
  JOIN course_instructors AS ci
    ON ci.course_instructor_id = s.course_instructor_id
  JOIN courses AS c
    ON c.course_id = ci.course_id
  JOIN semesters AS sem
    ON sem.semester_id = ci.semester_id
  JOIN enrollments AS e
    ON e.course_id = ci.course_id
   AND e.semester_id = ci.semester_id
  JOIN users AS student
    ON student.user_id = e.student_id
  CROSS JOIN cairo_clock
  WHERE s.status = 'Published'
    AND CASE
      WHEN s.opening_date IS NOT NULL
       AND s.closing_date IS NOT NULL
       AND isfinite(s.opening_date)
       AND isfinite(s.closing_date)
      THEN
        s.closing_date::date - s.opening_date::date >= 3
        AND s.opening_date::date <= cairo_clock.local_now::date
        AND cairo_clock.local_now < (s.closing_date::date + 1)::timestamp
        AND s.closing_date::date - 3 <= cairo_clock.local_now::date
        AND (
          s.closing_date::date - 3 < cairo_clock.local_now::date
          OR cairo_clock.local_now::time >= TIME '10:00'
        )
      ELSE FALSE
    END
    AND student.role = 'Student'
    AND student.account_status = 'Active'
    AND student.email_verified IS TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM participation AS p
      WHERE p.survey_id = s.survey_id
        AND p.student_id = student.user_id
    )
`;

function getDatabase(db) {
  return db || require("../../database/db");
}

function candidateQuery(identityFilter = "") {
  return `${CANDIDATE_QUERY}${identityFilter}\n  ORDER BY s.survey_id, student.user_id;`;
}

async function getDueReminderCandidates(db) {
  const result = await getDatabase(db).query(candidateQuery(), []);
  return result.rows;
}

async function getCandidateIfStillEligible(surveyId, studentId, db) {
  const query = candidateQuery(
    "\n    AND s.survey_id = $1\n    AND student.user_id = $2"
  );
  const result = await getDatabase(db).query(query, [surveyId, studentId]);
  return result.rows[0] || null;
}

module.exports = {
  getDueReminderCandidates,
  getCandidateIfStillEligible,
};
