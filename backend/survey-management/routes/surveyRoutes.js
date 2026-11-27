
const express = require('express');
const router = express.Router();

const surveyController = require('../controllers/surveyController');

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

// MANAGE questions for one survey
router.get('/:id/questions', surveyController.getSurveyQuestions);
router.post('/:id/questions', surveyController.addQuestion);
router.put('/:id/questions/reorder', surveyController.reorderQuestions);
router.put('/:id/questions/:questionId', surveyController.updateQuestion);
router.delete('/:id/questions/:questionId', surveyController.deleteQuestion);

// UPDATE survey
router.put('/:id', surveyController.updateSurvey);

// CHANGE survey status
router.patch('/:id/status', surveyController.changeSurveyStatus);

// DELETE survey
router.delete('/:id', surveyController.deleteSurvey);

// GET survey by ID
router.get('/:id', surveyController.getSurveyById);

// CREATE survey
router.post('/', surveyController.createSurvey);

module.exports = router;
