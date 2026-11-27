
const feedbackService = require("../services/feedbackService");

// ======================================
// Handle Feedback Errors
// ======================================

function handleFeedbackError(error, res) {
    // Log the error code only, not submitted feedback content.
    console.error("Feedback request failed:", error.code || "UNKNOWN_ERROR");

    const errors = {
        SURVEY_NOT_FOUND: [
            404,
            "Survey not found."
        ],

        SURVEY_NOT_OPEN: [
            403,
            "This survey is not currently accepting responses."
        ],

        SURVEY_HAS_NO_QUESTIONS: [
            400,
            "This survey has no questions."
        ],

        INVALID_ANSWERS: [
            400,
            "Invalid answers format."
        ],

        INVALID_SURVEY_ID: [
            400,
            "Invalid survey ID."
        ],

        STUDENT_ID_REQUIRED: [
            401,
            "Authentication required."
        ],

        STUDENT_NOT_ELIGIBLE: [
            403,
            "You are not eligible to submit feedback for this survey."
        ],

        ELIGIBILITY_CHECK_UNAVAILABLE: [
            503,
            "Student eligibility could not be verified. Please try again."
        ],

        INVALID_QUESTION: [
            400,
            "An invalid question was submitted."
        ],

        DUPLICATE_QUESTION: [
            400,
            "Duplicate question answers are not allowed."
        ],

        INVALID_RATING: [
            400,
            "Rating must be between 1 and 5."
        ],

        INVALID_ANSWER_TYPE: [
            400,
            "Invalid answer type."
        ],

        TEXT_ANSWER_TOO_LONG: [
            400,
            "Text answer cannot exceed 2000 characters."
        ],

        UNSUPPORTED_QUESTION_TYPE: [
            400,
            "Unsupported question type."
        ],

        REQUIRED_QUESTION_MISSING: [
            400,
            "Please answer all required questions."
        ],

        IDEMPOTENCY_KEY_REQUIRED: [
            400,
            "A valid Idempotency-Key header is required."
        ],

        IDEMPOTENCY_KEY_REUSED: [
            409,
            "This idempotency key has already been used with a different request."
        ],

        RATE_LIMIT_EXCEEDED: [
            429,
            "Too many submission attempts. Please try again later."
        ],

        ALREADY_SUBMITTED: [
            409,
            "You have already submitted this survey."
        ],

        SUBMISSION_CREATION_FAILED: [
            500,
            "Failed to create feedback submission."
        ],

        PARTICIPATION_CREATION_FAILED: [500, "Failed to record participation."]
    };

    const hasPublicError = Object.prototype.hasOwnProperty.call(
        errors,
        error.code
    );

    const [status, message] = hasPublicError ? errors[error.code] : [
        Number.isInteger(error.statusCode)
            ? error.statusCode
            : 500,
        "Failed to process feedback request."
    ];

    return res.status(status).json({
        success: false,
        message,
        code: hasPublicError ? error.code : "INTERNAL_SERVER_ERROR"
    });
}

// ======================================
// Submit Anonymous Feedback
// ======================================

async function submitFeedback(req, res) {
    try {
        // 1. Check authenticated student
        if (!req.user || !req.user.user_id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
                code: "STUDENT_ID_REQUIRED"
            });
        }

        // 2. Extract request data
        const studentId = req.user.user_id;
        const surveyIdValue = req.params.surveyId ?? req.body?.survey_id;
        const { answers } = req.body || {};
        const validSurveyIdValue =
            (typeof surveyIdValue === "number" &&
                Number.isSafeInteger(surveyIdValue) && surveyIdValue > 0) ||
            (typeof surveyIdValue === "string" &&
                /^[1-9]\d*$/.test(surveyIdValue) &&
                Number.isSafeInteger(Number(surveyIdValue)));

        // 3. Validate survey ID
        if (
            !validSurveyIdValue
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid survey ID.",
                code: "INVALID_SURVEY_ID"
            });
        }

        const surveyId = Number(surveyIdValue);

        // 4. Validate answers
        if (!Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid feedback answers.",
                code: "INVALID_ANSWERS"
            });
        }

        // 5. Read Idempotency-Key header
        const idempotencyKey = req.get("Idempotency-Key");

        if (
            typeof idempotencyKey !== "string" ||
            idempotencyKey.trim().length < 8 ||
            idempotencyKey.trim().length > 255
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid Idempotency-Key header is required.",
                code: "IDEMPOTENCY_KEY_REQUIRED"
            });
        }

        // 6. Submit through Service Layer
        const result = await feedbackService.submitFeedback({
            surveyId,
            studentId,
            answers,
            idempotencyKey: idempotencyKey.trim()
        });

        // 7. Return appropriate HTTP status
        const statusCode = result.alreadyProcessed ? 200 : 201;

        return res.status(statusCode).json({
            success: true,
            message: result.message,
            data: result
        });

    } catch (error) {
        return handleFeedbackError(error, res);
    }
}

async function getStudentSubmissionMetadata(req, res) {
    try {
        if (!req.user?.user_id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
                code: "STUDENT_ID_REQUIRED"
            });
        }

        // Identity comes only from the authenticated server-side JWT context.
        const records = await feedbackService.getStudentSubmissionMetadata(req.user.user_id);
        const data = records.map((record) => ({
            id: record.id,
            survey_id: record.survey_id,
            survey_title: record.survey_title,
            course_name: record.course_name,
            course_code: record.course_code,
            semester_name: record.semester_name,
            academic_year: record.academic_year,
            submitted_at: record.submitted_at,
            status: record.status
        }));
        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        return handleFeedbackError(error, res);
    }
}

// ======================================
// Exports
// ======================================

module.exports = {
    submitFeedback,
    getStudentSubmissionMetadata
};
