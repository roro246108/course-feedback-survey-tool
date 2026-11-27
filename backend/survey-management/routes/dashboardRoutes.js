
const express = require('express');
const router = express.Router();

const authenticateToken = require('../../shared/middleware/authenticateToken');
const authorizeRole = require('../../shared/middleware/authorizeRole');

const dashboardController = require('../controllers/dashboardController');

// Admin-only dashboard endpoints
router.use(authenticateToken, authorizeRole('Admin'));

// Dashboard statistics
router.get('/stats', dashboardController.getDashboardStats);

// Response trend
router.get('/response-trend', dashboardController.getResponseTrend);

// Survey status
router.get('/survey-status', dashboardController.getSurveyStatus);

// Recent surveys
router.get('/recent-surveys', dashboardController.getRecentSurveys);

module.exports = router;
