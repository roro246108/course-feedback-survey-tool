
const pool = require('../../shared/config/db');

<<<<<<< Updated upstream

=======
// A response is counted once if it contains at least one meaningful answer.
>>>>>>> Stashed changes
const ANSWERED_SUBMISSIONS = `
    answered_submissions AS (
        SELECT fs.submission_id, fs.survey_id, fs.submitted_at
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

const toParam = value => value === undefined ? null : value;

// 1. Overall Analytics
const getOverview = async ({ instructorId } = {}) => {
    const result = await pool.query(`
        WITH ${ANSWERED_SUBMISSIONS}
        SELECT
            (
                SELECT COUNT(DISTINCT a.submission_id)
                FROM answered_submissions a
                INNER JOIN surveys s ON s.survey_id = a.survey_id
                INNER JOIN course_instructors ci
                    ON ci.course_instructor_id = s.course_instructor_id
                WHERE ($1::int IS NULL OR ci.instructor_id = $1)
            ) AS total_submissions,

            (
                SELECT ROUND(AVG(fa.rating_value), 2)
                FROM feedback_answers fa
                INNER JOIN feedback_submissions fs
                    ON fs.submission_id = fa.submission_id
                INNER JOIN surveys s ON s.survey_id = fs.survey_id
                INNER JOIN course_instructors ci
                    ON ci.course_instructor_id = s.course_instructor_id
                WHERE fa.rating_value IS NOT NULL
                  AND ($1::int IS NULL OR ci.instructor_id = $1)
            ) AS average_rating,

            (
                SELECT COUNT(*)
                FROM feedback_answers fa
                INNER JOIN feedback_submissions fs
                    ON fs.submission_id = fa.submission_id
                INNER JOIN surveys s ON s.survey_id = fs.survey_id
                INNER JOIN course_instructors ci
                    ON ci.course_instructor_id = s.course_instructor_id
                WHERE fa.rating_value IS NOT NULL
                  AND ($1::int IS NULL OR ci.instructor_id = $1)
            ) AS total_rating_answers,

            (
                SELECT COUNT(*)
                FROM feedback_answers fa
                INNER JOIN feedback_submissions fs
                    ON fs.submission_id = fa.submission_id
                INNER JOIN surveys s ON s.survey_id = fs.survey_id
                INNER JOIN course_instructors ci
                    ON ci.course_instructor_id = s.course_instructor_id
                WHERE NULLIF(TRIM(fa.text_answer), '') IS NOT NULL
                  AND ($1::int IS NULL OR ci.instructor_id = $1)
            ) AS total_text_answers,

            (
                SELECT COUNT(DISTINCT ci.course_id)
                FROM course_instructors ci
                WHERE ($1::int IS NULL OR ci.instructor_id = $1)
            ) AS total_courses,

            (
                SELECT COUNT(DISTINCT ci.instructor_id)
                FROM course_instructors ci
                WHERE ($1::int IS NULL OR ci.instructor_id = $1)
            ) AS total_instructors
    `, [toParam(instructorId)]);

    return result.rows[0];
};


// 2. Feedback Trends - Last 7 days
const getFeedbackTrends = async ({ instructorId } = {}) => {
    const result = await pool.query(`
        WITH ${ANSWERED_SUBMISSIONS},
        days AS (
            SELECT generate_series(
                CURRENT_DATE - 6,
                CURRENT_DATE,
                INTERVAL '1 day'
            )::date AS day
        )
        SELECT
            TO_CHAR(d.day, 'YYYY-MM-DD') AS submission_date,
            COUNT(a.submission_id) AS total_submissions
        FROM days d
        LEFT JOIN answered_submissions a
            ON a.submitted_at >= d.day
           AND a.submitted_at < d.day + 1
        LEFT JOIN surveys s
            ON s.survey_id = a.survey_id
        LEFT JOIN course_instructors ci
            ON ci.course_instructor_id = s.course_instructor_id
            AND ($1::int IS NULL OR ci.instructor_id = $1)
        WHERE $1::int IS NULL
           OR ci.course_instructor_id IS NOT NULL
        GROUP BY d.day
        ORDER BY d.day ASC
    `, [toParam(instructorId)]);

    return result.rows;
};


// 3. Semester Comparison
const getSemesterComparison = async ({ instructorId } = {}) => {
    const result = await pool.query(`
        WITH ${ANSWERED_SUBMISSIONS}
        SELECT
            sem.semester_id,
            sem.semester_name,
            sem.academic_year,
            COUNT(DISTINCT a.submission_id) AS total_submissions,
            ROUND(AVG(fa.rating_value), 2) AS average_rating

        FROM semesters sem

        LEFT JOIN course_instructors ci
            ON ci.semester_id = sem.semester_id
            AND ($1::int IS NULL OR ci.instructor_id = $1)

        LEFT JOIN surveys s
            ON s.course_instructor_id = ci.course_instructor_id

        LEFT JOIN answered_submissions a
            ON a.survey_id = s.survey_id

        LEFT JOIN feedback_answers fa
            ON fa.submission_id = a.submission_id
            AND fa.rating_value IS NOT NULL

        GROUP BY
            sem.semester_id,
            sem.semester_name,
            sem.academic_year,
            sem.start_date

        ORDER BY sem.start_date ASC, sem.semester_id ASC
    `, [toParam(instructorId)]);

    return result.rows;
};


// 4. Course Performance
const getCoursePerformance = async ({
    semesterId,
    instructorId
} = {}) => {
    const result = await pool.query(`
        WITH ${ANSWERED_SUBMISSIONS}
        SELECT
            c.course_id,
            c.course_code,
            c.course_name,
            COUNT(DISTINCT a.submission_id) AS total_submissions,
            COUNT(fa.answer_id) AS rating_answers,
            ROUND(AVG(fa.rating_value), 2) AS average_rating

        FROM courses c

        LEFT JOIN course_instructors ci
            ON ci.course_id = c.course_id
            AND ($1::int IS NULL OR ci.semester_id = $1)
            AND ($2::int IS NULL OR ci.instructor_id = $2)

        LEFT JOIN surveys s
            ON s.course_instructor_id = ci.course_instructor_id

        LEFT JOIN answered_submissions a
            ON a.survey_id = s.survey_id

        LEFT JOIN feedback_answers fa
            ON fa.submission_id = a.submission_id
            AND fa.rating_value IS NOT NULL

        WHERE (
            ($1::int IS NULL AND $2::int IS NULL)
            OR ci.course_instructor_id IS NOT NULL
        )

        GROUP BY
            c.course_id,
            c.course_code,
            c.course_name

        ORDER BY average_rating DESC NULLS LAST, c.course_code ASC
    `, [
        toParam(semesterId),
        toParam(instructorId)
    ]);

    return result.rows;
};


// 5. Instructor Performance
const getInstructorPerformance = async ({
    semesterId,
    courseId,
    instructorId
} = {}) => {
    const result = await pool.query(`
        WITH ${ANSWERED_SUBMISSIONS}
        SELECT
            u.user_id AS instructor_id,
            u.full_name AS instructor_name,
            COUNT(DISTINCT ci.course_instructor_id) AS total_courses,
            COUNT(DISTINCT a.submission_id) AS total_submissions,
            COUNT(fa.answer_id) AS rating_answers,
            ROUND(AVG(fa.rating_value), 2) AS average_rating

        FROM course_instructors ci

        INNER JOIN users u
            ON u.user_id = ci.instructor_id

        LEFT JOIN surveys s
            ON s.course_instructor_id = ci.course_instructor_id

        LEFT JOIN answered_submissions a
            ON a.survey_id = s.survey_id

        LEFT JOIN feedback_answers fa
            ON fa.submission_id = a.submission_id
            AND fa.rating_value IS NOT NULL

        WHERE ($1::int IS NULL OR ci.semester_id = $1)
          AND ($2::int IS NULL OR ci.course_id = $2)
          AND ($3::int IS NULL OR ci.instructor_id = $3)

        GROUP BY
            u.user_id,
            u.full_name

        ORDER BY average_rating DESC NULLS LAST, u.full_name ASC
    `, [
        toParam(semesterId),
        toParam(courseId),
        toParam(instructorId)
    ]);

    return result.rows;
};


// 6. Recent Anonymous Feedback
const getRecentFeedback = async ({
    courseId,
    semesterId,
    instructorId,
    limit
}) => {
    const result = await pool.query(`
        SELECT
            fa.answer_id,
            fa.text_answer,
            fs.submitted_at,
            c.course_name,
            sem.semester_name,
            sem.academic_year

        FROM feedback_answers fa

        INNER JOIN feedback_submissions fs
            ON fs.submission_id = fa.submission_id

        INNER JOIN surveys s
            ON s.survey_id = fs.survey_id

        INNER JOIN course_instructors ci
            ON ci.course_instructor_id = s.course_instructor_id

        INNER JOIN courses c
            ON c.course_id = ci.course_id

        INNER JOIN semesters sem
            ON sem.semester_id = ci.semester_id

        WHERE NULLIF(TRIM(fa.text_answer), '') IS NOT NULL
          AND ($1::int IS NULL OR ci.course_id = $1)
          AND ($2::int IS NULL OR ci.semester_id = $2)
          AND ($3::int IS NULL OR ci.instructor_id = $3)

        ORDER BY fs.submitted_at DESC NULLS LAST, fa.answer_id DESC

        LIMIT $4
    `, [
        toParam(courseId),
        toParam(semesterId),
        toParam(instructorId),
        limit
    ]);

    return result.rows;
};


// Count answered submissions for the comment privacy rule
const countAnsweredSubmissions = async ({
    courseId,
    semesterId,
    instructorId
} = {}) => {
    const result = await pool.query(`
        WITH ${ANSWERED_SUBMISSIONS}
        SELECT COUNT(DISTINCT a.submission_id) AS total

        FROM answered_submissions a

        INNER JOIN surveys s
            ON s.survey_id = a.survey_id

        INNER JOIN course_instructors ci
            ON ci.course_instructor_id = s.course_instructor_id

        WHERE ($1::int IS NULL OR ci.course_id = $1)
          AND ($2::int IS NULL OR ci.semester_id = $2)
          AND ($3::int IS NULL OR ci.instructor_id = $3)
    `, [
        toParam(courseId),
        toParam(semesterId),
        toParam(instructorId)
    ]);

    return Number(result.rows[0].total);
};


// 7. Rating Distribution
const getRatingDistribution = async ({
    courseId,
    semesterId,
    instructorId
} = {}) => {
    const result = await pool.query(`
        SELECT
            r.rating,
            COUNT(ra.answer_id) AS count

        FROM generate_series(1, 5) AS r(rating)

        LEFT JOIN (
            SELECT fa.answer_id, fa.rating_value
            FROM feedback_answers fa

            INNER JOIN feedback_submissions fs
                ON fs.submission_id = fa.submission_id

            INNER JOIN surveys s
                ON s.survey_id = fs.survey_id

            INNER JOIN course_instructors ci
                ON ci.course_instructor_id = s.course_instructor_id

            WHERE fa.rating_value IS NOT NULL
              AND ($1::int IS NULL OR ci.course_id = $1)
              AND ($2::int IS NULL OR ci.semester_id = $2)
              AND ($3::int IS NULL OR ci.instructor_id = $3)
        ) ra
            ON ra.rating_value = r.rating

        GROUP BY r.rating
        ORDER BY r.rating ASC
    `, [
        toParam(courseId),
        toParam(semesterId),
        toParam(instructorId)
    ]);

    return result.rows;
};


// 8. Response Rates
const getResponseRates = async ({
    courseId,
    semesterId,
    instructorId
} = {}) => {
    const result = await pool.query(`
        SELECT
            s.survey_id,
            s.title AS survey_title,
            s.status,
            c.course_id,
            c.course_code,
            c.course_name,
            sem.semester_id,
            sem.semester_name,
            sem.academic_year,

            (
                SELECT COUNT(*)
                FROM enrollments e
                WHERE e.course_id = ci.course_id
                  AND e.semester_id = ci.semester_id
            ) AS enrolled_students,

            (
                SELECT COUNT(*)
                FROM participation p
                WHERE p.survey_id = s.survey_id
            ) AS participated_students

        FROM surveys s

        INNER JOIN course_instructors ci
            ON ci.course_instructor_id = s.course_instructor_id

        INNER JOIN courses c
            ON c.course_id = ci.course_id

        INNER JOIN semesters sem
            ON sem.semester_id = ci.semester_id

        WHERE s.status <> 'Draft'
          AND ($1::int IS NULL OR ci.course_id = $1)
          AND ($2::int IS NULL OR ci.semester_id = $2)
          AND ($3::int IS NULL OR ci.instructor_id = $3)

        ORDER BY sem.start_date ASC, c.course_code ASC, s.survey_id ASC
    `, [
        toParam(courseId),
        toParam(semesterId),
        toParam(instructorId)
    ]);

    return result.rows;
};


// Existence checks for filter values
const EXISTS_QUERIES = {
    course: `
        SELECT EXISTS (
            SELECT 1 FROM courses WHERE course_id = $1
        ) AS found
    `,
    semester: `
        SELECT EXISTS (
            SELECT 1 FROM semesters WHERE semester_id = $1
        ) AS found
    `,
    instructor: `
        SELECT EXISTS (
            SELECT 1 FROM users
            WHERE user_id = $1 AND role = 'Instructor'
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
    getOverview,
    getFeedbackTrends,
    getSemesterComparison,
    getCoursePerformance,
    getInstructorPerformance,
    getRecentFeedback,
    countAnsweredSubmissions,
    getRatingDistribution,
    getResponseRates,
    entityExists
};
