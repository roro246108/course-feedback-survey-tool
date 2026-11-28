// SurveyReminderLambda
//
// Entry point: survey-reminders/lambdaHandler.handler
//
// Invoked once a day by EventBridge Scheduler at 10:00 Africa/Cairo
// (cron(0 10 * * ? *), ScheduleExpressionTimezone Africa/Cairo). The event
// payload is not used. The reminder rules live in reminderService.js and
// reminderModel.js and are unchanged.
//
// Environment:
//   SECRETS_ARN               Secrets Manager secret: DATABASE_URL, BREVO_API_KEY
//   FRONTEND_URL              Origin of the React app (used for survey links)
//   BREVO_SENDER_EMAIL        Verified Brevo sender address
//   BREVO_SENDER_NAME         Optional sender display name
//   REMINDER_DEDUPE_MODE      "brevo-ledger" (default) or "process-only"
//   REMINDER_DRY_RUN          "true" to evaluate candidates without sending
//
// Exactly-once delivery is NOT guaranteed. See survey-reminders/README.md.

const { createRuntimeConfigLoader } = require('../survey-management/lambda/runtimeConfig');

const LIVE_REQUIRED_KEYS = [
    'DATABASE_URL',
    'BREVO_API_KEY',
    'BREVO_SENDER_EMAIL',
    'FRONTEND_URL'
];
const DRY_RUN_REQUIRED_KEYS = ['DATABASE_URL', 'FRONTEND_URL'];

const DEDUPE_MODES = Object.freeze({
    BREVO_LEDGER: 'brevo-ledger',
    PROCESS_ONLY: 'process-only'
});

// Never contacts Brevo. "accepted" in a dry-run summary means "would send".
const dryRunEmailService = Object.freeze({
    sendTransactionalEmail: async () => ({
        accepted: true,
        status: 'accepted',
        messageId: 'dry-run'
    })
});

const resolveDedupeMode = (env) =>
    env.REMINDER_DEDUPE_MODE === DEDUPE_MODES.PROCESS_ONLY
        ? DEDUPE_MODES.PROCESS_ONLY
        : DEDUPE_MODES.BREVO_LEDGER;

const defaultServiceFactory = ({ dryRun, dedupeMode, env }) => {
    const { createSurveyReminderService } = require('./services/reminderService');

    if (dryRun) {
        return createSurveyReminderService({
            env,
            emailService: dryRunEmailService
        });
    }

    const { createBrevoReminderLedger } = require('./services/brevoReminderLedger');

    return createSurveyReminderService({
        env,
        deliveryLedger: dedupeMode === DEDUPE_MODES.BREVO_LEDGER
            ? createBrevoReminderLedger({ env })
            : null
    });
};

const createSurveyReminderLambda = ({
    env = process.env,
    configLoader = createRuntimeConfigLoader({ env }),
    serviceFactory = defaultServiceFactory,
    logger = console
} = {}) => {
    // Kept for the life of the execution environment so the in-process
    // attempt cache also survives between warm invocations.
    let liveService = null;
    let running = false;

    return async () => {
        if (running) {
            logger.warn('[survey-reminders] run already in progress; skipped');
            return { skipped: true, reason: 'RUN_ALREADY_IN_PROGRESS' };
        }

        running = true;
        const startedAt = Date.now();

        try {
            const dryRun = env.REMINDER_DRY_RUN === 'true';
            const dedupeMode = resolveDedupeMode(env);

            await configLoader.load({
                requiredKeys: dryRun ? DRY_RUN_REQUIRED_KEYS : LIVE_REQUIRED_KEYS
            });

            let service;
            if (dryRun) {
                // A fresh service keeps dry runs from affecting live attempts.
                service = serviceFactory({ dryRun, dedupeMode, env });
            } else {
                liveService = liveService || serviceFactory({ dryRun, dedupeMode, env });
                service = liveService;
            }

            const summary = await service.runDueReminders();

            return {
                ...summary,
                dryRun,
                dedupeMode: dryRun ? 'none' : dedupeMode,
                durationMs: Date.now() - startedAt
            };
        } catch (error) {
            // Only codes are logged; configuration values are never logged.
            logger.error('[survey-reminders] run failed', {
                code: (error && error.code) || 'REMINDER_RUN_FAILED',
                details: error && error.details
            });
            throw error;
        } finally {
            running = false;
        }
    };
};

const handler = createSurveyReminderLambda();

module.exports = {
    DEDUPE_MODES,
    DRY_RUN_REQUIRED_KEYS,
    LIVE_REQUIRED_KEYS,
    createSurveyReminderLambda,
    dryRunEmailService,
    handler
};
