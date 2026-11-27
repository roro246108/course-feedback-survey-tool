# Local Service Boundaries and Integration Status

The agreed logical services and future Lambda names are retained. This repository currently runs one Express application; none of the Lambda boundaries below is deployed or independently running.

| Intended service / future boundary | Owner evidence | Current functions | Current code location | Status and work not invented |
|---|---|---|---|---|
| Survey Management Service / `SurveyManagementLambda` | No named owner identified in repository/context. | No management API found. Student feedback reads surveys and questions, but that is consumer functionality, not management. | No service routes/controllers/services/models found. Admin dashboard text says management screens may be connected later; Instructor page says endpoints are not available. | Missing implementation, endpoints, functionality list and owner. Team must provide required operations and role policy before implementation. |
| Anonymous Feedback Service / `AnonymousFeedbackLambda` | Requester owns Student Side / Anonymous Feedback. Personal name is not stated here. | Survey availability/details/status, transactional feedback submission, eligibility and answer validation, idempotency, duplicate prevention, comment processing, local event publication, and student-scoped participation metadata. Students cannot retrieve, edit or withdraw individual responses. | `backend/anonymous-feedback`; student frontend in `frontend/src/pages/student`, `frontend/src/components/student`, and `frontend/src/services`. | Uses the shared pool and `DATABASE_URL`. Application code no longer depends on ownership mapping or HMAC configuration. The historical ownership migration remains separate and may require database-owner cleanup if applied. |
| Analytics & Reporting Service / `AnalyticsReportingLambda` | No named owner identified in repository/context. | Two student dashboard operations: recent submissions and three student-specific counts. | `backend/anonymous-feedback/{routes,controllers,services,models}/dashboard*`; frontend `RecentSubmissions` and `ImpactStats`. | Analytics-like reads exist, but no distinct service, third function or reporting contract/owner is established. Do not silently reassign these functions. |

## Local integration contracts currently evidenced

### Eligibility lookup

`feedbackService.submitFeedback` calls `surveyManagementClient.checkStudentEligibility(surveyId, studentId, transactionClient)`. The current adapter calls `feedbackModel.checkStudentEligibility` on the submission transaction connection and does not cache authorization decisions. This is a local adapter, not a Survey Management HTTP/Lambda call.

The conceptual eligibility contract is: inputs are `surveyId` and authenticated `studentId` plus the local transaction connection; result is a boolean; dependency failure becomes `ELIGIBILITY_CHECK_UNAVAILABLE`. The adapter does not independently verify survey publication/open dates; submission logic checks those separately. Idempotency is resolved before current eligibility/open checks so a committed request can be replayed safely.

### `FeedbackSubmitted` event

Current event shape emitted after the submission transaction commits:

```json
{
  "eventType": "FeedbackSubmitted",
  "occurredAt": "ISO-8601 timestamp",
  "surveyId": 123,
  "answerCount": 4,
  "sentimentSummary": { "Positive": 1, "Negative": 1, "Neutral": 2 },
  "flaggedCommentCount": 0
}
```

The event contains no `studentId`, submission identifier, email or raw comment. It includes survey identity and event time, so the payload is privacy-minimized but is not a proof of unlinkability. The event is delivered only through Node `EventEmitter`. There is no registered Analytics & Reporting consumer, durable queue/outbox, retry, or remote delivery. Publishing failure is swallowed after DB commit so a committed submission is not reported to the student as failed; event loss remains possible.

The existing event contract publishes `FeedbackSubmitted` only for new submissions. There are no student-facing update or withdrawal operations. Because no Analytics consumer exists locally, there is no current projection to reconcile. Feedback-specific audit/metrics persistence is also not implemented; submission error logs avoid answer content.

## Future Lambda boundaries

`SurveyManagementLambda`, `AnonymousFeedbackLambda`, and `AnalyticsReportingLambda` are intended future deployment units only. This documentation describes a boundary mapping, not deployed handlers. Protocols between the future units, API Gateway/EventBridge/SQS use, authentication between services, retries and timeouts remain undecided and are not represented as implemented.

The local in-memory rate limiter is per process and resets on restart. The local event bus is synchronous and nondurable. These are suitable only as documented local implementations, not claims of production-scale service integration.

## Student Side privacy guarantees and limits

`student_id` remains in `participation` and `feedback_idempotency`; `feedback_submissions` and `feedback_answers` have no student column. The read-only student metadata endpoint selects the authenticated student's participation row and joins only survey/course/semester catalog tables. It never joins feedback submissions or answers. Because the supplied schema has no FK from `participation` to `feedback_submissions`, this page reports participation metadata and does not claim to resolve a corresponding anonymous response row. Participation and idempotency rows contain identity for eligibility, duplicate prevention and retry handling. Dashboard recent-submission metadata is scoped to the authenticated student and contains no answer text. These separations do not guarantee unlinkability: database readers with access to both participation and response data may correlate records using survey and timing, especially for small groups. The local event includes survey ID, event time, answer count and aggregate rule-based comment labels, which can also narrow correlation. The application has no verified minimum-response threshold. The legacy ownership mapping migration remains in the repository but is not used by application code; if already applied, retain the table/data until a separately reviewed cleanup migration is approved.

Student Side controllers do not intentionally log a student ID together with feedback content. Submission error logging records only an error code. Other Student Side database failures may log error objects/messages, and the central Express handler logs the error object; these can reveal database diagnostics to server logs, but the inspected paths do not log submitted answer text or combine it with an authenticated student ID. No request-body logging middleware was found in the inspected local routes. Anonymous Feedback temporarily uses the same pool and database role as Authentication. Database-level least-privilege separation is therefore not active. When dedicated roles are resumed, `REVOKE ALL ... FROM PUBLIC` alone will not remove direct or inherited privileges from other roles; role grants and memberships must be checked. Separate pools within this Express process do not provide process isolation.

Improvements that do not require schema changes include limiting access to production database/logs, keeping free-text answers out of logs and events, minimizing event fields or reducing/removing event timestamp precision, and reviewing retention/access policies. Changes to event consumers/contracts should be coordinated with the team. Database timestamp changes, a response suppression threshold, retention rules, or any stronger identity-to-answer separation need team/professor approval because they alter schema, reporting behavior, or privacy policy. No threshold is established by the available requirements.

## Confirmation / receipt requirement

Repository requirements and API documents describe anonymous submission and confirmation, but no source establishes a unique receipt identifier or a persistent receipt lookup contract. The generic `201` confirmation and idempotent `200` replay communicate success without identifying the student or exposing answers. Whether a separate receipt identifier is required remains a requirements question.

