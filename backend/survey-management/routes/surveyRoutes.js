
const express = require('express');
const router = express.Router();

const authenticateToken = require('../../shared/middleware/authenticateToken');
const authorizeRole = require('../../shared/middleware/authorizeRole');

const surveyController = require('../controllers/surveyController');

// All Survey Management endpoints are Admin-only.
router.use(authenticateToken, authorizeRole('Admin'));

// GET all surveys
router.get('/', surveyController.getAllSurveys);

// GET all courses
router.get('/courses', surveyController.getAllCourses);

// GET instructors by course and semester
router.get(
    '/instructors',
    surveyController.getInstructorsByCourseAndSemester
);

// GET all semesters
router.get('/semesters', surveyController.getAllSemesters);

// Manage questions for one survey
router.get('/:id/questions', surveyController.getSurveyQuestions);
router.post('/:id/questions', surveyController.addQuestion);
router.put('/:id/questions/reorder', surveyController.reorderQuestions);
router.put('/:id/questions/:questionId', surveyController.updateQuestion);
router.delete('/:id/questions/:questionId', surveyController.deleteQuestion);

// Update survey
router.put('/:id', surveyController.updateSurvey);

// Change survey status
router.patch('/:id/status', surveyController.changeSurveyStatus);

// Delete survey
router.delete('/:id', surveyController.deleteSurvey);

// Get survey by ID
router.get('/:id', surveyController.getSurveyById);

// Create survey
router.post('/', surveyController.createSurvey);

module.exports = router;
