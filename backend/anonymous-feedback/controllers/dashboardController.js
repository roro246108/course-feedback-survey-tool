
const dashboardService = require("../services/dashboardService");

// Get recent submissions for the dashboard
async function getRecentSubmissions(req, res) {
  try {
    if (!req.user || !req.user.user_id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const studentId = req.user.user_id;

    const submissions =
      await dashboardService.getRecentSubmissions(studentId);

    return res.status(200).json({
      success: true,
      count: submissions.length,
      data: submissions,
    });

  } catch (error) {
    console.error("Error fetching recent submissions:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch recent submissions",
    });
  }
}

// Get dashboard statistics
async function getDashboardStats(req, res) {
  try {
    if (!req.user || !req.user.user_id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const studentId = req.user.user_id;

    const stats = await dashboardService.getDashboardStats(studentId);

    return res.status(200).json({
      success: true,
      data: stats,
    });

  } catch (error) {
    console.error("Error fetching dashboard statistics:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
    });
  }
}

module.exports = {
  getRecentSubmissions,
  getDashboardStats,
};
