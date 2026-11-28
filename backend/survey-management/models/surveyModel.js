
const pool = require('../../shared/config/db');

const createQuestionMutationError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const withLockedSurvey = async (surveyId, operation) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query('BEGIN');
        transactionStarted = true;

        const surveyResult = await client.query(
            `
                SELECT survey_id
                FROM surveys
                WHERE survey_id = $1
                FOR UPDATE;
            `,
            [surveyId]
        );

        if (surveyResult.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return null;
        }

        const result = await operation(client);

        await client.query('COMMIT');
        transactionStarted = false;
        return result;
    } catch (error) {
        if (transactionStarted) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error(
                    'Failed to roll back question operation:',
                    rollbackError
                );
            }
        }

        throw error;
    } finally {
        client.release();
    }
};

const assertSurveyHasNoResponses = async (client, surveyId) => {
    const responseResult = await client.query(
        `
            SELECT
                EXISTS (
                    SELECT 1
                    FROM participation
                    WHERE survey_id = $1
                )
                OR EXISTS (
                    SELECT 1
                    FROM feedback_submissions
                    WHERE survey_id = $1
                )
                OR EXISTS (
                    SELECT 1
                    FROM feedback_answers AS answer
                    JOIN feedback_submissions AS submission
                        ON submission.submission_id = answer.submission_id
                    WHERE submission.survey_id = $1
                ) AS has_responses;
        `,
        [surveyId]
    );

    if (responseResult.rows[0].has_responses) {
        throw createQuestionMutationError(
            'This survey already has responses. Its questions cannot be added, edited, removed, or reordered.',
            'SURVEY_QUESTIONS_LOCKED'
        );
    }
};

const assertQuestionHasNoAnswers = async (client, questionId) => {
    const answerResult = await client.query(
        `
            SELECT EXISTS (
                SELECT 1
                FROM feedback_answers
                WHERE question_id = $1
            ) AS has_answers;
        `,
        [questionId]
    );

    if (answerResult.rows[0].has_answers) {
        throw createQuestionMutationError(
            'This question already has submitted answers and cannot be changed or deleted.',
            'QUESTION_HAS_ANSWERS'
        );
    }
};

const getQuestionOrder = async (client, surveyId) => {
    const result = await client.query(
        `
            SELECT question_id, display_order
            FROM questions
            WHERE survey_id = $1
            ORDER BY display_order, question_id
            FOR UPDATE;
        `,
        [surveyId]
    );

    return result.rows;
};

const persistQuestionOrder = async (client, surveyId, questionIds) => {
    if (questionIds.length === 0) return;

    const boundsResult = await client.query(
        `
            SELECT
                COALESCE(MAX(display_order), 0) AS max_order,
                COALESCE(MIN(display_order), 0) AS min_order
            FROM questions
            WHERE survey_id = $1;
        `,
        [surveyId]
    );

    const maxOrder = Number(boundsResult.rows[0].max_order);
    const minOrder = Number(boundsResult.rows[0].min_order);
    const offset = maxOrder - minOrder + questionIds.length + 1;

    await client.query(
        `
            UPDATE questions
            SET display_order = display_order + $2
            WHERE survey_id = $1;
        `,
        [surveyId, offset]
    );

    for (const [index, questionId] of questionIds.entries()) {
        const result = await client.query(
            `
                UPDATE questions
                SET display_order = $1
                WHERE question_id = $2
                  AND survey_id = $3;
            `,
            [index + 1, questionId, surveyId]
        );

        if (result.rowCount !== 1) {
            throw new Error(
                `Question ${questionId} could not be reordered for survey ${surveyId}.`
            );
        }
    }
};


// ============================================
// GET ALL SURVEYS
// ============================================

const getAllSurveys = async () => {
    const result = await pool.query(`
        SELECT
            s.survey_id,
            s.title,
            s.description,
            (s.opening_date::date)::text AS opening_date,
            (s.closing_date::date)::text AS closing_date,
            s.status,
            s.created_at,

            c.course_id,
            c.course_code,
            c.course_name,

            sem.semester_id,
            sem.semester_name,
            sem.academic_year,

            u.user_id AS instructor_id,
            u.full_name AS instructor_name,

            (
                SELECT COUNT(DISTINCT e.student_id)
                FROM enrollments AS e
                JOIN users AS student
                    ON student.user_id = e.student_id
                   AND student.role = 'Student'
                WHERE e.course_id = ci.course_id
                  AND e.semester_id = ci.semester_id
            )::INTEGER AS eligible_students,

            (
                SELECT COUNT(DISTINCT p.student_id)
                FROM participation AS p
                WHERE p.survey_id = s.survey_id
                  AND p.status = 'Submitted'
            )::INTEGER AS responses

        FROM surveys AS s

        JOIN course_instructors AS ci
            ON s.course_instructor_id = ci.course_instructor_id

        JOIN courses AS c
            ON ci.course_id = c.course_id

        JOIN semesters AS sem
            ON ci.semester_id = sem.semester_id

        JOIN users AS u
            ON ci.instructor_id = u.user_id

        ORDER BY s.created_at DESC;
    `);

    return result.rows.map((survey) => {
        const eligibleStudents = Number(survey.eligible_students) || 0;
        const responses = Number(survey.responses) || 0;

        return {
            ...survey,
            eligible_students: eligibleStudents,
            responses,
            response_rate: eligibleStudents > 0
                ? Math.round((responses / eligibleStudents) * 1000) / 10
                : null
        };
    });
};


// ============================================
// GET SURVEY BY ID + QUESTIONS
// ============================================

const getSurveyById = async (surveyId) => {
    const surveyResult = await pool.query(
        `
            SELECT
                s.survey_id,
                s.title,
                s.description,
                (s.opening_date::date)::text AS opening_date,
                (s.closing_date::date)::text AS closing_date,
                s.status,
                s.created_at,
                s.course_instructor_id,

                c.course_id,
                c.course_code,
                c.course_name,

                sem.semester_id,
                sem.semester_name,
                sem.academic_year,

                u.user_id AS instructor_id,
                u.full_name AS instructor_name

            FROM surveys AS s

            JOIN course_instructors AS ci
                ON s.course_instructor_id = ci.course_instructor_id

            JOIN courses AS c
                ON ci.course_id = c.course_id

            JOIN semesters AS sem
                ON ci.semester_id = sem.semester_id

            JOIN users AS u
                ON ci.instructor_id = u.user_id

            WHERE s.survey_id = $1;
        `,
        [surveyId]
    );

    const survey = surveyResult.rows[0];

    if (!survey) {
        return null;
    }

    const questionsResult = await pool.query(
        `
            SELECT
                question_id,
                question_text,
                question_type,
                is_required,
                display_order

            FROM questions

            WHERE survey_id = $1

            ORDER BY display_order, question_id;
        `,
        [surveyId]
    );

    const responsesResult = await pool.query(
        `
            SELECT
                EXISTS (
                    SELECT 1
                    FROM participation
                    WHERE survey_id = $1
                )
                OR
                EXISTS (
                    SELECT 1
                    FROM feedback_submissions
                    WHERE survey_id = $1
                ) AS has_responses;
        `,
        [surveyId]
    );

    return {
        ...survey,
        questions: questionsResult.rows,
        has_responses: responsesResult.rows[0].has_responses
    };
};


// ============================================
// CREATE SURVEY
// ============================================

const createSurvey = async (surveyData) => {
    const {
        title,
        description,
        course_instructor_id,
        created_by,
        opening_date,
        closing_date,
        status,
        questions
    } = surveyData;

    const client = await pool.connect();

    let transactionStarted = false;

    try {
        await client.query('BEGIN');
        transactionStarted = true;

        const surveyResult = await client.query(
            `
                INSERT INTO surveys (
                    title,
                    description,
                    course_instructor_id,
                    created_by,
                    opening_date,
                    closing_date,
                    status
                )

                VALUES ($1, $2, $3, $4, $5, $6, $7)

                RETURNING *;
            `,
            [
                title,
                description,
                course_instructor_id,
                created_by,
                opening_date,
                closing_date,
                status
            ]
        );

        const survey = surveyResult.rows[0];

        const savedQuestions = [];

        for (const [index, question] of (questions || []).entries()) {
            const questionResult = await client.query(
                `
                    INSERT INTO questions (
                        survey_id,
                        question_text,
                        question_type,
                        is_required,
                        display_order
                    )

                    VALUES ($1, $2, $3, $4, $5)

                    RETURNING
                        question_id,
                        question_text,
                        question_type,
                        is_required,
                        display_order;
                `,
                [
                    survey.survey_id,
                    question.question_text,
                    question.question_type,
                    question.is_required,
                    index + 1
                ]
            );

            savedQuestions.push(questionResult.rows[0]);
        }

        await client.query('COMMIT');
        transactionStarted = false;

        return {
            ...survey,
            questions: savedQuestions
        };

    } catch (error) {

        if (transactionStarted) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error(
                    'Failed to roll back survey creation:',
                    rollbackError
                );
            }
        }

        throw error;

    } finally {
        client.release();
    }
};


// ============================================
// UPDATE SURVEY + QUESTIONS
// ============================================


const updateSurvey = async (
    surveyId,
    surveyData,
    { requireStatusTransition = false } = {}
) => {
    const {
        title,
        description,
        course_instructor_id,
        opening_date,
        closing_date,
        status,
        questions = []
    } = surveyData;

    const debugQuestionIds =
        process.env.SURVEY_QUESTION_DEBUG === 'true';
    const logQuestionDebug = (...details) => {
        if (debugQuestionIds) {
            console.info('[survey-question-debug] model:', ...details);
        }
    };

    logQuestionDebug(
        'received IDs:',
        questions.map(question => question && question.question_id)
    );

    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query('BEGIN');
        transactionStarted = true;

        // 1. Lock the survey while updating it.
        const existingSurveyResult = await client.query(
            `
                SELECT survey_id, status
                FROM surveys
                WHERE survey_id = $1
                FOR UPDATE;
            `,
            [surveyId]
        );

        if (existingSurveyResult.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return null;
        }

        const currentStatus = existingSurveyResult.rows[0].status;
        const isStatusTransition =
            (currentStatus === 'Draft' && status === 'Published') ||
            (currentStatus === 'Published' && status === 'Closed');
        const validStatusTransition = requireStatusTransition
            ? isStatusTransition
            : currentStatus === status || isStatusTransition;

        if (!validStatusTransition) {
            const error = new Error(
                `Survey status cannot change from ${currentStatus} to ${status}.`
            );
            error.code = 'SURVEY_STATUS_TRANSITION_INVALID';
            throw error;
        }

        // 2. Check whether the survey has responses.
        const responseResult = await client.query(
            `
                SELECT
                    EXISTS (
                        SELECT 1
                        FROM participation
                        WHERE survey_id = $1
                    )
                    OR
                    EXISTS (
                        SELECT 1
                        FROM feedback_submissions
                        WHERE survey_id = $1
                    ) AS has_responses;
            `,
            [surveyId]
        );

        const hasResponses = responseResult.rows[0].has_responses;

        // 3. Retrieve existing questions.
        const existingQuestionsResult = await client.query(
            `
                SELECT
                    question_id,
                    question_text,
                    question_type,
                    is_required,
                    display_order
                FROM questions
                WHERE survey_id = $1
                ORDER BY display_order, question_id;
            `,
            [surveyId]
        );

        const existingQuestions = existingQuestionsResult.rows;

        // 4. Validate incoming question IDs.
        const incomingIds = questions
            .filter(q => q.question_id !== undefined &&
                         q.question_id !== null &&
                         q.question_id !== '')
            .map(q => Number(q.question_id));

        if (incomingIds.some(id => !Number.isInteger(id) || id <= 0)) {
            throw new Error('Invalid question ID.');
        }

        if (new Set(incomingIds).size !== incomingIds.length) {
            throw new Error('Duplicate question IDs are not allowed.');
        }

        const existingIds = existingQuestions.map(q =>
            Number(q.question_id)
        );

        // A question ID must belong to this survey.
        const invalidIds = incomingIds.filter(
            id => !existingIds.includes(id)
        );

        if (invalidIds.length > 0) {
            throw new Error(
                'One or more question IDs do not belong to this survey.'
            );
        }

        // 5. Detect whether questions actually changed.
        const questionsChanged =
            existingQuestions.length !== questions.length ||
            existingQuestions.some((existing, index) => {
                const incoming = questions[index];

                if (!incoming) return true;

                return (
                    Number(incoming.question_id) !==
                        Number(existing.question_id) ||
                    incoming.question_text !== existing.question_text ||
                    incoming.question_type !== existing.question_type ||
                    Boolean(incoming.is_required) !==
                        Boolean(existing.is_required) ||
                    Number(existing.display_order) !== index + 1
                );
            });

        // 6. Do not allow question changes after responses exist.
        if (hasResponses && questionsChanged) {
            const error = new Error(
                'This survey already has student responses. Its questions cannot be modified, added, or removed.'
            );

            error.code = 'SURVEY_QUESTIONS_LOCKED';
            throw error;
        }

        // 7. Update the survey information.
        const updatedSurveyResult = await client.query(
            `
                UPDATE surveys
                SET
                    title = $1,
                    description = $2,
                    course_instructor_id = $3,
                    opening_date = $4,
                    closing_date = $5,
                    status = $6
                WHERE survey_id = $7
                RETURNING *;
            `,
            [
                title,
                description,
                course_instructor_id,
                opening_date,
                closing_date,
                status,
                surveyId
            ]
        );

        // 8. Update, insert, or delete questions.
        // Existing question IDs are preserved.
        if (!hasResponses) {
            const retainedIds = [];

            for (const [index, question] of questions.entries()) {
                const displayOrder = index + 1;

                if (
                    question.question_id !== undefined &&
                    question.question_id !== null &&
                    question.question_id !== ''
                ) {
                    // Existing question: UPDATE without changing its ID.
                    const questionId = Number(question.question_id);

                    logQuestionDebug('UPDATE question ID:', questionId);

                    const updateResult = await client.query(
                        `
                            UPDATE questions
                            SET
                                question_text = $1,
                                question_type = $2,
                                is_required = $3,
                                display_order = $4
                            WHERE question_id = $5
                              AND survey_id = $6
                            RETURNING question_id;
                        `,
                        [
                            question.question_text,
                            question.question_type,
                            question.is_required,
                            displayOrder,
                            questionId,
                            surveyId
                        ]
                    );

                    logQuestionDebug(
                        'UPDATE result:',
                        { questionId, rowCount: updateResult.rowCount }
                    );

                    if (updateResult.rowCount !== 1) {
                        throw new Error(
                            `Question ${questionId} could not be updated for survey ${surveyId}.`
                        );
                    }

                    retainedIds.push(questionId);

                } else {
                    // New question: INSERT and let PostgreSQL generate its ID.
                    logQuestionDebug('INSERT new question at order:', displayOrder);

                    const insertedQuestion = await client.query(
                        `
                            INSERT INTO questions (
                                survey_id,
                                question_text,
                                question_type,
                                is_required,
                                display_order
                            )
                            VALUES ($1, $2, $3, $4, $5)
                            RETURNING question_id;
                        `,
                        [
                            surveyId,
                            question.question_text,
                            question.question_type,
                            question.is_required,
                            displayOrder
                        ]
                    );

                    logQuestionDebug(
                        'INSERT result:',
                        { questionId: insertedQuestion.rows[0].question_id }
                    );

                    retainedIds.push(
                        insertedQuestion.rows[0].question_id
                    );
                }
            }

            // Delete only questions removed from the incoming request.
            for (const existing of existingQuestions) {
                const existingId = Number(existing.question_id);

                if (!retainedIds.includes(existingId)) {
                    await client.query(
                        `
                            DELETE FROM questions
                            WHERE question_id = $1
                              AND survey_id = $2;
                        `,
                        [existingId, surveyId]
                    );
                }
            }
        }

        // 9. Commit the transaction.
        await client.query('COMMIT');
        transactionStarted = false;

        // 10. Retrieve the updated questions with their IDs.
        const updatedQuestionsResult = await client.query(
            `
                SELECT
                    question_id,
                    question_text,
                    question_type,
                    is_required,
                    display_order
                FROM questions
                WHERE survey_id = $1
                ORDER BY display_order, question_id;
            `,
            [surveyId]
        );

        return {
            ...updatedSurveyResult.rows[0],
            questions: updatedQuestionsResult.rows,
            has_responses: hasResponses
        };

    } catch (error) {
        if (transactionStarted) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error(
                    'Failed to roll back survey update:',
                    rollbackError
                );
            }
        }

        throw error;

    } finally {
        client.release();
    }
};


// ============================================
// DELETE SURVEY
// ============================================

const deleteSurvey = async (surveyId) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
        await client.query('BEGIN');
        transactionStarted = true;

        const surveyResult = await client.query(
            `
                SELECT survey_id
                FROM surveys
                WHERE survey_id = $1
                FOR UPDATE;
            `,
            [surveyId]
        );

        if (surveyResult.rowCount === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;
            return null;
        }

        const responseResult = await client.query(
            `
                SELECT
                    EXISTS (
                        SELECT 1
                        FROM participation
                        WHERE survey_id = $1
                    )
                    OR
                    EXISTS (
                        SELECT 1
                        FROM feedback_submissions
                        WHERE survey_id = $1
                    ) AS has_responses;
            `,
            [surveyId]
        );

        if (responseResult.rows[0].has_responses) {
            const error = new Error(
                'This survey has responses and cannot be deleted. Its historical feedback has been preserved.'
            );
            error.code = 'SURVEY_HAS_RESPONSES';
            throw error;
        }

        const deletedSurvey = await client.query(
            `
                DELETE FROM surveys
                WHERE survey_id = $1
                RETURNING survey_id;
            `,
            [surveyId]
        );

        if (deletedSurvey.rowCount !== 1) {
            throw new Error(
                `Survey ${surveyId} could not be deleted.`
            );
        }

        await client.query('COMMIT');
        transactionStarted = false;

        return deletedSurvey.rows[0];

    } catch (error) {
        if (transactionStarted) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error(
                    'Failed to roll back survey deletion:',
                    rollbackError
                );
            }
        }

        throw error;

    } finally {
        client.release();
    }
};

// ============================================
// MANAGE SURVEY QUESTIONS
// ============================================

const addQuestion = async (surveyId, questionData) =>
    withLockedSurvey(surveyId, async (client) => {
        await assertSurveyHasNoResponses(client, surveyId);

        const existingQuestions = await getQuestionOrder(client, surveyId);
        const orderedIds = existingQuestions.map(question =>
            Number(question.question_id)
        );

        await persistQuestionOrder(client, surveyId, orderedIds);

        const result = await client.query(
            `
                INSERT INTO questions (
                    survey_id,
                    question_text,
                    question_type,
                    is_required,
                    display_order
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING
                    question_id,
                    survey_id,
                    question_text,
                    question_type,
                    is_required,
                    display_order;
            `,
            [
                surveyId,
                questionData.question_text,
                questionData.question_type,
                questionData.is_required,
                orderedIds.length + 1
            ]
        );

        return result.rows[0];
    });

const updateQuestion = async (surveyId, questionId, questionData) =>
    withLockedSurvey(surveyId, async (client) => {
        const questionResult = await client.query(
            `
                SELECT question_id
                FROM questions
                WHERE survey_id = $1
                  AND question_id = $2
                FOR UPDATE;
            `,
            [surveyId, questionId]
        );

        if (questionResult.rowCount === 0) return null;

        await assertQuestionHasNoAnswers(client, questionId);
        await assertSurveyHasNoResponses(client, surveyId);

        const result = await client.query(
            `
                UPDATE questions
                SET
                    question_text = $1,
                    question_type = $2,
                    is_required = $3
                WHERE survey_id = $4
                  AND question_id = $5
                RETURNING
                    question_id,
                    survey_id,
                    question_text,
                    question_type,
                    is_required,
                    display_order;
            `,
            [
                questionData.question_text,
                questionData.question_type,
                questionData.is_required,
                surveyId,
                questionId
            ]
        );

        if (result.rowCount !== 1) return null;
        return result.rows[0];
    });

const deleteQuestion = async (surveyId, questionId) =>
    withLockedSurvey(surveyId, async (client) => {
        const questionResult = await client.query(
            `
                SELECT question_id
                FROM questions
                WHERE survey_id = $1
                  AND question_id = $2
                FOR UPDATE;
            `,
            [surveyId, questionId]
        );

        if (questionResult.rowCount === 0) return null;

        await assertQuestionHasNoAnswers(client, questionId);
        await assertSurveyHasNoResponses(client, surveyId);

        const deletedQuestion = await client.query(
            `
                DELETE FROM questions
                WHERE survey_id = $1
                  AND question_id = $2
                RETURNING question_id;
            `,
            [surveyId, questionId]
        );

        if (deletedQuestion.rowCount !== 1) return null;

        const remainingQuestions = await getQuestionOrder(client, surveyId);
        const orderedIds = remainingQuestions.map(question =>
            Number(question.question_id)
        );

        await persistQuestionOrder(client, surveyId, orderedIds);

        return deletedQuestion.rows[0];
    });

const reorderQuestions = async (surveyId, questionIds) =>
    withLockedSurvey(surveyId, async (client) => {
        await assertSurveyHasNoResponses(client, surveyId);

        const currentQuestions = await getQuestionOrder(client, surveyId);
        const currentIds = currentQuestions.map(question =>
            Number(question.question_id)
        );
        const requestedIds = questionIds.map(Number);

        if (
            requestedIds.length !== currentIds.length ||
            new Set(requestedIds).size !== requestedIds.length ||
            requestedIds.some(questionId => !currentIds.includes(questionId))
        ) {
            throw createQuestionMutationError(
                'The order must include every question in this survey exactly once.',
                'QUESTION_ORDER_INVALID'
            );
        }

        await persistQuestionOrder(client, surveyId, requestedIds);

        return getQuestionOrder(client, surveyId);
    });


// ============================================
// GET COURSE INSTRUCTOR ID
// ============================================

const getCourseInstructorId = async (
    courseId,
    semesterId,
    instructorId
) => {
    const result = await pool.query(
        `
            SELECT course_instructor_id

            FROM course_instructors

            WHERE course_id = $1
              AND semester_id = $2
              AND instructor_id = $3;
        `,
        [
            courseId,
            semesterId,
            instructorId
        ]
    );

    return result.rows[0] || null;
};


// ============================================
// GET ALL COURSES
// ============================================

const getAllCourses = async () => {
    const result = await pool.query(
        `
            SELECT
                course_id,
                course_code,
                course_name,
                description

            FROM courses

            ORDER BY course_name;
        `
    );

    return result.rows;
};


// ============================================
// GET ALL SEMESTERS
// ============================================

const getAllSemesters = async () => {
    const result = await pool.query(
        `
            SELECT
                semester_id,
                semester_name,
                academic_year,
                start_date,
                end_date

            FROM semesters

            ORDER BY start_date DESC;
        `
    );

    return result.rows;
};


// ============================================
// GET INSTRUCTORS BY COURSE AND SEMESTER
// ============================================

const getInstructorsByCourseAndSemester = async (
    courseId,
    semesterId
) => {
    const result = await pool.query(
        `
            SELECT
                u.user_id AS instructor_id,
                u.full_name AS instructor_name

            FROM course_instructors AS ci

            JOIN users AS u
                ON ci.instructor_id = u.user_id

            WHERE ci.course_id = $1
              AND ci.semester_id = $2

            ORDER BY u.full_name;
        `,
        [
            courseId,
            semesterId
        ]
    );

    return result.rows;
};


// ============================================
// GET SURVEY STATUS (lifecycle event detection)
// ============================================

const getSurveyStatus = async (surveyId) => {
    const result = await pool.query(
        `
            SELECT status
            FROM surveys
            WHERE survey_id = $1;
        `,
        [surveyId]
    );

    return result.rows[0] ? result.rows[0].status : null;
};


// ============================================
// EXPORTS
// ============================================

module.exports = {
    getAllSurveys,
    getSurveyById,
    getSurveyStatus,
    createSurvey,
    updateSurvey,
    deleteSurvey,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    getCourseInstructorId,
    getAllCourses,
    getAllSemesters,
    getInstructorsByCourseAndSemester
};
