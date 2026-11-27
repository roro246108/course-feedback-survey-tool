
const express = require("express");
const router = express.Router();

const rateLimitMiddleware = require("../../middleware/rateLimitMiddleware");
const feedbackController = require("../controllers/feedbackController");

const requireStudent = require("../handlers/requireStudent");

// Canonical student submission route. The legacy route uses the same handler
// while the existing client integration transitions to this contract.
router.post(
  "/feedback/submit",
  requireStudent,
  rateLimitMiddleware,
  feedbackController.submitFeedback
);

router.post(
  "/surveys/:surveyId/responses",
  requireStudent,
  rateLimitMiddleware,
  feedbackController.submitFeedback
);

module.exports = router;
