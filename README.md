# course-feedback-survey-tool
A serverless course feedback survey system with anonymous submissions, survey management, and analytics and reporting.

## Backend email delivery

The backend selects its email provider with `EMAIL_PROVIDER`. Set it to `gmail`
to use Gmail SMTP with `EMAIL_USER` and `EMAIL_APP_PASSWORD`, or set it to
`resend` to use `RESEND_API_KEY` and `EMAIL_FROM`. If the selector is omitted,
the backend defaults to Resend for compatibility. Keep all credentials in the
backend runtime environment; never commit them.
