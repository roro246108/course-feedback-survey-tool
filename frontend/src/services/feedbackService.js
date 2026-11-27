
const API_BASE_URL = `${
  (import.meta.env?.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "")
}/api`;

async function readResponse(response, defaultMessage) {
  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Invalid response received from server.");
  }

  if (!response.ok) {
    const error = new Error(
      result?.message || defaultMessage
    );

    error.status = response.status;
    error.data = result;

    throw error;
  }

  return result;
}

function validateSurveyId(surveyId) {
  const rawSurveyId = String(surveyId);
  const parsedSurveyId = Number(rawSurveyId);

  if (
    !/^[1-9]\d*$/.test(rawSurveyId) ||
    !Number.isSafeInteger(parsedSurveyId) ||
    parsedSurveyId <= 0
  ) {
    throw new Error("Invalid survey ID.");
  }

  return parsedSurveyId;
}

// POST /api/feedback/submit
export async function submitFeedback(
  surveyId,
  answers,
  apiFetch,
  idempotencyKey
) {
  const parsedSurveyId = validateSurveyId(surveyId);

  if (!Array.isArray(answers) || answers.length === 0) {
    throw new Error("At least one answer is required.");
  }

  if (
    !idempotencyKey ||
    typeof idempotencyKey !== "string" ||
    !idempotencyKey.trim()
  ) {
    throw new Error("An idempotency key is required.");
  }

  const response = await apiFetch(
    `${API_BASE_URL}/feedback/submit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey.trim(),
      },
      body: JSON.stringify({ survey_id: parsedSurveyId, answers }),
    }
  );

  const result = await readResponse(
    response,
    "Failed to submit feedback."
  );

  if (result.success !== true) {
    throw new Error(
      result.message || "Feedback submission failed."
    );
  }

  return result;
}

// GET /api/student/submissions. The backend derives student identity from JWT.
export async function getStudentSubmissionMetadata(apiFetch) {
  const response = await apiFetch(`${API_BASE_URL}/student/submissions`);
  const result = await readResponse(response, "Failed to fetch your submissions.");

  if (result.success !== true || !Array.isArray(result.data)) {
    throw new Error(result.message || "Invalid submission metadata received from server.");
  }

  return result.data;
}

export function filterSubmissionMetadata(submissions, searchTerm) {
  const query = String(searchTerm || "").trim().toLocaleLowerCase();
  if (!query) return submissions;

  return submissions.filter((submission) =>
    [submission.survey_title, submission.course_name, submission.course_code]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(query))
  );
}

