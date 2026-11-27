const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');


// GET dashboard statistics
router.get('/stats', dashboardController.getDashboardStats);
router.get('/response-trend', dashboardController.getResponseTrend);
// Survey Status
router.get('/survey-status', dashboardController.getSurveyStatus);
// Recent Surveys
router.get('/recent-surveys', dashboardController.getRecentSurveys);
module.exports = router;