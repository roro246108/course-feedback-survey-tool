# Survey reminders (SurveyReminderLambda)

Handler: `survey-reminders/lambdaHandler.handler`. **Not deployed.** The
EventBridge Scheduler schedule is defined as configuration only in
`infrastructure/aws/survey-management/template.yaml`. The Express server does
not start the reminder job.

## Scheduling and runtime configuration

- Schedule: EventBridge Scheduler, `cron(0 10 * * ? *)`, time zone
  `Africa/Cairo`, input `{}`, no retries. Reserved concurrency is 1.
- Secret (`SECRETS_ARN`): JSON with `DATABASE_URL` and `BREVO_API_KEY`,
  loaded once per cold start before any database module is imported.
- Environment: `FRONTEND_URL` (website origin used for survey links),
  `BREVO_SENDER_EMAIL`, optional `BREVO_SENDER_NAME`,
  `REMINDER_DEDUPE_MODE` (`brevo-ledger` by default, or `process-only`),
  `REMINDER_LEDGER_LOOKBACK_DAYS` (default 30), and `REMINDER_DRY_RUN`.
- `REMINDER_DRY_RUN=true` evaluates candidates against the database and
  returns would-send counts (`accepted`) without contacting Brevo.

Reminder links use the existing `/surveys/:surveyId` student route, which
requires the student to sign in. The handler uses the existing PostgreSQL pool
from `backend/database/db.js`, which inside Lambda is a small shared pool with
TLS verification (`shared/config/pgPoolFactory.js`).

## Eligibility and dates

The model query selects only Published surveys; Active, verified Student
accounts; students enrolled in the survey's exact course and semester; and
students with no participation row (Submitted or Withdrawn). It excludes
surveys shorter than 3 days and surveys outside their Cairo-local open window.
A closing date counts as open through that Cairo calendar day. The due moment
is 10:00 Cairo on the closing date minus three days. Overdue catch-up happens
only while the survey is still Published and open.

## Duplicate prevention (exactly-once is NOT claimed)

There is no delivery table, and the schema must not change.

- **Provider ledger** (default in Lambda): each reminder is sent with the
  Brevo tag `survey-reminder-<surveyId>`. Before sending, the service checks
  Brevo's transactional activity log for that tag and recipient
  (`services/brevoReminderLedger.js`). A match is skipped as
  `ALREADY_SENT_PER_PROVIDER_LOG`. The tag does not include the closing date,
  so editing the closing date does not cause a second reminder. If the lookup
  fails, sending is skipped (`DELIVERY_LEDGER_UNAVAILABLE`) and retried on the
  next daily run while the survey is open.
- **In-process cache**: suppresses repeat attempts within one warm execution
  environment, including ambiguous outcomes (timeouts).

Remaining gaps: Brevo's log can lag briefly after a send; lookups cover a
limited window (30 days); a changed `users.email` has no history; and a
timeout leaves provider acceptance unknown. Without the ledger
(`process-only`), a cold start could re-send to a non-responding student on
each remaining day of the window.

The Brevo activity-log endpoint is covered by mocked tests only. Verify it in
staging before turning off dry-run mode.

No real email was sent while implementing or testing this handler. Automated
tests mock Brevo. The Neon integration test runs the real candidate query with
a mocked email adapter on read-only connections.
