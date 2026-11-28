const eligibilityModel = require('../models/eligibilityModel');

// Reasons are checked in this order; the first failing rule is reported.
const ELIGIBILITY_REASONS = Object.freeze({
    ELIGIBLE: 'ELIGIBLE',
    SURVEY_NOT_FOUND: 'SURVEY_NOT_FOUND',
    SURVEY_NOT_PUBLISHED: 'SURVEY_NOT_PUBLISHED',
    SURVEY_NOT_OPEN: 'SURVEY_NOT_OPEN',
    STUDENT_NOT_ACTIVE: 'STUDENT_NOT_ACTIVE',
    NOT_ENROLLED: 'NOT_ENROLLED',
    ALREADY_PARTICIPATED: 'ALREADY_PARTICIPATED'
});

class EligibilityRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EligibilityRequestError';
        this.code = 'INVALID_REQUEST';
    }
}

const parseId = (value, label) => {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new EligibilityRequestError(`${label} must be a positive integer.`);
    }
    return parsed;
};

const evaluateEligibility = (facts) => {
    if (!facts) return ELIGIBILITY_REASONS.SURVEY_NOT_FOUND;
    if (!facts.is_published) return ELIGIBILITY_REASONS.SURVEY_NOT_PUBLISHED;
    if (!facts.is_open) return ELIGIBILITY_REASONS.SURVEY_NOT_OPEN;
    if (!facts.is_active_student) return ELIGIBILITY_REASONS.STUDENT_NOT_ACTIVE;
    if (!facts.is_enrolled) return ELIGIBILITY_REASONS.NOT_ENROLLED;
    if (facts.has_participation) return ELIGIBILITY_REASONS.ALREADY_PARTICIPATED;
    return ELIGIBILITY_REASONS.ELIGIBLE;
};

const checkStudentEligibility = async (surveyId, studentId, model = eligibilityModel) => {
    const normalizedSurveyId = parseId(surveyId, 'surveyId');
    const normalizedStudentId = parseId(studentId, 'studentId');

    const facts = await model.getEligibilityFacts(
        normalizedSurveyId,
        normalizedStudentId
    );
    const reason = evaluateEligibility(facts);

    return {
        surveyId: normalizedSurveyId,
        eligible: reason === ELIGIBILITY_REASONS.ELIGIBLE,
        reason
    };
};

const listEligibleSurveys = async (studentId, model = eligibilityModel) => {
    const normalizedStudentId = parseId(studentId, 'studentId');
    return model.getEligibleSurveys(normalizedStudentId);
};

module.exports = {
    ELIGIBILITY_REASONS,
    EligibilityRequestError,
    checkStudentEligibility,
    evaluateEligibility,
    listEligibleSurveys
};
