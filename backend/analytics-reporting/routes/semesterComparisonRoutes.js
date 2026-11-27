
const express = require('express');
const router = express.Router();

const semesterComparisonController = require('../controllers/semesterComparisonController');

router.get(
    '/',
    semesterComparisonController.getSemesterComparison
);

module.exports = router;
