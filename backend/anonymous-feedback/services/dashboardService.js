
const dashboardModel = require("../models/dashboardModel");

// Get recent submissions
async function getRecentSubmissions(studentId) {
  if (!studentId) {
    throw new Error("Student ID is required");
  }

  return await dashboardModel.getRecentSubmissions(studentId);
}

// Get dashboard statistics
async function getDashboardStats(studentId) {
  if (!studentId) {
    throw new Error("Student ID is required");
  }

  const stats = await dashboardModel.getDashboardStats(studentId);

  return {
    completedSurveys: Number(stats.completed_surveys),
    availableSurveys: Number(stats.available_surveys),
    enrolledCourses: Number(stats.enrolled_courses),
  };
}

module.exports = {
  getRecentSubmissions,
  getDashboardStats,
};
