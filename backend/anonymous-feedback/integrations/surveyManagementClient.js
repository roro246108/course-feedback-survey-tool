const feedbackModel = require("../models/feedbackModel");

function createError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

// Local development adapter: eligibility is read from the shared database.
// Passing the submission transaction client avoids a stale process-local cache.
async function checkStudentEligibility(surveyId, studentId, db) {
  try {
    return await feedbackModel.checkStudentEligibility(
      surveyId,
      studentId,
      db
    );
  } catch {
    throw createError(
      "Student eligibility could not be verified. Please try again.",
      503,
      "ELIGIBILITY_CHECK_UNAVAILABLE"
    );
  }
}

module.exports = {
  checkStudentEligibility,
};
