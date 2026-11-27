const pool = require('../../shared/config/db');

const getDashboardStats = async () => {
    const result = await pool.query(`
        SELECT
            (SELECT COUNT(*) FROM surveys) AS total_surveys,
            (SELECT COUNT(*) FROM surveys WHERE status = 'Published') AS published_surveys,
            (SELECT COUNT(*) FROM feedback_submissions) AS total_responses,
            (SELECT COUNT(*) FROM courses) AS total_courses
    `);

    return {
        total_surveys: Number(result.rows[0].total_surveys),
        published_surveys: Number(result.rows[0].published_surveys),
        total_responses: Number(result.rows[0].total_responses),
        total_courses: Number(result.rows[0].total_courses)
    };
};

const getResponseTrend = async () => {
    const result = await pool.query(`
        SELECT
            TO_CHAR(months.month, 'Mon') AS month,
            COALESCE(COUNT(feedback.submission_id), 0)::INTEGER AS responses
        FROM generate_series(
            DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
            DATE_TRUNC('month', CURRENT_DATE),
            INTERVAL '1 month'
        ) AS months(month)
        LEFT JOIN feedback_submissions AS feedback
            ON DATE_TRUNC('month', feedback.submitted_at) = months.month
        GROUP BY months.month
        ORDER BY months.month;
    `);

    return result.rows;
};

const getSurveyStatus = async () => {
    const result = await pool.query(`
        SELECT
            status,
            COUNT(*)::INTEGER AS total
        FROM surveys
        GROUP BY status
        ORDER BY
            CASE status
                WHEN 'Draft' THEN 1
                WHEN 'Published' THEN 2
                WHEN 'Closed' THEN 3
            END;
    `);

    return result.rows;
};

const getRecentSurveys = async () => {
    const result = await pool.query(`
        SELECT
            s.survey_id,
            s.title,
            c.course_name,
            u.full_name AS instructor_name,
            s.status,
            s.created_at
        FROM surveys AS s
        JOIN course_instructors AS ci
            ON s.course_instructor_id = ci.course_instructor_id
        JOIN courses AS c
            ON ci.course_id = c.course_id
        JOIN users AS u
            ON ci.instructor_id = u.user_id
        ORDER BY s.created_at DESC
        LIMIT 5;
    `);

    return result.rows;
};

module.exports = {
    getDashboardStats,
    getResponseTrend,
    getSurveyStatus,
    getRecentSurveys
};
