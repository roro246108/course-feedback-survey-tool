
const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/dashboardController");
const requireStudent = require("../handlers/requireStudent");

// Get recent submissions
router.get(
  "/recent-submissions",
  requireStudent,
  dashboardController.getRecentSubmissions
);

// Get dashboard statistics
router.get(
  "/stats",
  requireStudent,
  dashboardController.getDashboardStats
);

module.exports = router;
