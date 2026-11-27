# Local API Reference

This reference describes routes mounted by the current local Express application after the student survey route correction. It is derived from the route/controller/service code. It does not imply AWS Lambda deployment. Service ownership is shown only where known: the requester owns Student Side / Anonymous Feedback; named owners for Survey Management and Analytics & Reporting are not present in repository evidence.

## Authentication and account management

All endpoints below are mounted under `/api/auth`. Except where noted, controllers may pass unexpected failures to the central handler, which returns a generic 500 response. Auth-changing requests use the CSRF cookie/header flow shown below.

| Method and URL | Auth / headers / request | Validation and behavior | Success response | Main errors / data operations |
|---|---|---|---|---|
| `GET /api/auth/csrf` | No auth. Browser accepts cookie. | General auth rate limit; creates signed CSRF token and cookie. | `200 { csrfToken }` | `429`; no database operation. |
| `POST /api/auth/login` | CSRF cookie and `X-CSRF-Token`; JSON `{ email, password }`. | Both values must be nonempty strings. Authenticates, creates session and audit record, sets HttpOnly refresh cookie. | `200 { message, user, accessToken }`; refresh token is cookie-only. | `400`, `401`, `403`, `429`, `500`; reads `users`, writes session/audit records. |
| `POST /api/auth/refresh` | CSRF cookie/header and refresh-token cookie. | Rotates refresh session; validates current session/token. | `200 { message, accessToken, user }`; rotated refresh token is cookie-only. | `401`, `429`, `500`; reads/updates `user_sessions`, reads user and writes audit record. |
| `POST /api/auth/logout` | CSRF cookie/header; refresh-token cookie may be absent. | Revokes session when cookie exists; clears cookie. | `200 { message }` | `500`; updates `user_sessions`, writes audit record when applicable. |
| `POST /api/auth/verify-email` | JSON `{ token }`; no authenticated session required. | Nonempty string required; validates and consumes verification token, activates eligible account. | `200 { message }` | `400`, `429`, `500`; reads/updates `email_verification_tokens` and `users`, writes audit record. |
| `POST /api/auth/accept-invitation` | JSON `{ token, password, confirmPassword }`. | String fields required; passwords must match; service enforces password policy and invitation validity. | `201 { message, user }` | `400`, `409`, `429`, `500`; reads/updates `account_invitations`, creates `users`, writes audit record. |
| `POST /api/auth/forgot-password` | JSON `{ email }`. | Nonempty string required; service initiates reset flow. | `200` with service message. | `400`, `429`, `500`; reads users, creates reset token and sends email as configured. |
| `POST /api/auth/reset-password` | JSON `{ token, password, confirmPassword }`. | String fields required; service validates token, password policy and confirmation. | `200 { message }` | `400`, `429`, `500`; reads/updates `password_reset_tokens`, updates `users`, may revoke sessions and write audit record. |
| `POST /api/auth/invitations` | Authenticated Admin; CSRF cookie/header; JSON `{ fullName, email, role }`. | Name 2–150 chars; email format and max 255 chars; nonempty role; service validates role and active verified Admin. | `201 { message, invitation: { invitationId, email, fullName, role, expiresAt } }` | `400`, `401`, `403`, `409`, `429`, `500`; reads `users`, creates/updates `account_invitations`, writes audit record and sends invitation email. |

## Anonymous Feedback Service — Student Side

All these endpoints require a valid Bearer access token and current `Student` role. The browser sends it through `AuthContext.apiFetch`. JSON responses use `{ success, ... }` as shown.

| Method and URL | Request | Validation and business logic | Success response | Errors / database operations |
|---|---|---|---|---|
| `GET /api/student/surveys` | No body. | Returns published, currently open surveys for the student’s course/semester enrollments, excluding surveys with a participation record. | `200 { success: true, count, data: [...] }` | `401`, `403`, `500`; reads `surveys`, `course_instructors`, `courses`, `users`, `semesters`, `enrollments`, `participation`. |
| `GET /api/student/courses` | No body. | Returns only the authenticated student’s enrolled courses, semester, assigned instructor names, and count of published/open surveys not yet submitted. | `200 { success: true, count, data: [...] }` | `401`, `500`; reads `enrollments`, `courses`, `semesters`, `course_instructors`, `users`, `surveys`, `participation`. |
| `GET /api/student/surveys/:surveyId` | Positive integer `surveyId`. | Returns survey only if published/open, student is enrolled for its course/semester, and no participation exists. Includes ordered questions. | `200 { success: true, data: { ..., questions: [...] } }` | `400`, `401`, `403`, `404`, `500`; reads survey/course/user/semester/enrollment/participation/question data. |
| `GET /api/student/surveys/:surveyId/submission-status` | Positive integer `surveyId`. | Reports eligibility, prior participation, open status and a reason code. | `200 { success: true, data: { survey_id, is_eligible, already_submitted, is_open, can_submit, reason } }` | `400`, `401`, `403`, `404`, `500`; reads survey/course assignment, enrollment and participation. |
| `GET /api/student/submissions` | No request parameters or body. | Uses only the authenticated JWT student ID to return that student's participation metadata joined to survey, course and semester labels. Does not query response/answer tables. | `200 { success: true, count, data: [{ id, survey_id, survey_title, course_name, course_code, semester_name, academic_year, submitted_at, status }] }` | `401`, `500`; reads participation, surveys, course_instructors, courses and semesters. |
| `POST /api/feedback/submit` | Bearer token; `Idempotency-Key`; JSON `{ survey_id, answers: [{ question_id, rating_value?, text_answer? }] }`. | Student ID is taken from JWT only. Validates eligibility, survey availability, answer membership/types, required answers and idempotency. Locks the survey row and writes participation, anonymous submission, answers and idempotency record in one transaction. The participation unique constraint prevents duplicate participation. | `201` new submission; `200` idempotent replay. Returns a generic confirmation without submission ID or answers. | `400`, `401`, `403`, `404`, `409`, `429`, `503`, `500`. The legacy `POST /api/surveys/:surveyId/responses` remains as a compatibility route to the same controller. |

### Feedback submission error codes

The controller maps validation/business errors to 400 (`INVALID_ANSWERS`, `INVALID_QUESTION`, `DUPLICATE_QUESTION`, `INVALID_RATING`, `INVALID_ANSWER_TYPE`, `TEXT_ANSWER_TOO_LONG`, `REQUIRED_QUESTION_MISSING`, `IDEMPOTENCY_KEY_REQUIRED`), 403 (`SURVEY_NOT_OPEN`, `STUDENT_NOT_ELIGIBLE`), 404 (`SURVEY_NOT_FOUND`), 409 (`IDEMPOTENCY_KEY_REUSED`, `ALREADY_SUBMITTED`), 429 (`RATE_LIMIT_EXCEEDED`) and 503 (`ELIGIBILITY_CHECK_UNAVAILABLE`). Unexpected failures return a generic processing error.

The rate limiter is currently process-local memory: five submissions per student per 15-minute window, not shared between instances and reset on restart.

After submission, students can view only their participation metadata through `GET /api/student/submissions`; the page does not retrieve or display individual answers. No endpoint or frontend action supports individual response viewing, editing, withdrawal, or deletion. The dashboard's Recent Submissions panel remains a separate metadata-only view. The application does not read or write ownership mappings and does not require the HMAC secret or ownership migration objects. The ownership migration file is retained as historical database material; review a separate cleanup migration with the database owner if those objects were applied.

Text is stored as plain text after trimming, NUL removal and rule-based replacement of email addresses, Egyptian mobile-number patterns, and 14-digit Egyptian national-ID-shaped values. The phone and ID pattern matching accepts Latin, Arabic-Indic and Eastern Arabic-Indic digits; email matching supports the ASCII email format used by the current pattern. These rules do not detect names, addresses, all international phone formats, or every form of PII, and a 14-digit match does not validate an issued ID. English and Arabic sentiment/abuse keyword matching is rule-based, not AI. It labels or flags comments without deleting ordinary text. The Student Side renders survey data through ordinary React text interpolation and does not use `dangerouslySetInnerHTML`; React escapes text in that context. Any future HTML renderer must apply context-appropriate output encoding.

`SurveyDetails` calls the submission-status route before requesting survey details. Both routes enforce student eligibility; the detail query remains the backend access-control boundary.

### Student request/response examples

```http
GET /api/student/surveys/42/submission-status
Authorization: Bearer <access-token>
```

```json
{
  "success": true,
  "data": {
    "survey_id": 42,
    "is_eligible": true,
    "already_submitted": false,
    "is_open": true,
    "can_submit": true,
    "reason": "CAN_SUBMIT"
  }
}
```

```http
POST /api/surveys/42/responses
Authorization: Bearer <access-token>
Content-Type: application/json
Idempotency-Key: <client-generated-key>

{"answers":[{"question_id":7,"rating_value":5},{"question_id":8,"text_answer":"The material was clear."}]}
```

New submission success (`201`):

```json
{
  "success": true,
  "message": "Feedback submitted successfully.",
  "data": {
    "surveyId": 42,
    "alreadyProcessed": false,
    "message": "Feedback submitted successfully."
  }
}
```

Validation error (`400`):

```json
{
  "success": false,
  "message": "Rating must be between 1 and 5.",
  "code": "INVALID_RATING"
}
```

Duplicate participation (`409`):

```json
{
  "success": false,
  "message": "You have already submitted this survey.",
  "code": "ALREADY_SUBMITTED"
}
```

No response or event includes a student ID or answer body. The success response is a confirmation without a unique receipt identifier. The repository does not establish a unique-receipt requirement; confirm that interpretation with the professor/team before changing the response contract.

## Analytics & Reporting — current student dashboard operations

These two routes are currently implemented in `backend/anonymous-feedback` and mounted separately under `/api/feedback/dashboard`. Their placement does not establish a separate Analytics & Reporting service boundary.

| Method and URL | Request | Behavior | Success response | Errors / database operations |
|---|---|---|---|---|
| `GET /api/feedback/dashboard/recent-submissions` | Student Bearer token; no body. | Returns up to three recent submission metadata rows for the authenticated student. Does not return submitted answers or link to response management. | `200 { success: true, count, data: [...] }` | `401`, `403`, `500`; reads participation/surveys. |
| `GET /api/feedback/dashboard/stats` | Student Bearer token; no body. | Returns completed surveys, available surveys and enrolled courses for the authenticated student. | `200 { success: true, data: { completedSurveys, availableSurveys, enrolledCourses } }` | `401`, `403`, `500`; reads participation, enrollment, course assignment and survey rows. |

No separate cross-course analytics/reporting API or event consumer is implemented. Do not document one as active.

## Health check

`GET /` is unauthenticated and returns `200 { success: true, message }`. It does not query the database and does not prove dependent services are healthy.

## CRUD and Search matrix (current implementation)

| Intended service | Create | Read | Update | Delete | Search | Current assessment |
|---|---|---|---|---|---|---|
| Survey Management | No survey-management create endpoint found. | Student feedback code reads surveys/questions. | No survey-management update endpoint found. | No survey-management delete endpoint found. | No management search endpoint found. | Service implementation absent; do not count consumer reads as management functionality. |
| Anonymous Feedback | Submit feedback, participation, answers and idempotency record. | Surveys, eligibility/status, questions, student-scoped participation metadata and dashboard metadata. Individual answer retrieval is not offered after submission. | Not offered. | Not offered to students; no response deletion route. | Not offered for submission history. | Uses the shared PostgreSQL pool and `DATABASE_URL`. Submission and metadata reads do not depend on ownership mapping or HMAC configuration. The historical ownership migration is retained; any database cleanup requires a separate approved migration. |
| Analytics & Reporting | No reporting-data create operation found. | Recent activity and student metrics. | No reporting update operation found. | No reporting delete operation found. | No reporting search/filter endpoint found. | Two student dashboard read operations exist in feedback folders; third functionality/service boundary not established. |

