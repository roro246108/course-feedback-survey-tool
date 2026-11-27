
const surveyHandler = require('../handlers/surveyHandler');

const { SurveyValidationError } = surveyHandler;

const sendQuestionError = (res, error, operation) => {
    if (error instanceof SurveyValidationError) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === 'QUESTION_ORDER_INVALID') {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    if (
        error.code === 'SURVEY_QUESTIONS_LOCKED' ||
        error.code === 'QUESTION_HAS_ANSWERS' ||
        error.code === '23503'
    ) {
        return res.status(409).json({
            success: false,
            message: error.code === '23503'
                ? 'This question is linked to historical feedback and cannot be changed or deleted.'
                : error.message
        });
    }

    console.error(`Error ${operation}:`, error);

    return res.status(500).json({
        success: false,
        message: `Failed to ${operation}`
    });
};


// ============================================
// GET ALL SURVEYS
// ============================================

const getAllSurveys = async (req, res) => {
    try {
        const surveys = await surveyHandler.getAllSurveys();

        return res.status(200).json({
            success: true,
            count: surveys.length,
            data: surveys
        });

    } catch (error) {
        console.error('Error fetching surveys:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch surveys'
        });
    }
};


// ============================================
// GET SURVEY BY ID
// ============================================

const getSurveyById = async (req, res) => {
    try {
        const surveyId = Number(req.params.id);

        if (!Number.isInteger(surveyId) || surveyId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid survey ID'
            });
        }

        const survey = await surveyHandler.getSurveyById(surveyId);

        if (!survey) {
            return res.status(404).json({
                success: false,
                message: 'Survey not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: survey
        });

    } catch (error) {
        console.error('Error fetching survey:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch survey'
        });
    }
};


// ============================================
// CREATE SURVEY
// ============================================

const createSurvey = async (req, res) => {
    try {
        const requestBody =
            req.body &&
            typeof req.body === 'object' &&
            !Array.isArray(req.body)
                ? req.body
                : {};

        // Use the authenticated Admin's ID.
        // Never trust created_by sent by the frontend.
        const surveyData = {
            ...requestBody,
            created_by: req.user.userId
        };

        const newSurvey = await surveyHandler.createSurvey(surveyData);

        return res.status(201).json({
            success: true,
            message: 'Survey created successfully',
            data: newSurvey
        });

    } catch (error) {
        if (error instanceof SurveyValidationError) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        console.error('Error creating survey:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create survey'
        });
    }
};


// ============================================
// UPDATE SURVEY
// ============================================

const updateSurvey = async (req, res) => {
    try {
        const surveyId = Number(req.params.id);

        if (!Number.isInteger(surveyId) || surveyId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid survey ID'
            });
        }

        if (process.env.SURVEY_QUESTION_DEBUG === 'true') {
            const questions = req.body && Array.isArray(req.body.questions)
                ? req.body.questions
                : [];

            console.info(
                '[survey-question-debug] controller received IDs:',
                questions.map(question => question && question.question_id)
            );
        }

        const updatedSurvey = await surveyHandler.updateSurvey(
            surveyId,
            req.body
        );

        if (!updatedSurvey) {
            return res.status(404).json({
                success: false,
                message: 'Survey not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Survey updated successfully',
            data: updatedSurvey
        });

    } catch (error) {
        if (error instanceof SurveyValidationError) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        if (error.code === 'SURVEY_QUESTIONS_LOCKED') {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        if (error.code === 'SURVEY_STATUS_TRANSITION_INVALID') {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        console.error('Error updating survey:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update survey'
        });
    }
};


// ============================================
// CHANGE SURVEY STATUS
// ============================================

const changeSurveyStatus = async (req, res) => {
    try {
        const surveyId = Number(req.params.id);

        if (!Number.isInteger(surveyId) || surveyId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid survey ID'
            });
        }

        const updatedSurvey = await surveyHandler.changeSurveyStatus(
            surveyId,
            req.body && req.body.status
        );

        if (!updatedSurvey) {
            return res.status(404).json({
                success: false,
                message: 'Survey not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: `Survey ${updatedSurvey.status.toLowerCase()} successfully`,
            data: updatedSurvey
        });

    } catch (error) {
        if (error instanceof SurveyValidationError) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        if (
            error.code === 'SURVEY_QUESTIONS_LOCKED' ||
            error.code === 'SURVEY_STATUS_TRANSITION_INVALID'
        ) {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        console.error('Error changing survey status:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to change survey status'
        });
    }
};


// ============================================
// DELETE SURVEY
// ============================================

const deleteSurvey = async (req, res) => {
    try {
        const surveyId = Number(req.params.id);

        if (!Number.isInteger(surveyId) || surveyId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid survey ID'
            });
        }

        const deletedSurvey = await surveyHandler.deleteSurvey(surveyId);

        if (!deletedSurvey) {
            return res.status(404).json({
                success: false,
                message: 'Survey not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Survey deleted successfully',
            data: deletedSurvey
        });

    } catch (error) {
        if (error instanceof SurveyValidationError) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        if (
            error.code === 'SURVEY_HAS_RESPONSES' ||
            error.code === '23503'
        ) {
            return res.status(409).json({
                success: false,
                message: error.code === 'SURVEY_HAS_RESPONSES'
                    ? error.message
                    : 'This survey cannot be deleted because related historical records exist.'
            });
        }

        console.error('Error deleting survey:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete survey'
        });
    }
};


// ============================================
// GET SURVEY QUESTIONS
// ============================================

const getSurveyQuestions = async (req, res) => {
    try {
        const survey = await surveyHandler.getSurveyQuestions(req.params.id);

        if (!survey) {
            return res.status(404).json({
                success: false,
                message: 'Survey not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: survey
        });

    } catch (error) {
        return sendQuestionError(res, error, 'fetch survey questions');
    }
};


// ============================================
// ADD QUESTION
// ============================================

const addQuestion = async (req, res) => {
    try {
        const question = await surveyHandler.addQuestion(
            req.params.id,
            req.body
        );

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Survey not found'
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Question added successfully',
            data: question
        });

    } catch (error) {
        return sendQuestionError(res, error, 'add question');
    }
};


// ============================================
// UPDATE QUESTION
// ============================================

const updateQuestion = async (req, res) => {
    try {
        const question = await surveyHandler.updateQuestion(
            req.params.id,
            req.params.questionId,
            req.body
        );

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Survey or question not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Question updated successfully',
            data: question
        });

    } catch (error) {
        return sendQuestionError(res, error, 'update question');
    }
};


// ============================================
// DELETE QUESTION
// ============================================

const deleteQuestion = async (req, res) => {
    try {
        const question = await surveyHandler.deleteQuestion(
            req.params.id,
            req.params.questionId
        );

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Survey or question not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Question deleted successfully',
            data: question
        });

    } catch (error) {
        return sendQuestionError(res, error, 'delete question');
    }
};


// ============================================
// REORDER QUESTIONS
// ============================================

const reorderQuestions = async (req, res) => {
    try {
        const questions = await surveyHandler.reorderQuestions(
            req.params.id,
            req.body
        );

        if (!questions) {
            return res.status(404).json({
                success: false,
                message: 'Survey not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Questions reordered successfully',
            data: questions
        });

    } catch (error) {
        return sendQuestionError(res, error, 'reorder questions');
    }
};


// ============================================
// GET ALL COURSES
// ============================================

const getAllCourses = async (req, res) => {
    try {
        const courses = await surveyHandler.getAllCourses();

        return res.status(200).json({
            success: true,
            count: courses.length,
            data: courses
        });

    } catch (error) {
        console.error('Error fetching courses:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch courses'
        });
    }
};


// ============================================
// GET ALL SEMESTERS
// ============================================

const getAllSemesters = async (req, res) => {
    try {
        const semesters = await surveyHandler.getAllSemesters();

        return res.status(200).json({
            success: true,
            count: semesters.length,
            data: semesters
        });

    } catch (error) {
        console.error('Error fetching semesters:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch semesters'
        });
    }
};


// ============================================
// GET INSTRUCTORS
// ============================================

const getInstructorsByCourseAndSemester = async (req, res) => {
    try {
        const { courseId, semesterId } = req.query;

        if (!courseId || !semesterId) {
            return res.status(400).json({
                success: false,
                message: 'courseId and semesterId are required'
            });
        }

        const instructors =
            await surveyHandler.getInstructorsByCourseAndSemester(
                courseId,
                semesterId
            );

        return res.status(200).json({
            success: true,
            count: instructors.length,
            data: instructors
        });

    } catch (error) {
        if (error instanceof SurveyValidationError) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        console.error('Error fetching instructors:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch instructors'
        });
    }
};


module.exports = {
    getAllSurveys,
    getSurveyById,
    createSurvey,
    updateSurvey,
    changeSurveyStatus,
    deleteSurvey,
    getSurveyQuestions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    getAllCourses,
    getAllSemesters,
    getInstructorsByCourseAndSemester
};
