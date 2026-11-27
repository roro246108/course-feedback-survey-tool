
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`
).replace(/\/+$/, '');

const SURVEYS_URL = `${API_BASE_URL}/surveys`;

const validateId = (id, label) => {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw new Error(`Invalid ${label} ID.`);
  }
};

// apiFetch is supplied by AuthContext so requests include the access token.
const request = async (path, options = {}, apiFetch) => {
  if (typeof apiFetch !== 'function') {
    throw new Error('Authenticated API client is unavailable.');
  }

  let response;

  try {
    const url = `${SURVEYS_URL}${path}`;
    response = await apiFetch(url, options);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }

    throw new Error('Unable to connect to the survey server.');
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error('The survey server returned an invalid response.');
  }

  if (!response.ok || result.success === false) {
    throw new Error(result.message || 'The survey request failed.');
  }

  return result.data;
};

// GET all surveys
export const getSurveys = (options = {}, apiFetch) =>
  request('/', options, apiFetch);

// GET survey by ID
export const getSurveyById = (surveyId, options = {}, apiFetch) => {
  validateId(surveyId, 'survey');
  return request(`/${surveyId}`, options, apiFetch);
};

// GET a survey and its questions
export const getSurveyQuestions = (surveyId, options = {}, apiFetch) => {
  validateId(surveyId, 'survey');
  return request(`/${surveyId}/questions`, options, apiFetch);
};

// GET all courses
export const getCourses = (options = {}, apiFetch) =>
  request('/courses', options, apiFetch);

// GET all semesters
export const getSemesters = (options = {}, apiFetch) =>
  request('/semesters', options, apiFetch);

// GET instructors by course and semester
export const getInstructorsByCourseAndSemester = (
  courseId,
  semesterId,
  options = {},
  apiFetch
) => {
  const query = new URLSearchParams({
    courseId: String(courseId),
    semesterId: String(semesterId)
  });

  return request(`/instructors?${query}`, options, apiFetch);
};

// POST create survey
export const createSurvey = (survey, apiFetch) =>
  request('/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(survey)
  }, apiFetch);

// PUT update survey
export const updateSurvey = (surveyId, survey, apiFetch) => {
  validateId(surveyId, 'survey');

  return request(`/${surveyId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(survey)
  }, apiFetch);
};

// PATCH survey status
export const changeSurveyStatus = (surveyId, status, apiFetch) => {
  validateId(surveyId, 'survey');

  return request(`/${surveyId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  }, apiFetch);
};

// DELETE survey
export const deleteSurvey = (surveyId, apiFetch) => {
  validateId(surveyId, 'survey');

  return request(`/${surveyId}`, {
    method: 'DELETE'
  }, apiFetch);
};

// POST a question for a survey
export const addQuestion = (surveyId, questionData, apiFetch) => {
  validateId(surveyId, 'survey');

  return request(`/${surveyId}/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(questionData)
  }, apiFetch);
};

// PUT an existing question without changing its ID
export const updateQuestion = (
  surveyId,
  questionId,
  questionData,
  apiFetch
) => {
  validateId(surveyId, 'survey');
  validateId(questionId, 'question');

  return request(`/${surveyId}/questions/${questionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(questionData)
  }, apiFetch);
};

// DELETE a question from the selected survey
export const deleteQuestion = (
  surveyId,
  questionId,
  apiFetch
) => {
  validateId(surveyId, 'survey');
  validateId(questionId, 'question');

  return request(`/${surveyId}/questions/${questionId}`, {
    method: 'DELETE'
  }, apiFetch);
};

// PUT the complete ordered question ID list
export const reorderQuestions = (surveyId, orderData, apiFetch) => {
  validateId(surveyId, 'survey');

  return request(`/${surveyId}/questions/reorder`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderData)
  }, apiFetch);
};
