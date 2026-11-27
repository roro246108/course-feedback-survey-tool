
const express = require('express');
const router = express.Router();
const authenticateToken = require('../../shared/middleware/authenticateToken');
const authorizeRole = require('../../shared/middleware/authorizeRole');

const {
    getOverview,
    getFeedbackTrends,
    getSemesterComparison,
    getCoursePerformance,
    getInstructorPerformance,
    getRecentFeedback,
    getRatingDistribution,
    getResponseRates
} = require('../controllers/analyticsController');

router.use(authenticateToken, authorizeRole('Admin', 'Instructor'));

// Overall Analytics
router.get('/overview', getOverview);

// Feedback Trends
router.get('/feedback-trends', getFeedbackTrends);

// Semester Comparison
router.get('/semester-comparison', getSemesterComparison);

// Course Performance
router.get('/course-performance', getCoursePerformance);

// Instructor Performance
router.get('/instructor-performance', getInstructorPerformance);

// Recent Feedback
router.get('/recent-feedback', getRecentFeedback);

// Rating Distribution (count of answers for each rating 1-5)
router.get('/rating-distribution', getRatingDistribution);

// Response Rates (enrolled vs. participated students per survey, counts only)
router.get('/response-rates', getResponseRates);

module.exports = router;
