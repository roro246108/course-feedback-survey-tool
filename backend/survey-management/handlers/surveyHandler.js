
const surveyModel = require('../models/surveyModel');

const QUESTION_TYPES = new Set(['Text', 'Rating']);

const SURVEY_STATUSES = new Set([
    'Draft',
    'Published',
    'Closed'
]);


class SurveyValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SurveyValidationError';
        this.statusCode = 400;
    }
}


// ============================================
// VALIDATION HELPERS
// ============================================

const parsePositiveInteger = (value, fieldName) => {
    const parsedValue = Number(value);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new SurveyValidationError(
            `${fieldName} must be a positive integer`
        );
    }

    return parsedValue;
};


const isValidDate = (value) => {
    if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const [year, month, day] = value.split('-').map(Number);

    const parsedDate = new Date(
        Date.UTC(year, month - 1, day)
    );

    return (
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day
    );
};

const normalizeStoredDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = String(value.getFullYear()).padStart(4, '0');
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    if (typeof value === 'string') {
        const dateMatch = /^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/.exec(value);
        if (dateMatch) return dateMatch[1];
    }

    return value;
};

const normalizeQuestionData = (body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new SurveyValidationError(
            'Question data must be an object'
        );
    }

    const questionText =
        typeof body.question_text === 'string'
            ? body.question_text.trim()
            : '';

    if (!questionText) {
        throw new SurveyValidationError(
            'Question text is required'
        );
    }

    if (!QUESTION_TYPES.has(body.question_type)) {
        throw new SurveyValidationError(
            'Question type must be Text or Rating'
        );
    }

    if (typeof body.is_required !== 'boolean') {
        throw new SurveyValidationError(
            'Required setting must be true or false'
        );
    }

    return {
        question_text: questionText,
        question_type: body.question_type,
        is_required: body.is_required
    };
};


const validateSurveyQuestions = (questions) => {
    if (!Array.isArray(questions)) {
        throw new SurveyValidationError(
            'Questions must be an array'
        );
    }

    return questions.map((question, index) => {
        const questionNumber = index + 1;

        if (!question || typeof question !== 'object') {
            throw new SurveyValidationError(
                `Question ${questionNumber} is invalid`
            );
        }

        const questionText =
            typeof question.question_text === 'string'
                ? question.question_text.trim()
                : '';

        if (!questionText) {
            throw new SurveyValidationError(
                `Question ${questionNumber} text is required`
            );
        }

        if (!QUESTION_TYPES.has(question.question_type)) {
            throw new SurveyValidationError(
                `Question ${questionNumber} must use Text or Rating type`
            );
        }

        const isRequired = question.is_required ?? true;

        if (typeof isRequired !== 'boolean') {
            throw new SurveyValidationError(
                `Question ${questionNumber} required setting must be true or false`
            );
        }

        return {
            question_id: question.question_id ?? null,
            question_text: questionText,
            question_type: question.question_type,
            is_required: isRequired
        };
    });
};


// ============================================
// GET OPERATIONS
// ============================================

const getAllSurveys = () =>
    surveyModel.getAllSurveys();


const getSurveyById = (surveyId) =>
    surveyModel.getSurveyById(surveyId);


const getAllCourses = () =>
    surveyModel.getAllCourses();


const getAllSemesters = () =>
    surveyModel.getAllSemesters();


const getInstructorsByCourseAndSemester = async (
    courseId,
    semesterId
) => {
    const normalizedCourseId = parsePositiveInteger(
        courseId,
        'Course'
    );

    const normalizedSemesterId = parsePositiveInteger(
        semesterId,
        'Semester'
    );

    return surveyModel.getInstructorsByCourseAndSemester(
        normalizedCourseId,
        normalizedSemesterId
    );
};


// ============================================
// CREATE SURVEY
// ============================================

const createSurvey = async (surveyData) => {
    const body =
        surveyData && typeof surveyData === 'object'
            ? surveyData
            : {};

    const title =
        typeof body.title === 'string'
            ? body.title.trim()
            : '';

    if (!title) {
        throw new SurveyValidationError(
            'Survey title is required'
        );
    }

    if (title.length > 200) {
        throw new SurveyValidationError(
            'Survey title cannot exceed 200 characters'
        );
    }

    const description =
        typeof body.description === 'string'
            ? body.description.trim()
            : '';

    if (
        body.description != null &&
        typeof body.description !== 'string'
    ) {
        throw new SurveyValidationError(
            'Description must be text'
        );
    }

    if (description.length > 500) {
        throw new SurveyValidationError(
            'Description cannot exceed 500 characters'
        );
    }

    const courseId = parsePositiveInteger(
        body.course_id,
        'Course'
    );

    const semesterId = parsePositiveInteger(
        body.semester_id,
        'Semester'
    );

    const instructorId = parsePositiveInteger(
        body.instructor_id,
        'Instructor'
    );

    const createdBy = parsePositiveInteger(
        body.created_by,
        'Creator'
    );

    const openingDate = body.opening_date;
    const closingDate = body.closing_date;

    if (!isValidDate(openingDate)) {
        throw new SurveyValidationError(
            'Opening date must be a valid date'
        );
    }

    if (!isValidDate(closingDate)) {
        throw new SurveyValidationError(
            'Closing date must be a valid date'
        );
    }

    const today = new Date().toISOString().slice(0, 10);

    if (openingDate < today) {
        throw new SurveyValidationError(
            'Opening date cannot be in the past'
        );
    }

    if (closingDate <= openingDate) {
        throw new SurveyValidationError(
            'Closing date must be after the opening date'
        );
    }

    const status = body.status ?? 'Draft';

    if (!['Draft', 'Published'].includes(status)) {
        throw new SurveyValidationError(
            'Survey status must be Draft or Published'
        );
    }

    const normalizedQuestions = validateSurveyQuestions(
        body.questions ?? []
    );

    if (
        status === 'Published' &&
        normalizedQuestions.length === 0
    ) {
        throw new SurveyValidationError(
            'Add at least one question before publishing this survey'
        );
    }

    const assignment = await surveyModel.getCourseInstructorId(
        courseId,
        semesterId,
        instructorId
    );

    if (!assignment) {
        throw new SurveyValidationError(
            'The selected instructor is not assigned to this course and semester'
        );
    }

    return surveyModel.createSurvey({
        title,
        description: description || null,
        course_instructor_id: assignment.course_instructor_id,
        created_by: createdBy,
        opening_date: openingDate,
        closing_date: closingDate,
        status,
        questions: normalizedQuestions
    });
};


// ============================================
// UPDATE SURVEY
// ============================================

const updateSurvey = async (
    surveyId,
    surveyData,
    { requireStatusTransition = false } = {}
) => {
    const body =
        surveyData &&
        typeof surveyData === 'object' &&
        !Array.isArray(surveyData)
            ? surveyData
            : {};

    if (process.env.SURVEY_QUESTION_DEBUG === 'true') {
        const questions = Array.isArray(body.questions) ? body.questions : [];
        console.info(
            '[survey-question-debug] handler received IDs:',
            questions.map(question => question && question.question_id)
        );
    }

    const title =
        typeof body.title === 'string'
            ? body.title.trim()
            : '';

    if (!title) {
        throw new SurveyValidationError(
            'Survey title is required'
        );
    }

    if (title.length > 200) {
        throw new SurveyValidationError(
            'Survey title cannot exceed 200 characters'
        );
    }

    const description =
        typeof body.description === 'string'
            ? body.description.trim()
            : '';

    if (
        body.description != null &&
        typeof body.description !== 'string'
    ) {
        throw new SurveyValidationError(
            'Description must be text'
        );
    }

    if (description.length > 500) {
        throw new SurveyValidationError(
            'Description cannot exceed 500 characters'
        );
    }

    const courseId = parsePositiveInteger(
        body.course_id,
        'Course'
    );

    const semesterId = parsePositiveInteger(
        body.semester_id,
        'Semester'
    );

    const instructorId = parsePositiveInteger(
        body.instructor_id,
        'Instructor'
    );

    const openingDate = body.opening_date;
    const closingDate = body.closing_date;

    if (!isValidDate(openingDate)) {
        throw new SurveyValidationError(
            'Opening date must be a valid date'
        );
    }

    if (!isValidDate(closingDate)) {
        throw new SurveyValidationError(
            'Closing date must be a valid date'
        );
    }

    if (closingDate <= openingDate) {
        throw new SurveyValidationError(
            'Closing date must be after the opening date'
        );
    }

    const status = body.status;

    if (!SURVEY_STATUSES.has(status)) {
        throw new SurveyValidationError(
            'Invalid survey status'
        );
    }

    const normalizedQuestions = validateSurveyQuestions(
        body.questions
    );

    if (process.env.SURVEY_QUESTION_DEBUG === 'true') {
        console.info(
            '[survey-question-debug] handler normalized IDs:',
            normalizedQuestions.map(question => question.question_id)
        );
    }

    if (
        status === 'Published' &&
        normalizedQuestions.length === 0
    ) {
        throw new SurveyValidationError(
            'A published survey must contain at least one question'
        );
    }

    const assignment = await surveyModel.getCourseInstructorId(
        courseId,
        semesterId,
        instructorId
    );

    if (!assignment) {
        throw new SurveyValidationError(
            'The selected instructor is not assigned to this course and semester'
        );
    }

    return surveyModel.updateSurvey(surveyId, {
        title,
        description: description || null,
        course_instructor_id: assignment.course_instructor_id,
        opening_date: openingDate,
        closing_date: closingDate,
        status,
        questions: normalizedQuestions
    }, {
        requireStatusTransition
    });
};

const changeSurveyStatus = async (surveyId, status) => {
    const normalizedSurveyId = parsePositiveInteger(
        surveyId,
        'Survey'
    );

    if (!['Published', 'Closed'].includes(status)) {
        throw new SurveyValidationError(
            'Status must be Published or Closed'
        );
    }

    const survey = await surveyModel.getSurveyById(normalizedSurveyId);

    if (!survey) {
        return null;
    }

    return updateSurvey(normalizedSurveyId, {
        title: survey.title,
        description: survey.description,
        course_id: survey.course_id,
        semester_id: survey.semester_id,
        instructor_id: survey.instructor_id,
        opening_date: normalizeStoredDate(survey.opening_date),
        closing_date: normalizeStoredDate(survey.closing_date),
        status,
        questions: survey.questions
    }, {
        requireStatusTransition: true
    });
};

const getSurveyQuestions = async (surveyId) => {
    const normalizedSurveyId = parsePositiveInteger(
        surveyId,
        'Survey'
    );

    return surveyModel.getSurveyById(normalizedSurveyId);
};

const addQuestion = async (surveyId, body) => {
    const normalizedSurveyId = parsePositiveInteger(
        surveyId,
        'Survey'
    );

    return surveyModel.addQuestion(
        normalizedSurveyId,
        normalizeQuestionData(body)
    );
};

const updateQuestion = async (surveyId, questionId, body) => {
    const normalizedSurveyId = parsePositiveInteger(
        surveyId,
        'Survey'
    );
    const normalizedQuestionId = parsePositiveInteger(
        questionId,
        'Question'
    );

    return surveyModel.updateQuestion(
        normalizedSurveyId,
        normalizedQuestionId,
        normalizeQuestionData(body)
    );
};

const deleteQuestion = async (surveyId, questionId) => {
    const normalizedSurveyId = parsePositiveInteger(
        surveyId,
        'Survey'
    );
    const normalizedQuestionId = parsePositiveInteger(
        questionId,
        'Question'
    );

    return surveyModel.deleteQuestion(
        normalizedSurveyId,
        normalizedQuestionId
    );
};

const reorderQuestions = async (surveyId, body) => {
    const normalizedSurveyId = parsePositiveInteger(
        surveyId,
        'Survey'
    );

    if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        !Array.isArray(body.question_ids)
    ) {
        throw new SurveyValidationError(
            'question_ids must be an array'
        );
    }

    const questionIds = body.question_ids.map(questionId =>
        parsePositiveInteger(questionId, 'Question')
    );

    if (new Set(questionIds).size !== questionIds.length) {
        throw new SurveyValidationError(
            'Question IDs in the order must be unique'
        );
    }

    return surveyModel.reorderQuestions(
        normalizedSurveyId,
        questionIds
    );
};

const deleteSurvey = async (surveyId) => {
    const normalizedSurveyId = parsePositiveInteger(
        surveyId,
        'Survey'
    );

    return surveyModel.deleteSurvey(normalizedSurveyId);
};


module.exports = {
    getAllSurveys,
    getSurveyById,
    createSurvey,
    updateSurvey,
    changeSurveyStatus,
    getSurveyQuestions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    deleteSurvey,
    getAllCourses,
    getAllSemesters,
    getInstructorsByCourseAndSemester,
    SurveyValidationError
};
