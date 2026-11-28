const pool = require('../../shared/config/db');

// Student eligibility rules owned by Survey Management (read-only queries).
//
// A student is eligible for a survey when:
//   - the survey is Published;
//   - the survey is open in Africa/Cairo: opening_date <= today and the
//     current Cairo time is before the end of the closing calendar day;
//   - the user is an Active, email-verified Student;
//   - the student is enrolled in the survey's exact course AND semester;
//   - the student has no participation record for the survey
//     (Submitted or Withdrawn).

const CAIRO_LOCAL_NOW = "(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Cairo')";
const CAIRO_LOCAL_DATE = `(${CAIRO_LOCAL_NOW})::date`;

const ELIGIBILITY_QUERY = `
    SELECT
        s.survey_id,
        (s.status = 'Published') AS is_published,
        (
            s.opening_date::date <= ${CAIRO_LOCAL_DATE}
            AND ${CAIRO_LOCAL_NOW} < (s.closing_date::date + 1)::timestamp
        ) AS is_open,
        EXISTS (
            SELECT 1
            FROM users AS student
            WHERE student.user_id = $2
              AND student.role = 'Student'
              AND student.account_status = 'Active'
              AND student.email_verified IS TRUE
        ) AS is_active_student,
        EXISTS (
            SELECT 1
            FROM enrollments AS e
            WHERE e.student_id = $2
              AND e.course_id = ci.course_id
              AND e.semester_id = ci.semester_id
        ) AS is_enrolled,
        EXISTS (
            SELECT 1
            FROM participation AS p
            WHERE p.survey_id = s.survey_id
              AND p.student_id = $2
        ) AS has_participation
    FROM surveys AS s
    JOIN course_instructors AS ci
        ON ci.course_instructor_id = s.course_instructor_id
    WHERE s.survey_id = $1;
`;

const getEligibilityFacts = async (surveyId, studentId, db = pool) => {
    const result = await db.query(ELIGIBILITY_QUERY, [surveyId, studentId]);
    return result.rows[0] || null;
};

const ELIGIBLE_SURVEYS_QUERY = `
    SELECT
        s.survey_id,
        s.title,
        (s.opening_date::date)::text AS opening_date,
        (s.closing_date::date)::text AS closing_date,
        ci.course_id,
        ci.semester_id
    FROM surveys AS s
    JOIN course_instructors AS ci
        ON ci.course_instructor_id = s.course_instructor_id
    JOIN users AS student
        ON student.user_id = $1
       AND student.role = 'Student'
       AND student.account_status = 'Active'
       AND student.email_verified IS TRUE
    WHERE s.status = 'Published'
      AND s.opening_date::date <= ${CAIRO_LOCAL_DATE}
      AND ${CAIRO_LOCAL_NOW} < (s.closing_date::date + 1)::timestamp
      AND EXISTS (
          SELECT 1
          FROM enrollments AS e
          WHERE e.student_id = student.user_id
            AND e.course_id = ci.course_id
            AND e.semester_id = ci.semester_id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM participation AS p
          WHERE p.survey_id = s.survey_id
            AND p.student_id = student.user_id
      )
    ORDER BY s.closing_date ASC, s.survey_id ASC;
`;

const getEligibleSurveys = async (studentId, db = pool) => {
    const result = await db.query(ELIGIBLE_SURVEYS_QUERY, [studentId]);
    return result.rows;
};

module.exports = {
    ELIGIBILITY_QUERY,
    ELIGIBLE_SURVEYS_QUERY,
    getEligibilityFacts,
    getEligibleSurveys
};
