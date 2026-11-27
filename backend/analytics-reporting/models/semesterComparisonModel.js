
const pool = require('../../shared/config/db');

const ANSWERED_SUBMISSIONS = `
    answered_submissions AS (
        SELECT fs.submission_id, fs.survey_id
        FROM feedback_submissions fs
        WHERE EXISTS (
            SELECT 1
            FROM feedback_answers fa
            WHERE fa.submission_id = fs.submission_id
              AND (
                  fa.rating_value IS NOT NULL
                  OR NULLIF(TRIM(fa.text_answer), '') IS NOT NULL
              )
        )
    )
`;

const toParam = value =>
    value === undefined ? null : value;

const getSemesterComparison = async ({
    courseId,
    instructorId
} = {}) => {
    const query = `
        WITH ${ANSWERED_SUBMISSIONS}
        SELECT
            s.semester_id,
            s.semester_name,
            s.academic_year,

            COUNT(DISTINCT ci.course_instructor_id)
                AS course_offerings,

            COUNT(DISTINCT a.submission_id)
                AS total_submissions,

            COUNT(fa.answer_id)
                AS total_ratings,

            SUM(fa.rating_value)
                AS total_rating_sum,

            ROUND(
                AVG(fa.rating_value)::numeric,
                2
            ) AS average_rating

        FROM semesters s

        LEFT JOIN course_instructors ci
            ON ci.semester_id = s.semester_id
            AND ($1::int IS NULL OR ci.course_id = $1)
            AND ($2::int IS NULL OR ci.instructor_id = $2)

        LEFT JOIN surveys su
            ON su.course_instructor_id = ci.course_instructor_id

        LEFT JOIN answered_submissions a
            ON a.survey_id = su.survey_id

        LEFT JOIN feedback_answers fa
            ON fa.submission_id = a.submission_id
            AND fa.rating_value IS NOT NULL

        GROUP BY
            s.semester_id,
            s.semester_name,
            s.academic_year,
            s.start_date

        ORDER BY
            s.start_date,
            s.semester_id;
    `;

    const result = await pool.query(query, [
        toParam(courseId),
        toParam(instructorId)
    ]);

    return result.rows;
};

const EXISTS_QUERIES = {
    course: `
        SELECT EXISTS (
            SELECT 1
            FROM courses
            WHERE course_id = $1
        ) AS found
    `,

    instructor: `
        SELECT EXISTS (
            SELECT 1
            FROM users
            WHERE user_id = $1
              AND role = 'Instructor'
        ) AS found
    `
};

const entityExists = async (entity, id) => {
    const query = EXISTS_QUERIES[entity];

    if (!query) {
        throw new Error(`Unknown entity: ${entity}`);
    }

    const result = await pool.query(query, [id]);

    return result.rows[0].found === true;
};

module.exports = {
    getSemesterComparison,
    entityExists
};
