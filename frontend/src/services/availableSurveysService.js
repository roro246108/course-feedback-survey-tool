
const API_BASE_URL = `${
  (
    import.meta.env?.VITE_API_URL ||
    "http://localhost:5000"
  ).replace(/\/+$/, "")
}/api`;

async function readApiResponse(response, defaultMessage) {
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

  if (!result || result.success !== true) {
    throw new Error(
      result?.message || "Unexpected server response."
    );
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

// GET /api/student/surveys
export async function getEnrolledCourses(apiFetch) {
  const response = await apiFetch(`${API_BASE_URL}/student/courses`);
  const result = await readApiResponse(response, "Failed to fetch enrolled courses.");

  if (!Array.isArray(result.data)) {
    throw new Error("Invalid enrolled courses data received from server.");
  }

  return result.data;
}

export async function getAvailableSurveys(apiFetch) {
  const response = await apiFetch(
    `${API_BASE_URL}/student/surveys`
  );

  const result = await readApiResponse(
    response,
    "Failed to fetch available surveys."
  );

  if (!Array.isArray(result.data)) {
    throw new Error(
      "Invalid surveys data received from server."
    );
  }

  return result.data;
}

// GET /api/student/surveys/:surveyId
export async function getSurveyDetails(surveyId, apiFetch) {
  const parsedSurveyId = validateSurveyId(surveyId);

  const response = await apiFetch(
    `${API_BASE_URL}/student/surveys/${parsedSurveyId}`
  );

  const result = await readApiResponse(
    response,
    "Failed to fetch survey details."
  );

  if (!result.data || typeof result.data !== "object") {
    throw new Error(
      "Invalid survey details received from server."
    );
  }

  if (!Array.isArray(result.data.questions)) {
    throw new Error(
      "Survey questions were not returned correctly."
    );
  }

  return result.data;
}

// GET /api/student/surveys/:surveyId/submission-status
export async function getSurveySubmissionStatus(
  surveyId,
  apiFetch
) {
  const parsedSurveyId = validateSurveyId(surveyId);

  const response = await apiFetch(
    `${API_BASE_URL}/student/surveys/${parsedSurveyId}/submission-status`
  );

  const result = await readApiResponse(
    response,
    "Failed to check survey status."
  );

  if (!result.data || typeof result.data !== "object") {
    throw new Error(
      "Invalid survey status received from server."
    );
  }

  return result.data;
}
