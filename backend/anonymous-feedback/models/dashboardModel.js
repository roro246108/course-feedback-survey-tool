
const pool = require("../../database/db");

// Get recent feedback submissions for a student
async function getRecentSubmissions(studentId, db = pool) {
  const query = `
    SELECT
      p.participation_id AS id,
      s.title,
      p.submitted_at,
      COALESCE(to_jsonb(p)->>'status', 'Submitted') AS status
    FROM participation p
    JOIN surveys s
      ON p.survey_id = s.survey_id
    WHERE p.student_id = $1
    ORDER BY p.submitted_at DESC
    LIMIT 3;
  `;

  const result = await db.query(query, [studentId]);

  return result.rows;
}

// Get dashboard statistics for a student
async function getDashboardStats(studentId, db = pool) {
  const query = `
    SELECT
      (
        SELECT COUNT(*)
        FROM participation p
        WHERE p.student_id = $1
          AND COALESCE(to_jsonb(p)->>'status', 'Submitted') = 'Submitted'
      ) AS completed_surveys,

      (
        SELECT COUNT(DISTINCT s.survey_id)
        FROM enrollments e
        JOIN course_instructors ci
          ON e.course_id = ci.course_id
          AND e.semester_id = ci.semester_id
        JOIN surveys s
          ON ci.course_instructor_id = s.course_instructor_id
        WHERE e.student_id = $1
          AND s.status = 'Published'
          AND s.opening_date <= CURRENT_TIMESTAMP
          AND s.closing_date > CURRENT_TIMESTAMP
          AND NOT EXISTS (
            SELECT 1
            FROM participation p
            WHERE p.survey_id = s.survey_id
              AND p.student_id = e.student_id
          )
      ) AS available_surveys,

      (
        SELECT COUNT(*)
        FROM enrollments e
        WHERE e.student_id = $1
      ) AS enrolled_courses;
  `;

  const result = await db.query(query, [studentId]);

  return result.rows[0];
}

module.exports = {
  getRecentSubmissions,
  getDashboardStats,
};
