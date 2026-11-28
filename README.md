# course-feedback-survey-tool
A serverless course feedback survey system with anonymous submissions, survey management, and analytics and reporting.
<<<<<<< Updated upstream
=======

## Backend email delivery

The backend selects its email provider with `EMAIL_PROVIDER`. Set it to `gmail`
to use Gmail SMTP with `EMAIL_USER` and `EMAIL_APP_PASSWORD`, or set it to
`resend` to use `RESEND_API_KEY` and `EMAIL_FROM`. If the selector is omitted,
the backend defaults to Resend for compatibility. Keep all credentials in the
backend runtime environment; never commit them.

### Brevo survey reminder email service

The Brevo transactional email service is separate from the configured Gmail and
Resend providers. It does not change `EMAIL_PROVIDER` or redirect authentication
emails. The future survey reminder service must call the Brevo-specific sender.

For local development, add these placeholders to the backend's local
environment configuration or set them in the process environment:

```dotenv
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=
```

Generate your own key in the Brevo dashboard under **SMTP & API → API Keys**.
Use a sender address verified with Brevo. `BREVO_SENDER_NAME` is optional
according to the Brevo API; the sender email and API key are required. Keep real
values out of source control and do not share the API key.

For a controlled test, configure exactly one `BREVO_TEST_RECIPIENT` address
that you control. Only after explicit approval, from the `backend` directory
run `node scripts/testBrevoEmail.js --confirm-send`. The script sends one
message with the subject `Course Feedback System - Brevo Integration Test`;
without the confirmation flag or a valid single recipient, it sends nothing.

The Brevo adapter uses Node.js built-in `fetch` and `AbortController` (Node.js
18 or later). The backend package does not currently declare a Node.js engine
version. No `.env.example` file exists in the repository; this documentation
uses empty placeholders only.

### Survey reminder execution

The reminder Lambda-compatible handler and deployment-stage notes are in
[`backend/survey-reminders/README.md`](./backend/survey-reminders/README.md).
The handler is not deployed and EventBridge is not configured in this project.
>>>>>>> Stashed changes
