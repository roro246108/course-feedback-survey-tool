
const express = require('express');
const router = express.Router();
const authenticateToken = require('../../shared/middleware/authenticateToken');
const authorizeRole = require('../../shared/middleware/authorizeRole');

const semesterComparisonController = require('../controllers/semesterComparisonController');

router.use(authenticateToken, authorizeRole('Admin', 'Instructor'));

router.get(
    '/',
    semesterComparisonController.getSemesterComparison
);

module.exports = router;
