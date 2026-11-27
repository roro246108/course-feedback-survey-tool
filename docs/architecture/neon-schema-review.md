# Neon Schema Review

Source: user-provided Neon columns and constraints metadata exports in `01_neon_schema_columns.md` and `02_neon_schema_constraints.md`. No database connection was made. These exports are metadata, not executable DDL.

## Export discrepancy requiring refresh

The columns export lists 100 columns and does not include `users.updated_at` or `users.password_changed_at`. The constraints export includes `users_updated_at_not_null` (`NOT NULL updated_at`). The exports therefore disagree about `users.updated_at`. Do not infer whether the live column exists; obtain a fresh columns export before changing any SQL that depends on it.

The prior code selected, inserted or updated `users.password_changed_at` in `authModel.js` and development/admin scripts. That column is absent from the supplied 100-row columns export and is not supported by the constraints export. Those unsupported references have been removed; repository search found no authentication business logic depending on the field. `updated_at` references remain because the constraints export explicitly requires it. Treat user-table queries involving `updated_at` as unverified until a fresh export resolves the discrepancy.

The columns export reports `character` for token/hash columns but does not include `character_maximum_length`. Hash length compatibility therefore cannot be confirmed from this export alone.

## Confirmed constraints relevant to feedback

| Table | Constraint | Definition | Application relationship |
|---|---|---|---|
| `participation` | `participation_survey_id_student_id_key` | `UNIQUE (survey_id, student_id)` | Matches the exact constraint name caught by `feedbackService` for duplicate submission. |
| `feedback_idempotency` | `feedback_idempotency_unique_key` | `UNIQUE (survey_id, student_id, idempotency_key_hash)` | Supports per-student/per-survey key uniqueness. |
| `feedback_answers` | `feedback_answers_submission_id_question_id_key` | `UNIQUE (submission_id, question_id)` | Supports one answer per question per anonymous submission. |
| `feedback_answers` | `feedback_answers_rating_value_check` | `rating_value >= 1 AND rating_value <= 5` | Matches service rating range. |
| `feedback_answers` | `feedback_answers_check` | At least one of `rating_value` or `text_answer` is non-NULL. | Service sends one answer form per question type. |
| `questions` | `questions_question_type_check` | Type is `Rating` or `Text`. | Matches service question-type validation. |
| `surveys` | `surveys_status_check` | Status is `Draft`, `Published` or `Closed`. | Matches publication checks. |
| `surveys` | `surveys_check` | `closing_date > opening_date`. | Database date-range check. |

Other unique constraints in the export: invitation token hash; `(course_id, semester_id, instructor_id)`; course code; email-verification token hash; `(student_id, course_id, semester_id)` enrollment; password-reset token hash; `(semester_name, academic_year)`; session refresh-token hash; and user email. Other check constraints restrict invitation/user roles, user account status and semester date order. Primary keys exist for each listed entity as shown by the ERD and export. The supplied metadata does not include a standalone index inventory.

## Verified relationships from the constraints export

Foreign keys explicitly present in that export:

- `course_instructors.course_id` → `courses.course_id`; `.semester_id` → `semesters.semester_id`; `.instructor_id` → `users.user_id`.
- `enrollments.course_id` → `courses.course_id`; `.semester_id` → `semesters.semester_id`; `.student_id` → `users.user_id`.
- `surveys.course_instructor_id` → `course_instructors.course_instructor_id`; `.created_by` → `users.user_id`.
- `questions.survey_id` → `surveys.survey_id` (`ON DELETE CASCADE`).
- `feedback_submissions.survey_id` → `surveys.survey_id`.
- `feedback_answers.submission_id` → `feedback_submissions.submission_id` (`ON DELETE CASCADE`); `.question_id` → `questions.question_id`.
- `participation.survey_id` → `surveys.survey_id`; `.student_id` → `users.user_id`.
- `feedback_idempotency.survey_id` → `surveys.survey_id`; `.student_id` → `users.user_id`.
- Authentication FKs connect invitations, audit logs, verification/reset tokens and sessions to users; sessions also reference replacement sessions.

No FK links `participation` to `feedback_submissions`. `feedback_submissions` has no `student_id` in the supplied columns export. The code therefore keeps identity in participation/idempotency records separate from the answer submission row, but matching survey/timestamps can still create a correlation risk. Do not claim cryptographic or absolute unlinkability.

## SQL compatibility review

The feedback model queries use columns present in the supplied columns export: surveys and dates/status; course assignment, enrollment, course, semester and user display data; question fields; participation; feedback submission; answer; and idempotency columns. The exact unique constraint expected for participation and idempotency is present in the constraints export.

Authentication/session models use the expected exported columns for sessions, invitations, verification/reset tokens and audit logs. User-table access is the exception: current queries still use `updated_at`, whose presence conflicts between the two exports; see discrepancy above. Do not describe authentication SQL as fully schema-verified until refreshed metadata is available.

## Privacy-relevant schema facts

- `feedback_submissions` includes `submission_id`, `survey_id`, and `submitted_at`; it has no `student_id` in the provided columns export.
- `participation` includes `participation_id`, `survey_id`, `student_id`, and `submitted_at`.
- `feedback_answers` includes `submission_id` and `question_id`, with nullable rating/text values and the checks above.
- `feedback_idempotency` includes survey/student IDs and hashed key/payload fields.

The event publisher no longer emits a `submissionId`; participation/submission timestamps are independently defaulted but may still be close in the database. A reader with access to both tables could correlate records by survey and timing, especially when few students participated. This is separation, not guaranteed unlinkability; no minimum-response threshold is defined in the supplied schema or current Student Side code. The student dashboard is limited to the authenticated student's own counts and does not expose cross-student aggregates.

## Proposed ownership migration (not applied)

`backend/database/migrations/001_feedback_ownership_mapping.sql` is a historical, additive proposal and was not executed as part of this application refactor. It adds `participation.status`, a composite unique target, an ownership map, and a survey-lock function. The active application no longer requires those objects. Do not remove existing database objects or data automatically; if the migration was applied, any cleanup requires a separate compatibility review and approved migration. Historical participation and response rows must not be correlated or backfilled based on survey ID or timestamps alone.

Anonymous Feedback uses the existing shared pool configured through `DATABASE_URL`, so it shares the database role with Authentication and has no database-principal isolation. The dedicated role/pool plan remains paused. When revisited, the runtime principal should be distinct from any migration/schema owner and should not inherit elevated privileges. Both services still run within one Express process, so separate pools alone would not provide process-level isolation.

The submission path now locks the selected `surveys` row directly with `SELECT ... FOR UPDATE` inside the transaction and does not call the migration's SECURITY DEFINER lock function. PostgreSQL requires the runtime identity to have `UPDATE` privilege on the locked table (as well as `SELECT`); any future restricted shared-runtime grant plan must include this permission or adopt a separately approved locking design. The current shared owner identity can perform this lock by ownership. Do not infer that the earlier SELECT-only survey grant matrix remains sufficient.

## Proposed student email and account-status migration (not applied)

`backend/database/migrations/002_student_email_and_account_status.sql` is an additive migration proposal. It adds `users.personal_email` for Student and Instructor invitation delivery and `account_invitations.academic_email` for the official login address captured before acceptance. For both roles, `account_invitations.email` and `users.personal_email` hold the personal delivery address, while `account_invitations.academic_email` and `users.email` hold the academic/login address. It standardizes account status to `Pending`, `Active`, and `Inactive`; a pre-existing `Disabled` value is mapped to `Inactive` if present. It recognizes and replaces only a simple single-column status `CHECK` with the expected old (`Pending`, `Active`, `Disabled`) or target value set, and aborts for unexpected values or complex checks. The case-insensitive personal-email unique index applies to both Students and Instructors; the existing global unique constraint on `users.email` remains unchanged. The migration validates duplicate personal emails for both roles and remains unapplied.

