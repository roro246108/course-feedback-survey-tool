
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
).replace(/\/$/, '');

const SURVEYS_URL = `${API_BASE_URL}/surveys`;

const validateId = (id, label) => {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
    throw new Error(`Invalid ${label} ID.`);
  }
};

const request = async (path, options = {}) => {
  let response;

  try {
    response = await fetch(`${SURVEYS_URL}${path}`, options);
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
export const getSurveys = (options = {}) =>
  request('/', options);

// GET survey by ID
export const getSurveyById = (surveyId, options = {}) => {
  validateId(surveyId, 'survey');
  return request(`/${surveyId}`, options);
};

// GET a survey and its questions
export const getSurveyQuestions = (surveyId, options = {}) => {
  validateId(surveyId, 'survey');
  return request(`/${surveyId}/questions`, options);
};

// GET all courses
export const getCourses = (options = {}) =>
  request('/courses', options);

// GET all semesters
export const getSemesters = (options = {}) =>
  request('/semesters', options);

// GET instructors by course and semester
export const getInstructorsByCourseAndSemester = (
  courseId,
  semesterId,
  options = {}
) => {
  const query = new URLSearchParams({
    courseId: String(courseId),
    semesterId: String(semesterId)
  });

  return request(`/instructors?${query}`, options);
};

// POST create survey
export const createSurvey = (survey) =>
  request('/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(survey)
  });


// PUT update survey
export const updateSurvey = (surveyId, survey) => {
  validateId(surveyId, 'survey');
  return request(`/${surveyId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(survey)
  });
};

// PATCH survey status
export const changeSurveyStatus = (surveyId, status) => {
  validateId(surveyId, 'survey');
  return request(`/${surveyId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  });
};

// DELETE survey
export const deleteSurvey = (surveyId) => {
  validateId(surveyId, 'survey');
  return request(`/${surveyId}`, {
    method: 'DELETE'
  });
};

// POST a question for a survey
export const addQuestion = (surveyId, questionData) => {
  validateId(surveyId, 'survey');
  return request(`/${surveyId}/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(questionData)
  });
};

// PUT an existing question without changing its ID
export const updateQuestion = (surveyId, questionId, questionData) => {
  validateId(surveyId, 'survey');
  validateId(questionId, 'question');
  return request(`/${surveyId}/questions/${questionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(questionData)
  });
};

// DELETE a question from the selected survey
export const deleteQuestion = (surveyId, questionId) => {
  validateId(surveyId, 'survey');
  validateId(questionId, 'question');
  return request(`/${surveyId}/questions/${questionId}`, {
    method: 'DELETE'
  });
};

// PUT the complete ordered question ID list
export const reorderQuestions = (surveyId, orderData) => {
  validateId(surveyId, 'survey');
  return request(`/${surveyId}/questions/reorder`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderData)
  });
};


