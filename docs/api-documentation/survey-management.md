# Survey management API

The survey form uses the Express API mounted at `/api/surveys`. The frontend
uses `VITE_API_BASE_URL` when set and otherwise defaults to
`http://localhost:5000/api`.

## Lookup endpoints

- `GET /courses` returns the available courses.
- `GET /semesters` returns the available semesters.
- `GET /instructors?courseId=<id>&semesterId=<id>` returns instructors assigned
  to that course and semester.

## Create a survey

`POST /api/surveys` accepts JSON:

```json
{
  "title": "Course feedback",
  "description": "End-of-course feedback",
  "course_id": 1,
  "semester_id": 1,
  "instructor_id": 1,
  "status": "Published",
  "opening_date": "2027-01-15",
  "closing_date": "2027-01-30",
  "questions": [
    {
      "question_text": "How would you rate this course?",
      "question_type": "Rating",
      "is_required": true
    }
  ]
}
```

The selected instructor must be assigned to the selected course and semester.
Titles are limited to 200 characters, descriptions to 500 characters, and the
closing date must follow the opening date. Questions must use the `Text` or
`Rating` type. Published surveys need at least one non-empty question; drafts
may be saved without questions. The survey and its questions are written in one
database transaction, so a failed question insert does not leave a partial
survey. The creator is assigned by the backend; clients must not send
`created_by`.

A successful request returns `201` with the inserted survey and questions in
`data`. Validation errors return `400`; database failures return `500`.

## Manage a survey

- `GET /api/surveys/:id` returns the selected survey, its questions ordered by
  `display_order`, and whether responses exist.
- `PUT /api/surveys/:id` updates survey fields and reconciles questions. Existing
  question IDs are updated in place; new questions omit `question_id`. Question
  edits are rejected with `409` after responses exist.
- `PATCH /api/surveys/:id/status` accepts `{ "status": "Published" }` to publish a
  draft or `{ "status": "Closed" }` to close a published survey. Status actions
  validate the existing survey data and reject invalid/repeated transitions
  with `409`.
- `DELETE /api/surveys/:id` deletes a survey only when it has no responses.
  PostgreSQL cascades the survey's questions; submitted feedback and
  participation records are protected and result in `409`.

## Manage questions for a survey

The admin page uses `/admin/surveys/:id/questions`; the `id` is the actual
survey ID. The sidebar's Manage Questions link first displays surveys from the
database so an admin can choose which survey to manage.

- `GET /api/surveys/:id/questions` returns that survey's information, ordered
  questions, and response-lock state.
- `POST /api/surveys/:id/questions` accepts
  `{ "question_text": "...", "question_type": "Rating", "is_required": true }`.
  PostgreSQL generates the new `question_id`, and the backend assigns the next
  sequential `display_order`.
- `PUT /api/surveys/:id/questions/:questionId` updates text, type, and required
  status without changing the question ID.
- `DELETE /api/surveys/:id/questions/:questionId` deletes only the question
  belonging to that survey, and compacts the remaining display order.
- `PUT /api/surveys/:id/questions/reorder` accepts
  `{ "question_ids": [12, 14, 13] }`. The list must contain every question in
  the survey exactly once; resulting display orders are sequential.

Question writes lock the survey row and run in a database transaction. A
question with submitted answers cannot be edited or deleted. To preserve the
existing historical-feedback policy, all question additions, edits, deletions,
and reordering are also rejected once the survey has participation or feedback
submissions. Invalid IDs and IDs belonging to another survey are rejected.

## Backend structure

The active request flow is `routes → controllers → handlers → models`:

- Routes map URLs to controller actions.
- Controllers handle HTTP input, status codes, and response JSON.
- Handlers validate input and apply survey business rules.
- Models own PostgreSQL queries and transactions for survey and question
  operations.

The admin dashboard uses the same flow. The older service and repository module
paths remain as thin compatibility exports; controllers call handlers and
handlers call models directly.

For question-ID troubleshooting, start the backend with
`SURVEY_QUESTION_DEBUG=true` to log IDs received by the controller and handler,
the model's update/insert branch, and SQL affected-row results. The diagnostics
do not include question text or credentials. Restart the backend after code
changes so the running process loads the updated model; unset the flag to
disable these logs.
