
const pool = require("../../database/db");

// ======================================
// Manage Database Transaction
// ======================================

async function withTransaction(callback, connectionPool = pool) {
    const client = await connectionPool.connect();
    let transactionStarted = false;

    try {
        await client.query("BEGIN");
        transactionStarted = true;

        const result = await callback(client);

        await client.query("COMMIT");
        transactionStarted = false;

        return result;

    } catch (error) {
        if (transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Transaction rollback failed:",
                    rollbackError.message
                );
            }
        }

        throw error;

    } finally {
        client.release();
    }
}

// ======================================
// Check Student Eligibility
// Local development adapter support
// ======================================

async function checkStudentEligibility(surveyId, studentId, db = pool) {
    const query = `
        SELECT EXISTS (
            SELECT 1
            FROM surveys s

            INNER JOIN course_instructors ci
                ON ci.course_instructor_id = s.course_instructor_id

            INNER JOIN enrollments e
                ON e.course_id = ci.course_id
               AND e.semester_id = ci.semester_id

            WHERE s.survey_id = $1
              AND e.student_id = $2
        ) AS eligible;
    `;

    const result = await db.query(query, [
        surveyId,
        studentId
    ]);

    return result.rows[0]?.eligible === true;
}

// ======================================
// Get Survey and Check Whether It Is Open
// ======================================

async function getSurveyForSubmission(client, surveyId) {
    const query = `
        SELECT
            survey_id,
            status,
            opening_date,
            closing_date,
            (
                status = 'Published'
                AND opening_date::date <=
                    (NOW() AT TIME ZONE 'Africa/Cairo')::date
                AND (NOW() AT TIME ZONE 'Africa/Cairo') <
                    (closing_date::date + 1)::timestamp
            ) AS is_open
        FROM surveys
        WHERE survey_id = $1
        FOR UPDATE;
    `;

    const result = await client.query(query, [surveyId]);

    return result.rows[0] || null;
}

// ======================================
// Get Survey Questions
// ======================================

async function getSurveyQuestions(client, surveyId) {
    const query = `
        SELECT
            question_id,
            question_type,
            is_required
        FROM questions
        WHERE survey_id = $1
        ORDER BY display_order ASC;
    `;

    const result = await client.query(query, [surveyId]);

    return result.rows;
}

// ======================================
// Record Student Participation
// ======================================

async function recordParticipation(client, surveyId, studentId) {
    const query = `
        INSERT INTO participation (
            survey_id,
            student_id
        )
        VALUES ($1, $2)
        RETURNING participation_id;
    `;

    const result = await client.query(query, [surveyId, studentId]);
    return result.rows[0] || null;
}

// ======================================
// Create Anonymous Feedback Submission
// ======================================

async function createSubmission(client, surveyId) {
    const query = `
        INSERT INTO feedback_submissions (
            survey_id
        )
        VALUES ($1)
        RETURNING submission_id;
    `;

    const result = await client.query(query, [surveyId]);

    return result.rows[0] || null;
}

// ======================================
// Save One Feedback Answer
// ======================================

async function saveAnswer(
    client,
    submissionId,
    questionId,
    ratingValue,
    textAnswer
) {
    const query = `
        INSERT INTO feedback_answers (
            submission_id,
            question_id,
            rating_value,
            text_answer
        )
        VALUES ($1, $2, $3, $4);
    `;

    await client.query(query, [
        submissionId,
        questionId,
        ratingValue,
        textAnswer
    ]);
}

// ======================================
// Get Idempotency Record
// ======================================

async function getIdempotencyRecord(
    client,
    surveyId,
    studentId,
    idempotencyKeyHash
) {
    const query = `
        SELECT
            payload_hash
        FROM feedback_idempotency
        WHERE survey_id = $1
          AND student_id = $2
          AND idempotency_key_hash = $3
        LIMIT 1;
    `;

    const result = await client.query(query, [
        surveyId,
        studentId,
        idempotencyKeyHash
    ]);

    return result.rows[0] || null;
}

// ======================================
// Save Idempotency Record
// ======================================

async function saveIdempotencyRecord(
    client,
    surveyId,
    studentId,
    idempotencyKeyHash,
    payloadHash
) {
    const query = `
        INSERT INTO feedback_idempotency (
            survey_id,
            student_id,
            idempotency_key_hash,
            payload_hash
        )
        VALUES ($1, $2, $3, $4);
    `;

    await client.query(query, [
        surveyId,
        studentId,
        idempotencyKeyHash,
        payloadHash
    ]);
}

// Return participation and course metadata only. This query intentionally
// never joins feedback_submissions or feedback_answers.
async function getStudentSubmissionMetadata(studentId, db = pool) {
    const query = `
        SELECT
            p.participation_id AS id,
            s.survey_id,
            s.title AS survey_title,
            c.course_name,
            c.course_code,
            sem.semester_name,
            sem.academic_year,
            p.submitted_at,
            COALESCE(to_jsonb(p)->>'status', 'Submitted') AS status
        FROM participation p
        JOIN surveys s
          ON s.survey_id = p.survey_id
        JOIN course_instructors ci
          ON ci.course_instructor_id = s.course_instructor_id
        JOIN courses c
          ON c.course_id = ci.course_id
        JOIN semesters sem
          ON sem.semester_id = ci.semester_id
        WHERE p.student_id = $1
        ORDER BY p.submitted_at DESC, p.participation_id DESC;
    `;

    const result = await db.query(query, [studentId]);
    return result.rows;
}

// ======================================
// Exports
// ======================================

module.exports = {
    withTransaction,
    checkStudentEligibility,
    getSurveyForSubmission,
    getSurveyQuestions,
    recordParticipation,
    createSubmission,
    saveAnswer,
    getIdempotencyRecord,
    saveIdempotencyRecord,
    getStudentSubmissionMetadata
};
