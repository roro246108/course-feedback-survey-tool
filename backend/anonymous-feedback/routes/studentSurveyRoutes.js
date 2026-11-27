
const express = require("express");
const router = express.Router();

const availableSurveysController = require("../controllers/availableSurveysController");
const feedbackController = require("../controllers/feedbackController");
const requireStudent = require("../handlers/requireStudent");

router.get("/courses", requireStudent, availableSurveysController.getEnrolledCourses);
router.get("/submissions", requireStudent, feedbackController.getStudentSubmissionMetadata);

// GET /api/student/surveys
router.get(
  "/surveys",
  requireStudent,
  availableSurveysController.getAvailableSurveys
);

// GET /api/student/surveys/:surveyId/submission-status
router.get(
  "/surveys/:surveyId/submission-status",
  requireStudent,
  availableSurveysController.getSurveySubmissionStatus
);

// GET /api/student/surveys/:surveyId
router.get(
  "/surveys/:surveyId",
  requireStudent,
  availableSurveysController.getSurveyById
);

module.exports = router;
