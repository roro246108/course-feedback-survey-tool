const {
    buildSurveyLifecycleEvent,
    detectLifecycleEvent
} = require('./surveyLifecycleEvents');

// Publishes SurveyPublished / SurveyClosed after a status change has been
// committed to PostgreSQL.
//
// The database change is the source of truth and is never rolled back
// because of an event failure. A failure is logged with a stable code
// (SURVEY_EVENT_PUBLISH_FAILED) and reported to the caller as
// { status: 'failed' } so the Lambda can expose it in a response header.
// There is no outbox table (the schema must not change), so a failed event
// is not retried automatically. See docs/SURVEY_MANAGEMENT_INTEGRATION.md.

const createSurveyLifecycleNotifier = ({
    publisher,
    loadSurvey,
    logger = console,
    now,
    idFactory
}) => {
    const notifyIfTransitioned = async ({ surveyId, previousStatus, newStatus }) => {
        const eventType = detectLifecycleEvent(previousStatus, newStatus);

        if (!eventType) {
            return { status: 'none' };
        }

        let event;
        try {
            const survey = await loadSurvey(surveyId);
            if (!survey) {
                throw new Error('Survey not found after status change.');
            }
            event = buildSurveyLifecycleEvent(eventType, survey, {
                previousStatus,
                ...(now ? { now } : {}),
                ...(idFactory ? { idFactory } : {})
            });
        } catch (error) {
            logger.error('[survey-events] event could not be built', {
                code: 'SURVEY_EVENT_PUBLISH_FAILED',
                eventType,
                surveyId,
                reason: error && error.message
            });
            return { status: 'failed', eventType };
        }

        try {
            const result = await publisher.publish(event);

            if (result && result.skipped) {
                return { status: 'skipped', eventType, eventId: event.detail.eventId };
            }

            logger.info('[survey-events] event published', {
                eventType,
                surveyId: event.detail.surveyId,
                eventId: event.detail.eventId
            });

            return { status: 'published', eventType, eventId: event.detail.eventId };
        } catch (error) {
            logger.error('[survey-events] event publish failed', {
                code: 'SURVEY_EVENT_PUBLISH_FAILED',
                reasonCode: error && error.code,
                eventType,
                surveyId: event.detail.surveyId,
                eventId: event.detail.eventId
            });

            return { status: 'failed', eventType, eventId: event.detail.eventId };
        }
    };

    return { notifyIfTransitioned };
};

module.exports = { createSurveyLifecycleNotifier };
