
const availableSurveysModel = require("../models/availableSurveysModel");

function validateStudentId(studentId) {
  const parsedStudentId = Number(studentId);

  if (
    studentId === undefined ||
    studentId === null ||
    String(studentId).trim() === "" ||
    !Number.isSafeInteger(parsedStudentId) ||
    parsedStudentId <= 0
  ) {
    throw new Error("Invalid student ID");
  }

  return parsedStudentId;
}

function validateSurveyId(surveyId) {
  if (
    !Number.isSafeInteger(surveyId) ||
    surveyId <= 0
  ) {
    throw new Error("Invalid survey ID");
  }
}

// Get surveys available to the authenticated student.
async function getAvailableSurveys(studentId) {
  const validStudentId = validateStudentId(studentId);

  return availableSurveysModel.getAvailableSurveys(validStudentId);
}

async function getEnrolledCourses(studentId) {
  const validStudentId = validateStudentId(studentId);
  return availableSurveysModel.getEnrolledCourses(validStudentId);
}

// Get details of one available survey.
async function getSurveyById(surveyId, studentId) {
  validateSurveyId(surveyId);

  const validStudentId = validateStudentId(studentId);

  return availableSurveysModel.getSurveyById(
    surveyId,
    validStudentId
  );
}

// Get eligibility and previous-submission status.
async function getSurveySubmissionStatus(surveyId, studentId) {
  validateSurveyId(surveyId);

  const validStudentId = validateStudentId(studentId);

  return availableSurveysModel.getSurveySubmissionStatus(
    surveyId,
    validStudentId
  );
}

module.exports = {
  getEnrolledCourses,
  getAvailableSurveys,
  getSurveyById,
  getSurveySubmissionStatus,
};
