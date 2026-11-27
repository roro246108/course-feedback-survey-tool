
const availableSurveysService = require("../services/availableSurveysService");

function getAuthenticatedStudentId(req) {
  return req.user?.user_id;
}

function isValidId(id) {
  const value = String(id);

  return (
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value))
  );
}

async function getEnrolledCourses(req, res) {
  try {
    const studentId = getAuthenticatedStudentId(req);

    if (!studentId || !isValidId(studentId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const courses = await availableSurveysService.getEnrolledCourses(studentId);
    return res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    });
  } catch (error) {
    console.error("Error fetching enrolled courses:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch enrolled courses.",
    });
  }
}

// GET available surveys
async function getAvailableSurveys(req, res) {
  try {
    const studentId = getAuthenticatedStudentId(req);

    if (!studentId || !isValidId(studentId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const surveys =
      await availableSurveysService.getAvailableSurveys(studentId);

    return res.status(200).json({
      success: true,
      count: surveys.length,
      data: surveys,
    });
  } catch (error) {
    console.error("Error fetching available surveys:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch available surveys.",
    });
  }
}

// GET one survey with its questions
async function getSurveyById(req, res) {
  try {
    const studentId = getAuthenticatedStudentId(req);
    const { surveyId } = req.params;

    if (!studentId || !isValidId(studentId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!isValidId(surveyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid survey ID.",
      });
    }

    const survey =
      await availableSurveysService.getSurveyById(
        Number(surveyId),
        studentId
      );

    if (!survey) {
      return res.status(404).json({
        success: false,
        message: "Survey not found or unavailable.",
      });
    }

    return res.status(200).json({
      success: true,
      data: survey,
    });
  } catch (error) {
    console.error("Error fetching survey details:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch survey details.",
    });
  }
}

// GET survey eligibility and submission status
async function getSurveySubmissionStatus(req, res) {
  try {
    const studentId = getAuthenticatedStudentId(req);
    const { surveyId } = req.params;

    if (!studentId || !isValidId(studentId)) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!isValidId(surveyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid survey ID.",
      });
    }

    const status =
      await availableSurveysService.getSurveySubmissionStatus(
        Number(surveyId),
        studentId
      );

    if (!status) {
      return res.status(404).json({
        success: false,
        message: "Survey not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error checking survey submission status:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check survey status.",
    });
  }
}

module.exports = {
  getEnrolledCourses,
  getAvailableSurveys,
  getSurveyById,
  getSurveySubmissionStatus,
};
