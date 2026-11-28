const crypto = require('crypto');

// Event contract for Survey Management lifecycle events published to the
// "course-feedback-events" EventBridge bus. See
// docs/SURVEY_MANAGEMENT_INTEGRATION.md for the consumer-facing contract.

const EVENT_SOURCE = 'course-feedback.survey-management';
const EVENT_VERSION = '1.0';

const SURVEY_EVENT_TYPES = Object.freeze({
    SURVEY_PUBLISHED: 'SurveyPublished',
    SURVEY_CLOSED: 'SurveyClosed'
});

const STATUS_TO_EVENT = Object.freeze({
    Published: SURVEY_EVENT_TYPES.SURVEY_PUBLISHED,
    Closed: SURVEY_EVENT_TYPES.SURVEY_CLOSED
});

// Returns the event type for a committed status change, or null.
const detectLifecycleEvent = (previousStatus, newStatus) => {
    if (!newStatus || previousStatus === newStatus) {
        return null;
    }

    return STATUS_TO_EVENT[newStatus] || null;
};

const toDateOnly = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = String(value.getFullYear()).padStart(4, '0');
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    if (typeof value === 'string') {
        const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
        if (match) return match[1];
    }

    return null;
};

const toPositiveIntegerOrNull = (value) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

// Builds the event detail from a survey record.
// Only identifiers and scheduling data are included. No student data,
// user emails, names, comments or answers are ever part of the event.
const buildSurveyLifecycleEvent = (
    eventType,
    survey,
    {
        previousStatus = null,
        now = () => new Date(),
        idFactory = () => crypto.randomUUID()
    } = {}
) => {
    if (!Object.values(SURVEY_EVENT_TYPES).includes(eventType)) {
        throw new TypeError(`Unsupported survey event type: ${eventType}`);
    }

    const surveyId = toPositiveIntegerOrNull(survey && survey.survey_id);
    if (!surveyId) {
        throw new TypeError('A valid survey_id is required to build an event.');
    }

    const occurredAt = now().toISOString();

    return {
        source: EVENT_SOURCE,
        detailType: eventType,
        time: occurredAt,
        detail: {
            eventId: idFactory(),
            eventType,
            eventVersion: EVENT_VERSION,
            occurredAt,
            surveyId,
            courseId: toPositiveIntegerOrNull(survey.course_id),
            semesterId: toPositiveIntegerOrNull(survey.semester_id),
            courseInstructorId: toPositiveIntegerOrNull(survey.course_instructor_id),
            status: survey.status,
            previousStatus: previousStatus || null,
            openingDate: toDateOnly(survey.opening_date),
            closingDate: toDateOnly(survey.closing_date),
            questionCount: Array.isArray(survey.questions)
                ? survey.questions.length
                : null
        }
    };
};

module.exports = {
    EVENT_SOURCE,
    EVENT_VERSION,
    SURVEY_EVENT_TYPES,
    buildSurveyLifecycleEvent,
    detectLifecycleEvent
};
