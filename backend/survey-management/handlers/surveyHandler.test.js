const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const pool = require('../../shared/config/db');
const surveyModel = require('../models/surveyModel');
const surveyHandler = require('./surveyHandler');

const originalGetSurveyById = surveyModel.getSurveyById;
const originalGetCourseInstructorId = surveyModel.getCourseInstructorId;
const originalCreateSurvey = surveyModel.createSurvey;
const originalUpdateSurvey = surveyModel.updateSurvey;
const originalDeleteSurvey = surveyModel.deleteSurvey;
const originalAddQuestion = surveyModel.addQuestion;
const originalUpdateQuestion = surveyModel.updateQuestion;
const originalDeleteQuestion = surveyModel.deleteQuestion;
const originalReorderQuestions = surveyModel.reorderQuestions;
const originalPoolConnect = pool.connect;
const originalPoolQuery = pool.query;

const dateInDays = (days) =>
    new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

const validSurvey = () => ({
    title: '  Course feedback  ',
    description: '  End-of-course feedback  ',
    course_id: 2,
    semester_id: 3,
    instructor_id: 4,
    created_by: 1,
    opening_date: dateInDays(1),
    closing_date: dateInDays(8),
    status: 'Draft'
});

afterEach(() => {
    surveyModel.getSurveyById = originalGetSurveyById;
    surveyModel.getCourseInstructorId = originalGetCourseInstructorId;
    surveyModel.createSurvey = originalCreateSurvey;
    surveyModel.updateSurvey = originalUpdateSurvey;
    surveyModel.deleteSurvey = originalDeleteSurvey;
    surveyModel.addQuestion = originalAddQuestion;
    surveyModel.updateQuestion = originalUpdateQuestion;
    surveyModel.deleteQuestion = originalDeleteQuestion;
    surveyModel.reorderQuestions = originalReorderQuestions;
    pool.connect = originalPoolConnect;
    pool.query = originalPoolQuery;
});

test('creates a normalized draft for a valid course assignment', async () => {
    surveyModel.getCourseInstructorId = async (...ids) => {
        assert.deepEqual(ids, [2, 3, 4]);
        return { course_instructor_id: 12 };
    };
    surveyModel.createSurvey = async (survey) => survey;

    const survey = await surveyHandler.createSurvey(validSurvey());

    assert.equal(survey.title, 'Course feedback');
    assert.equal(survey.description, 'End-of-course feedback');
    assert.equal(survey.course_instructor_id, 12);
    assert.equal(survey.status, 'Draft');
});

test('requires a question before publishing a survey', async () => {
    await assert.rejects(
        surveyHandler.createSurvey({
            ...validSurvey(),
            status: 'Published'
        }),
        {
            name: 'SurveyValidationError',
            message: 'Add at least one question before publishing this survey'
        }
    );
});

test('allows publishing with a valid question', async () => {
    surveyModel.getCourseInstructorId = async () => ({
        course_instructor_id: 12
    });
    surveyModel.createSurvey = async (survey) => survey;

    const survey = await surveyHandler.createSurvey({
        ...validSurvey(),
        status: 'Published',
        questions: [{
            question_text: '  How would you rate this course?  ',
            question_type: 'Rating',
            is_required: true
        }]
    });

    assert.equal(survey.status, 'Published');
    assert.deepEqual(survey.questions, [{
        question_id: null,
        question_text: 'How would you rate this course?',
        question_type: 'Rating',
        is_required: true
    }]);
});

test('rejects invalid dates before querying the database', async () => {
    surveyModel.getCourseInstructorId = async () => {
        assert.fail('Invalid survey data must not query course assignments');
    };
    const survey = validSurvey();
    survey.closing_date = survey.opening_date;

    await assert.rejects(
        surveyHandler.createSurvey(survey),
        {
            name: 'SurveyValidationError',
            message: 'Closing date must be after the opening date'
        }
    );
});

test('rejects instructor assignments that do not match the selected course', async () => {
    surveyModel.getCourseInstructorId = async () => null;
    surveyModel.createSurvey = async () => {
        assert.fail('An invalid course assignment must not be inserted');
    };

    await assert.rejects(
        surveyHandler.createSurvey(validSurvey()),
        {
            name: 'SurveyValidationError',
            message: 'The selected instructor is not assigned to this course and semester'
        }
    );
});

test('preserves incoming question IDs through update validation', async () => {
    surveyModel.getCourseInstructorId = async () => ({
        course_instructor_id: 12
    });
    surveyModel.updateSurvey = async (surveyId, survey) => ({
        surveyId,
        ...survey
    });

    const survey = await surveyHandler.updateSurvey(5, {
        ...validSurvey(),
        status: 'Draft',
        questions: [{
            question_id: '39',
            question_text: 'Keep this question',
            question_type: 'Text'
        }]
    });

    assert.equal(survey.surveyId, 5);
    assert.equal(survey.questions[0].question_id, '39');
});

test('validates survey IDs before calling delete model', async () => {
    surveyModel.deleteSurvey = async (surveyId) => surveyId;

    await assert.rejects(
        surveyHandler.deleteSurvey('0'),
        {
            name: 'SurveyValidationError',
            message: 'Survey must be a positive integer'
        }
    );

    assert.equal(await surveyHandler.deleteSurvey('5'), 5);
});

test('validates and normalizes question data before adding', async () => {
    let updateArguments;
    surveyModel.addQuestion = async (...args) => {
        updateArguments = args;
        return { question_id: 73, survey_id: 5 };
    };

    const question = await surveyHandler.addQuestion('5', {
        question_text: '  Rate this course  ',
        question_type: 'Rating',
        is_required: false
    });

    assert.equal(question.question_id, 73);
    assert.deepEqual(updateArguments, [
        5,
        {
            question_text: 'Rate this course',
            question_type: 'Rating',
            is_required: false
        }
    ]);

    await assert.rejects(
        surveyHandler.addQuestion('5', {
            question_text: '   ',
            question_type: 'Text',
            is_required: true
        }),
        {
            name: 'SurveyValidationError',
            message: 'Question text is required'
        }
    );
});

test('validates question IDs and unique reorder input before using the model', async () => {
    surveyModel.updateQuestion = async () => {
        assert.fail('Invalid question IDs must not call the model');
    };

    await assert.rejects(
        surveyHandler.updateQuestion('5', '0', {
            question_text: 'Question',
            question_type: 'Text',
            is_required: true
        }),
        {
            name: 'SurveyValidationError',
            message: 'Question must be a positive integer'
        }
    );

    await assert.rejects(
        surveyHandler.reorderQuestions('5', {
            question_ids: [39, 39]
        }),
        {
            name: 'SurveyValidationError',
            message: 'Question IDs in the order must be unique'
        }
    );
});

test('validates and delegates a survey status action with its existing questions', async () => {
    const openingDate = new Date(2026, 10, 27);
    const closingDate = new Date(2026, 11, 10);
    let updateArguments;

    surveyModel.getSurveyById = async (surveyId) => ({
        survey_id: surveyId,
        title: 'Course feedback',
        description: null,
        course_id: 2,
        semester_id: 3,
        instructor_id: 4,
        opening_date: openingDate,
        closing_date: closingDate,
        status: 'Draft',
        questions: [{
            question_id: 39,
            question_text: 'Rate the course',
            question_type: 'Rating',
            is_required: true
        }]
    });
    surveyModel.getCourseInstructorId = async () => ({
        course_instructor_id: 12
    });
    surveyModel.updateSurvey = async (...args) => {
        updateArguments = args;
        return { survey_id: args[0], ...args[1] };
    };

    const survey = await surveyHandler.changeSurveyStatus(5, 'Published');

    assert.equal(survey.status, 'Published');
    assert.equal(updateArguments[0], 5);
    assert.equal(updateArguments[1].opening_date, '2026-11-27');
    assert.equal(updateArguments[1].closing_date, '2026-12-10');
    assert.equal(updateArguments[1].questions[0].question_id, 39);
    assert.deepEqual(updateArguments[2], {
        requireStatusTransition: true
    });

    await assert.rejects(
        surveyHandler.changeSurveyStatus(5, 'Draft'),
        {
            name: 'SurveyValidationError',
            message: 'Status must be Published or Closed'
        }
    );
});

test('inserts a survey and its questions in one transaction', async () => {
    const queries = [];
    const survey = {
        title: 'Course feedback',
        description: null,
        course_instructor_id: 12,
        created_by: 1,
        opening_date: dateInDays(1),
        closing_date: dateInDays(8),
        status: 'Published',
        questions: [{
            question_text: 'Rate the course',
            question_type: 'Rating',
            is_required: true
        }]
    };
    const client = {
        query: async (query, values) => {
            const sql = query.trim();
            queries.push({ sql, values });

            if (sql === 'BEGIN' || sql === 'COMMIT') {
                return { rows: [] };
            }

            if (sql.includes('INSERT INTO surveys')) {
                return { rows: [{ survey_id: 42, ...survey }] };
            }

            if (sql.includes('INSERT INTO questions')) {
                return {
                    rows: [{
                        question_id: 7,
                        question_text: values[1],
                        question_type: values[2],
                        is_required: values[3],
                        display_order: values[4]
                    }]
                };
            }

            assert.fail(`Unexpected SQL query: ${sql}`);
        },
        release: () => queries.push({ sql: 'RELEASE' })
    };
    pool.connect = async () => client;

    const savedSurvey = await surveyModel.createSurvey(survey);
    const surveyInsert = queries.find(({ sql }) => sql.includes('INSERT INTO surveys'));
    const questionInsert = queries.find(({ sql }) => sql.includes('INSERT INTO questions'));

    assert.match(surveyInsert.sql, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7\)/);
    assert.equal(surveyInsert.values[6], 'Published');
    assert.match(questionInsert.sql, /INSERT INTO questions/);
    assert.deepEqual(questionInsert.values, [
        42,
        'Rate the course',
        'Rating',
        true,
        1
    ]);
    assert.deepEqual(queries.map(({ sql }) => sql), [
        'BEGIN',
        surveyInsert.sql,
        questionInsert.sql,
        'COMMIT',
        'RELEASE'
    ]);
    assert.equal(savedSurvey.survey_id, 42);
    assert.equal(savedSurvey.questions[0].question_id, 7);
});

test('rolls back a survey when a question insert fails', async () => {
    const queries = [];
    const client = {
        query: async (query) => {
            const sql = query.trim();
            queries.push(sql);

            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
                return { rows: [] };
            }

            if (sql.includes('INSERT INTO surveys')) {
                return { rows: [{ survey_id: 42 }] };
            }

            if (sql.includes('INSERT INTO questions')) {
                throw new Error('Question insert failed');
            }

            assert.fail(`Unexpected SQL query: ${sql}`);
        },
        release: () => queries.push('RELEASE')
    };
    pool.connect = async () => client;

    await assert.rejects(
        surveyModel.createSurvey({
            ...validSurvey(),
            course_instructor_id: 12,
            questions: [{
                question_text: 'Rate the course',
                question_type: 'Rating',
                is_required: true
            }]
        }),
        /Question insert failed/
    );

    assert.equal(queries[0], 'BEGIN');
    assert.match(queries[1], /INSERT INTO surveys/);
    assert.match(queries[2], /INSERT INTO questions/);
    assert.deepEqual(queries.slice(3), ['ROLLBACK', 'RELEASE']);
});

const validUpdate = (questions) => ({
    title: 'Course feedback',
    description: 'End-of-course feedback',
    course_instructor_id: 12,
    opening_date: dateInDays(1),
    closing_date: dateInDays(8),
    status: 'Published',
    questions
});

const withSurveyUpdateDatabase = ({
    existingQuestions,
    hasResponses = false,
    nextQuestionId = 42,
    currentStatus = 'Draft'
}) => {
    const queries = [];
    const questions = existingQuestions.map((question) => ({ ...question }));
    let existingQuestionsRead = false;
    let generatedQuestionId = nextQuestionId;
    let released = false;

    const client = {
        query: async (query, values = []) => {
            const sql = query.trim();
            queries.push({ sql, values });

            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) {
                return { rows: [], rowCount: 0 };
            }

            if (sql.includes('FROM surveys') && sql.includes('FOR UPDATE')) {
                return {
                    rows: [{ survey_id: 5, status: currentStatus }],
                    rowCount: 1
                };
            }

            if (sql.includes('AS has_responses')) {
                return { rows: [{ has_responses: hasResponses }], rowCount: 1 };
            }

            if (sql.includes('FROM questions') && sql.includes('WHERE survey_id = $1')) {
                if (!existingQuestionsRead) {
                    existingQuestionsRead = true;
                    return { rows: existingQuestions, rowCount: existingQuestions.length };
                }

                return {
                    rows: questions
                        .slice()
                        .sort((left, right) => left.display_order - right.display_order),
                    rowCount: questions.length
                };
            }

            if (sql.includes('UPDATE surveys')) {
                return {
                    rows: [{
                        survey_id: 5,
                        ...validUpdate([]),
                        status: values[5]
                    }],
                    rowCount: 1
                };
            }

            if (sql.includes('UPDATE questions')) {
                const question = questions.find(
                    (item) => item.question_id === values[4] &&
                        item.survey_id === values[5]
                );

                if (question) {
                    question.question_text = values[0];
                    question.question_type = values[1];
                    question.is_required = values[2];
                    question.display_order = values[3];
                }

                return { rows: [], rowCount: question ? 1 : 0 };
            }

            if (sql.includes('INSERT INTO questions')) {
                const question = {
                    question_id: generatedQuestionId++,
                    survey_id: values[0],
                    question_text: values[1],
                    question_type: values[2],
                    is_required: values[3],
                    display_order: values[4]
                };
                questions.push(question);
                return { rows: [{ question_id: question.question_id }], rowCount: 1 };
            }

            if (sql.includes('DELETE FROM questions')) {
                const index = questions.findIndex(
                    (item) => item.question_id === values[0] &&
                        item.survey_id === values[1]
                );

                if (index >= 0) {
                    questions.splice(index, 1);
                }

                return { rows: [], rowCount: index >= 0 ? 1 : 0 };
            }

            assert.fail(`Unexpected SQL query: ${sql}`);
        },
        release: () => {
            released = true;
        }
    };

    pool.connect = async () => client;

    return {
        queries,
        questions,
        wasReleased: () => released
    };
};

const existingQuestion = (questionId, overrides = {}) => ({
    question_id: questionId,
    survey_id: 5,
    question_text: `Question ${questionId}`,
    question_type: 'Text',
    is_required: true,
    display_order: 1,
    ...overrides
});

const withSurveyDeleteDatabase = ({
    hasResponses = false,
    surveyExists = true
}) => {
    const queries = [];
    let deleted = false;
    const client = {
        query: async (query, values = []) => {
            const sql = query.trim();
            queries.push({ sql, values });

            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) {
                return { rows: [], rowCount: 0 };
            }

            if (sql.includes('FROM surveys') && sql.includes('FOR UPDATE')) {
                return {
                    rows: surveyExists ? [{ survey_id: 5 }] : [],
                    rowCount: surveyExists ? 1 : 0
                };
            }

            if (sql.includes('AS has_responses')) {
                return { rows: [{ has_responses: hasResponses }], rowCount: 1 };
            }

            if (sql.includes('DELETE FROM surveys')) {
                deleted = true;
                return { rows: [{ survey_id: values[0] }], rowCount: 1 };
            }

            assert.fail(`Unexpected SQL query: ${sql}`);
        },
        release: () => {}
    };

    pool.connect = async () => client;

    return {
        queries,
        wasDeleted: () => deleted
    };
};

const withQuestionMutationDatabase = ({
    existingQuestions,
    surveyExists = true,
    hasResponses = false,
    answeredQuestionIds = [],
    nextQuestionId = 73
}) => {
    const queries = [];
    const questions = existingQuestions.map((question) => ({ ...question }));
    const answeredIds = new Set(answeredQuestionIds);
    let generatedQuestionId = nextQuestionId;
    let released = false;

    const client = {
        query: async (query, values = []) => {
            const sql = query.trim();
            queries.push({ sql, values });

            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) {
                return { rows: [], rowCount: 0 };
            }

            if (sql.includes('FROM surveys') && sql.includes('FOR UPDATE')) {
                return {
                    rows: surveyExists ? [{ survey_id: 5 }] : [],
                    rowCount: surveyExists ? 1 : 0
                };
            }

            if (sql.includes('AS has_responses')) {
                return {
                    rows: [{ has_responses: hasResponses }],
                    rowCount: 1
                };
            }

            if (sql.includes('FROM feedback_answers')) {
                return {
                    rows: [{
                        has_answers: answeredIds.has(Number(values[0]))
                    }],
                    rowCount: 1
                };
            }

            if (
                /SELECT question_id\s+FROM questions/.test(sql) &&
                sql.includes('FOR UPDATE')
            ) {
                const question = questions.find(
                    (item) =>
                        Number(item.survey_id) === Number(values[0]) &&
                        Number(item.question_id) === Number(values[1])
                );

                return {
                    rows: question ? [{ question_id: question.question_id }] : [],
                    rowCount: question ? 1 : 0
                };
            }

            if (sql.includes('SELECT question_id, display_order')) {
                const selectedQuestions = questions
                    .filter((question) =>
                        Number(question.survey_id) === Number(values[0])
                    )
                    .sort((left, right) =>
                        Number(left.display_order) - Number(right.display_order) ||
                        Number(left.question_id) - Number(right.question_id)
                    );

                return {
                    rows: selectedQuestions,
                    rowCount: selectedQuestions.length
                };
            }

            if (sql.includes('COALESCE(MAX(display_order)')) {
                const orders = questions
                    .filter((question) =>
                        Number(question.survey_id) === Number(values[0])
                    )
                    .map((question) => Number(question.display_order));

                return {
                    rows: [{
                        max_order: orders.length ? Math.max(...orders) : 0,
                        min_order: orders.length ? Math.min(...orders) : 0
                    }],
                    rowCount: 1
                };
            }

            if (
                sql.includes('UPDATE questions') &&
                sql.includes('display_order = display_order + $2')
            ) {
                for (const question of questions) {
                    if (Number(question.survey_id) === Number(values[0])) {
                        question.display_order =
                            Number(question.display_order) + Number(values[1]);
                    }
                }

                return { rows: [], rowCount: questions.length };
            }

            if (
                sql.includes('UPDATE questions') &&
                sql.includes('question_text = $1')
            ) {
                const question = questions.find(
                    (item) =>
                        Number(item.survey_id) === Number(values[3]) &&
                        Number(item.question_id) === Number(values[4])
                );

                if (question) {
                    question.question_text = values[0];
                    question.question_type = values[1];
                    question.is_required = values[2];
                }

                return {
                    rows: question ? [{ ...question }] : [],
                    rowCount: question ? 1 : 0
                };
            }

            if (
                sql.includes('UPDATE questions') &&
                sql.includes('SET display_order = $1')
            ) {
                const question = questions.find(
                    (item) =>
                        Number(item.question_id) === Number(values[1]) &&
                        Number(item.survey_id) === Number(values[2])
                );

                if (question) question.display_order = values[0];
                return { rows: [], rowCount: question ? 1 : 0 };
            }

            if (sql.includes('INSERT INTO questions')) {
                const question = {
                    question_id: generatedQuestionId++,
                    survey_id: values[0],
                    question_text: values[1],
                    question_type: values[2],
                    is_required: values[3],
                    display_order: values[4]
                };
                questions.push(question);
                return {
                    rows: [{ ...question }],
                    rowCount: 1
                };
            }

            if (sql.includes('DELETE FROM questions')) {
                const index = questions.findIndex(
                    (item) =>
                        Number(item.survey_id) === Number(values[0]) &&
                        Number(item.question_id) === Number(values[1])
                );
                const deletedQuestion = index >= 0
                    ? questions.splice(index, 1)[0]
                    : null;

                return {
                    rows: deletedQuestion
                        ? [{ question_id: deletedQuestion.question_id }]
                        : [],
                    rowCount: deletedQuestion ? 1 : 0
                };
            }

            assert.fail(`Unexpected question SQL query: ${sql}`);
        },
        release: () => {
            released = true;
        }
    };

    pool.connect = async () => client;

    return {
        queries,
        questions,
        wasReleased: () => released
    };
};

test('updates question 39 in place without inserting a replacement', async () => {
    const database = withSurveyUpdateDatabase({
        existingQuestions: [existingQuestion(39)]
    });

    const survey = await surveyModel.updateSurvey(5, validUpdate([{
        question_id: 39,
        question_text: 'Updated question',
        question_type: 'Text',
        is_required: true
    }]));

    assert.equal(survey.questions[0].question_id, 39);
    assert.equal(survey.questions[0].question_text, 'Updated question');
    assert.equal(database.questions.length, 1);
    assert.equal(database.queries.filter(({ sql }) => sql.includes('UPDATE questions')).length, 1);
    assert.equal(database.queries.filter(({ sql }) => sql.includes('INSERT INTO questions')).length, 0);
    assert.equal(database.wasReleased(), true);
});

test('allows Draft to Published when survey fields and questions are valid', async () => {
    const database = withSurveyUpdateDatabase({
        existingQuestions: [existingQuestion(39)],
        currentStatus: 'Draft'
    });

    const survey = await surveyModel.updateSurvey(5, validUpdate([{
        question_id: 39,
        question_text: 'Question 39',
        question_type: 'Text',
        is_required: true
    }]));

    assert.equal(survey.status, 'Published');
    assert.equal(database.queries.some(({ sql }) => sql === 'COMMIT'), true);
});

test('rejects invalid status transitions without changing survey data', async () => {
    const database = withSurveyUpdateDatabase({
        existingQuestions: [existingQuestion(39)],
        currentStatus: 'Published'
    });

    await assert.rejects(
        surveyModel.updateSurvey(5, {
            ...validUpdate([{
                question_id: 39,
                question_text: 'Question 39',
                question_type: 'Text',
                is_required: true
            }]),
            status: 'Draft'
        }),
        { code: 'SURVEY_STATUS_TRANSITION_INVALID' }
    );

    assert.equal(database.queries.some(({ sql }) => sql.includes('UPDATE surveys')), false);
    assert.equal(database.queries.some(({ sql }) => sql === 'ROLLBACK'), true);
});

test('rejects a repeated publish transition', async () => {
    const database = withSurveyUpdateDatabase({
        existingQuestions: [existingQuestion(39)],
        currentStatus: 'Published'
    });

    await assert.rejects(
        surveyModel.updateSurvey(
            5,
            validUpdate([{
                question_id: 39,
                question_text: 'Question 39',
                question_type: 'Text',
                is_required: true
            }]),
            { requireStatusTransition: true }
        ),
        { code: 'SURVEY_STATUS_TRANSITION_INVALID' }
    );

    assert.equal(database.queries.some(({ sql }) => sql.includes('UPDATE surveys')), false);
    assert.equal(database.queries.some(({ sql }) => sql === 'ROLLBACK'), true);
});

test('allows Published to Closed while preserving question IDs', async () => {
    const database = withSurveyUpdateDatabase({
        existingQuestions: [existingQuestion(39)],
        currentStatus: 'Published'
    });

    const survey = await surveyModel.updateSurvey(5, {
        ...validUpdate([{
            question_id: 39,
            question_text: 'Question 39',
            question_type: 'Text',
            is_required: true
        }]),
        status: 'Closed'
    });

    assert.equal(survey.status, 'Closed');
    assert.equal(survey.questions[0].question_id, 39);
    assert.equal(database.queries.some(({ sql }) => sql === 'COMMIT'), true);
});

test('inserts a new question without supplying a question ID', async () => {
    const database = withSurveyUpdateDatabase({
        existingQuestions: [existingQuestion(39)]
    });

    const survey = await surveyModel.updateSurvey(5, validUpdate([
        {
            question_id: 39,
            question_text: 'Question 39',
            question_type: 'Text',
            is_required: true
        },
        {
            question_text: 'New question',
            question_type: 'Rating',
            is_required: false
        }
    ]));

    assert.deepEqual(
        survey.questions.map(({ question_id }) => question_id),
        [39, 42]
    );
    assert.equal(database.queries.filter(({ sql }) => sql.includes('INSERT INTO questions')).length, 1);
});

test('preserves an existing question ID when only its text changes', async () => {
    const database = withSurveyUpdateDatabase({
        existingQuestions: [existingQuestion(39)]
    });

    const survey = await surveyModel.updateSurvey(5, validUpdate([{
        question_id: 39,
        question_text: 'Changed text',
        question_type: 'Text',
        is_required: true
    }]));

    assert.equal(survey.questions[0].question_id, 39);
    assert.equal(survey.questions[0].question_text, 'Changed text');
    assert.equal(database.questions[0].question_id, 39);
});

test('deletes only removed questions when the survey has no responses', async () => {
    const database = withSurveyUpdateDatabase({
        existingQuestions: [
            existingQuestion(39),
            existingQuestion(40, { display_order: 2 })
        ]
    });

    const survey = await surveyModel.updateSurvey(5, validUpdate([{
        question_id: 40,
        question_text: 'Question 40',
        question_type: 'Text',
        is_required: true
    }]));

    const deletes = database.queries.filter(({ sql }) => sql.includes('DELETE FROM questions'));
    assert.deepEqual(deletes.map(({ values }) => values), [[39, 5]]);
    assert.deepEqual(
        survey.questions.map(({ question_id }) => question_id),
        [40]
    );
});

test('rejects question changes when responses exist and rolls back', async () => {
    const database = withSurveyUpdateDatabase({
        existingQuestions: [existingQuestion(39)],
        hasResponses: true
    });

    await assert.rejects(
        surveyModel.updateSurvey(5, validUpdate([{
            question_id: 39,
            question_text: 'Changed after responses',
            question_type: 'Text',
            is_required: true
        }])),
        { code: 'SURVEY_QUESTIONS_LOCKED' }
    );

    assert.equal(database.queries.some(({ sql }) => sql.includes('UPDATE questions')), false);
    assert.equal(database.queries.some(({ sql }) => sql.includes('INSERT INTO questions')), false);
    assert.equal(database.queries.some(({ sql }) => sql.includes('DELETE FROM questions')), false);
    assert.equal(database.queries.some(({ sql }) => sql === 'ROLLBACK'), true);
});

test('rejects a question ID owned by a different survey before updating', async () => {
    const database = withSurveyUpdateDatabase({
        existingQuestions: [existingQuestion(39)]
    });

    await assert.rejects(
        surveyModel.updateSurvey(5, validUpdate([{
            question_id: 88,
            question_text: 'Foreign question',
            question_type: 'Text',
            is_required: true
        }])),
        /do not belong to this survey/
    );

    assert.equal(database.queries.some(({ sql }) => sql.includes('UPDATE questions')), false);
    assert.equal(database.queries.some(({ sql }) => sql.includes('INSERT INTO questions')), false);
    assert.equal(database.queries.some(({ sql }) => sql === 'ROLLBACK'), true);
});

test('GET after PUT returns the persisted question ID and updated data', async () => {
    const database = withSurveyUpdateDatabase({
        existingQuestions: [existingQuestion(39)]
    });

    await surveyModel.updateSurvey(5, validUpdate([{
        question_id: 39,
        question_text: 'Fetched after the update',
        question_type: 'Text',
        is_required: false
    }]));

    pool.query = async (query) => {
        const sql = query.trim();

        if (sql.includes('WHERE s.survey_id = $1')) {
            return { rows: [{ survey_id: 5, title: 'Course feedback' }] };
        }

        if (sql.includes('FROM questions')) {
            return {
                rows: database.questions
                    .slice()
                    .sort((left, right) => left.display_order - right.display_order)
            };
        }

        if (sql.includes('AS has_responses')) {
            return { rows: [{ has_responses: false }] };
        }

        assert.fail(`Unexpected GET query: ${sql}`);
    };

    const fetchedSurvey = await surveyModel.getSurveyById(5);

    assert.equal(fetchedSurvey.questions[0].question_id, 39);
    assert.equal(fetchedSurvey.questions[0].question_text, 'Fetched after the update');
    assert.equal(fetchedSurvey.questions[0].is_required, false);
});

test('deletes a survey without responses and relies on database question cascade', async () => {
    const database = withSurveyDeleteDatabase({ hasResponses: false });

    const deletedSurvey = await surveyModel.deleteSurvey(5);

    assert.deepEqual(deletedSurvey, { survey_id: 5 });
    assert.equal(database.wasDeleted(), true);
    assert.equal(database.queries.some(({ sql }) => sql.includes('DELETE FROM questions')), false);
    assert.equal(database.queries.some(({ sql }) => sql === 'COMMIT'), true);
});

test('preserves surveys with responses and does not issue DELETE', async () => {
    const database = withSurveyDeleteDatabase({ hasResponses: true });

    await assert.rejects(
        surveyModel.deleteSurvey(5),
        { code: 'SURVEY_HAS_RESPONSES' }
    );

    assert.equal(database.wasDeleted(), false);
    assert.equal(database.queries.some(({ sql }) => sql.includes('DELETE FROM surveys')), false);
    assert.equal(database.queries.some(({ sql }) => sql === 'ROLLBACK'), true);
});

test('returns null when deleting a survey that does not exist', async () => {
    const database = withSurveyDeleteDatabase({
        hasResponses: false,
        surveyExists: false
    });

    assert.equal(await surveyModel.deleteSurvey(99), null);
    assert.equal(database.wasDeleted(), false);
    assert.equal(database.queries.some(({ sql }) => sql === 'ROLLBACK'), true);
});

test('adds a question with a database-generated ID and next sequential order', async () => {
    const database = withQuestionMutationDatabase({
        existingQuestions: [
            existingQuestion(39),
            existingQuestion(40, { display_order: 2 })
        ]
    });

    const question = await surveyModel.addQuestion(5, {
        question_text: 'New rating question',
        question_type: 'Rating',
        is_required: false
    });

    assert.equal(question.question_id, 73);
    assert.equal(question.survey_id, 5);
    assert.equal(question.display_order, 3);
    assert.equal(database.queries.some(({ sql }) => sql.includes('INSERT INTO questions')), true);
    assert.equal(database.queries.some(({ sql }) => sql === 'COMMIT'), true);
    assert.equal(database.wasReleased(), true);
});

test('updates only the selected survey question and preserves its ID', async () => {
    const database = withQuestionMutationDatabase({
        existingQuestions: [existingQuestion(39)]
    });

    const question = await surveyModel.updateQuestion(5, 39, {
        question_text: 'Edited wording',
        question_type: 'Text',
        is_required: false
    });

    assert.equal(question.question_id, 39);
    assert.equal(question.survey_id, 5);
    assert.equal(question.question_text, 'Edited wording');
    assert.equal(database.queries.some(({ sql }) => sql.includes('UPDATE questions') && sql.includes('question_text = $1')), true);
    assert.equal(database.queries.some(({ sql }) => sql.includes('INSERT INTO questions')), false);
});

test('does not update a question belonging to another survey', async () => {
    const database = withQuestionMutationDatabase({
        existingQuestions: [existingQuestion(88, { survey_id: 6 })]
    });

    assert.equal(
        await surveyModel.updateQuestion(5, 88, {
            question_text: 'Foreign question',
            question_type: 'Text',
            is_required: true
        }),
        null
    );
    assert.equal(database.queries.some(({ sql }) => sql.includes('UPDATE questions') && sql.includes('question_text = $1')), false);
    assert.equal(database.queries.some(({ sql }) => sql === 'COMMIT'), true);
});

test('blocks question changes when the survey has submitted responses', async () => {
    const database = withQuestionMutationDatabase({
        existingQuestions: [existingQuestion(39)],
        hasResponses: true
    });

    await assert.rejects(
        surveyModel.updateQuestion(5, 39, {
            question_text: 'Changed after answers',
            question_type: 'Text',
            is_required: true
        }),
        { code: 'SURVEY_QUESTIONS_LOCKED' }
    );

    assert.equal(database.queries.some(({ sql }) => sql.includes('UPDATE questions') && sql.includes('question_text = $1')), false);
    assert.equal(database.queries.some(({ sql }) => sql === 'ROLLBACK'), true);
});

test('blocks deletion of a question referenced by submitted answers', async () => {
    const database = withQuestionMutationDatabase({
        existingQuestions: [existingQuestion(39)],
        answeredQuestionIds: [39]
    });

    await assert.rejects(
        surveyModel.deleteQuestion(5, 39),
        { code: 'QUESTION_HAS_ANSWERS' }
    );

    assert.equal(database.queries.some(({ sql }) => sql.includes('DELETE FROM questions')), false);
    assert.equal(database.queries.some(({ sql }) => sql === 'ROLLBACK'), true);
});

test('deletes only the selected unanswered question and closes the display-order gap', async () => {
    const database = withQuestionMutationDatabase({
        existingQuestions: [
            existingQuestion(39),
            existingQuestion(40, { display_order: 2 }),
            existingQuestion(41, { display_order: 3 })
        ]
    });

    const deleted = await surveyModel.deleteQuestion(5, 40);

    assert.deepEqual(deleted, { question_id: 40 });
    assert.deepEqual(
        database.questions
            .slice()
            .sort((left, right) => left.display_order - right.display_order)
            .map(({ question_id, display_order }) => [question_id, display_order]),
        [[39, 1], [41, 2]]
    );
    assert.equal(database.queries.some(({ sql }) => sql === 'COMMIT'), true);
});

test('persists question reordering as sequential display orders', async () => {
    const database = withQuestionMutationDatabase({
        existingQuestions: [
            existingQuestion(39),
            existingQuestion(40, { display_order: 2 }),
            existingQuestion(41, { display_order: 3 })
        ]
    });

    const questions = await surveyModel.reorderQuestions(5, [41, 39, 40]);

    assert.deepEqual(
        questions.map(({ question_id, display_order }) => [
            question_id,
            display_order
        ]),
        [[41, 1], [39, 2], [40, 3]]
    );
    assert.equal(database.queries.some(({ sql }) => sql === 'COMMIT'), true);
});

test('rejects reorder input that omits a question in the survey', async () => {
    const database = withQuestionMutationDatabase({
        existingQuestions: [
            existingQuestion(39),
            existingQuestion(40, { display_order: 2 })
        ]
    });

    await assert.rejects(
        surveyModel.reorderQuestions(5, [39]),
        { code: 'QUESTION_ORDER_INVALID' }
    );

    assert.equal(database.queries.some(({ sql }) => sql.includes('UPDATE questions') && sql.includes('display_order = display_order + $2')), false);
    assert.equal(database.queries.some(({ sql }) => sql === 'ROLLBACK'), true);
});
