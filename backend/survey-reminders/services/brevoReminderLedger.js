// Provider-side reminder ledger.
//
// The database has no reminder delivery table and the schema must not
// change. Without durable state, the daily schedule would re-select a
// student who has not responded on every remaining day of the reminder
// window (closing date - 3 days through the closing date) whenever the
// Lambda starts cold, and a closing-date edit would open a new window.
//
// To reduce that risk, every reminder is sent with a per-survey Brevo tag
// (survey-reminder-<surveyId>). Before sending, the service asks Brevo's
// transactional email activity log whether a request with that tag was
// already made for the same recipient. Because the tag does not include the
// closing date, editing the closing date does not cause a second reminder.
//
// Limitations (documented; exactly-once is NOT claimed):
//   - Brevo's activity log can lag behind a send by a short time.
//   - The lookup window is limited (REMINDER_LEDGER_LOOKBACK_DAYS, default 30).
//   - If a student's users.email changes, the new address has no history.
//   - When the lookup fails, sending is skipped (fail-closed) and the
//     student is retried on the next daily run while the survey is open.
//
// Endpoint: GET https://api.brevo.com/v3/smtp/statistics/events
// This integration is covered by mocked tests only; it has not been
// exercised against the live Brevo API in this repository.

const BREVO_EVENTS_URL = 'https://api.brevo.com/v3/smtp/statistics/events';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LOOKBACK_DAYS = 90;

const buildReminderTag = (surveyId) => {
    const parsed = Number(surveyId);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new TypeError('A valid survey ID is required for the reminder tag.');
    }
    return `survey-reminder-${parsed}`;
};

const unknown = (code) => ({ known: false, sent: null, code });

const eventHasTag = (event, tag) => {
    if (!event || typeof event !== 'object') return false;
    if (event.tag === tag) return true;
    if (Array.isArray(event.tags) && event.tags.includes(tag)) return true;
    return false;
};

const createBrevoReminderLedger = ({
    env = process.env,
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) => {
    const lookbackDays = Math.min(
        MAX_LOOKBACK_DAYS,
        Math.max(1, Number(env.REMINDER_LEDGER_LOOKBACK_DAYS) || DEFAULT_LOOKBACK_DAYS)
    );

    const hasReminderBeenSent = async ({ email, surveyId }) => {
        const apiKey = typeof env.BREVO_API_KEY === 'string'
            ? env.BREVO_API_KEY.trim()
            : '';

        if (!apiKey) return unknown('BREVO_CONFIGURATION_ERROR');
        if (typeof fetchImpl !== 'function') return unknown('BREVO_RUNTIME_UNSUPPORTED');
        if (typeof email !== 'string' || !email.trim()) return unknown('INVALID_RECIPIENT_EMAIL');

        let tag;
        try {
            tag = buildReminderTag(surveyId);
        } catch {
            return unknown('INVALID_SURVEY_ID');
        }

        const recipient = email.trim().toLowerCase();
        const url = new URL(BREVO_EVENTS_URL);
        url.searchParams.set('email', recipient);
        url.searchParams.set('tags', tag);
        url.searchParams.set('event', 'requests');
        url.searchParams.set('days', String(lookbackDays));
        url.searchParams.set('limit', '100');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetchImpl(url.href, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'api-key': apiKey
                },
                signal: controller.signal
            });

            if (!response || !Number.isInteger(response.status)) {
                return unknown('BREVO_UNEXPECTED_RESPONSE');
            }

            if (response.status < 200 || response.status >= 300) {
                return unknown('BREVO_LEDGER_HTTP_ERROR');
            }

            const responseText = typeof response.text === 'function'
                ? await response.text()
                : '';

            // Brevo returns an empty object when there are no events.
            let body = {};
            if (responseText.trim()) {
                try {
                    body = JSON.parse(responseText);
                } catch {
                    return unknown('BREVO_UNEXPECTED_RESPONSE');
                }
            }

            if (!body || typeof body !== 'object') {
                return unknown('BREVO_UNEXPECTED_RESPONSE');
            }

            const events = Array.isArray(body.events) ? body.events : [];

            // Filter locally as well, in case a query filter is not applied.
            const sent = events.some((event) =>
                eventHasTag(event, tag) &&
                typeof event.email === 'string' &&
                event.email.trim().toLowerCase() === recipient
            );

            return { known: true, sent, code: null };
        } catch (error) {
            return unknown(
                error && error.name === 'AbortError'
                    ? 'BREVO_LEDGER_TIMEOUT'
                    : 'BREVO_LEDGER_NETWORK_ERROR'
            );
        } finally {
            clearTimeout(timeoutId);
        }
    };

    return { hasReminderBeenSent, lookbackDays };
};

module.exports = {
    BREVO_EVENTS_URL,
    buildReminderTag,
    createBrevoReminderLedger
};
