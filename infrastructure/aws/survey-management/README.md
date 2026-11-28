# Survey Management — AWS configuration

> **Status: configuration only. Nothing here has been deployed, and no AWS
> resources were created.** The commands below are future instructions for
> whoever is authorised to deploy. They were not run.

Scope: `SurveyManagementLambda`, `SurveyReminderLambda`, their API Gateway
routes, the reminder schedule, permission to publish `SurveyPublished` and
`SurveyClosed`, their IAM roles, log groups, alarms and secret references.
Other teams' Lambdas, roles, queues, rules and buckets are **not** defined here.

## Files

| File | Purpose |
|---|---|
| `template.yaml` | AWS SAM template for everything above |
| `iam/survey-mgmt-role-policy.json` | Reference copy of `survey-mgmt-role` permissions |
| `iam/survey-reminder-role-policy.json` | Reference copy of `survey-reminder-role` permissions |
| `iam/survey-reminder-scheduler-role-policy.json` | Scheduler → SurveyReminderLambda invoke |
| `eventbridge/survey-lifecycle-event.schema.json` | `detail` schema for both lifecycle events |

Two automated tests check this configuration against the code. One confirms
the template's 18 `RouteKey`s match the Lambda route table
(`backend/tests/surveyLambdaRuntime.test.js`). The other confirms the event
schema matches the built events (`backend/tests/surveyLifecycleEvents.test.js`).

## Least privilege summary

| Role | Allowed |
|---|---|
| `survey-mgmt-role` | Own log group; `GetSecretValue` on its own secret; `events:PutEvents` on `course-feedback-events`, only with `source = course-feedback.survey-management` and `detail-type ∈ {SurveyPublished, SurveyClosed}` |
| `survey-reminder-role` | Own log group; `GetSecretValue` on its own secret. No EventBridge, no other Lambdas |
| `survey-reminder-scheduler-role` | `lambda:InvokeFunction` on SurveyReminderLambda only |
| API Gateway | `lambda:InvokeFunction` on SurveyManagementLambda, only for `/api/surveys*` and `/api/dashboard/*` |

Neon is reached over the public internet with TLS certificate verification
(`PG_SSL_REJECT_UNAUTHORIZED=true`), so no VPC is needed.

## Secrets (values never go in code, templates or the frontend)

| Secret | JSON keys |
|---|---|
| Survey Management secret | `DATABASE_URL`, `ACCESS_TOKEN_SECRET` |
| Survey Reminder secret | `DATABASE_URL`, `BREVO_API_KEY` |

The Lambdas read their secret once per cold start
(`backend/survey-management/lambda/runtimeConfig.js`). They copy only these
keys and never log values. Use Neon's **pooled** connection string (`-pooler`
host) for `DATABASE_URL`. Each execution environment holds at most
`PG_POOL_MAX` (2) connections, and SurveyManagementLambda's reserved
concurrency caps the total.

Non-secret settings (`FRONTEND_URL`, `BREVO_SENDER_EMAIL`, `EVENT_BUS_NAME`,
…) are ordinary environment variables set by the template.

## Future deployment steps (documentation only)

Prerequisites: AWS SAM CLI, Node.js 22, an AWS account and deploy permissions
granted by the project owner, and agreement on who owns the shared HTTP API
and event bus.

1. Create the two secrets in AWS Secrets Manager (console or CLI) with the JSON
   keys above. Record their ARNs.
2. Build (esbuild bundles only the code each Lambda needs; no native modules
   are required):
   ```sh
   cd infrastructure/aws/survey-management
   sam build
   ```
3. Deploy with explicit parameters. Keep the safe defaults
   (`ReminderDryRun=true`, `ReminderScheduleState=DISABLED`) on the first deploy:
   ```sh
   sam deploy --guided \
     --stack-name course-feedback-survey-management \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides \
       FrontendOrigin=https://<website-origin> \
       CreateHttpApi=true \
       CreateEventBus=false \
       EventBusName=course-feedback-events \
       SurveyManagementSecretArn=<arn> \
       SurveyReminderSecretArn=<arn> \
       BrevoSenderEmail=<verified-sender>
   ```
   If the HTTP API already exists in another stack, use `CreateHttpApi=false
   ExistingHttpApiId=<id>`. Only the Survey Management integration, routes and
   invoke permissions are then added; that stack keeps its CORS and stage settings,
   and its CORS must allow the headers listed above.
4. Verify without side effects:
   - `GET <HttpApiEndpoint>/api/surveys` without a token → `401`.
   - Same request with an Admin token → `200`.
   - Invoke `SurveyReminderLambda` once manually while it is still in dry-run
     mode and check the summary in its CloudWatch log group. No email is sent.
5. Verify the Brevo ledger in staging. Send one reminder to a test address,
   then confirm a second run reports `ALREADY_SENT_PER_PROVIDER_LOG`. Only then
   set `ReminderDryRun=false` and `ReminderScheduleState=ENABLED`.
6. Build the frontend with the API endpoint and upload it to the website bucket:
   ```sh
   cd frontend
   VITE_SURVEY_MANAGEMENT_API_URL=<HttpApiEndpoint> VITE_API_URL=<auth/express-origin> npm run build
   ```
7. Give the `SurveyManagementFunctionArn` output to the Anonymous Feedback
   owner, and the event contract to the Analytics owner
   (`docs/SURVEY_MANAGEMENT_INTEGRATION.md`).

## Monitoring

- Log groups (JSON format): `/aws/lambda/SurveyManagementLambda`,
  `/aws/lambda/SurveyReminderLambda`, and `/aws/apigateway/course-feedback-http-api`.
- Alarms: `SurveyManagementLambda-errors`, `SurveyReminderLambda-errors`.
  No SNS action is attached; add one once an alert channel exists.
- Metric `CourseFeedback/SurveyManagement/SurveyEventPublishFailed` counts
  lifecycle events that could not be published.
