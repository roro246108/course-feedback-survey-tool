const express = require("express");
const router = express.Router();

const authenticateToken = require("../../shared/middleware/authenticateToken");
const authorizeRole = require("../../shared/middleware/authorizeRole");
const { csrfProtection } = require("../../shared/middleware/csrfProtection");
const adminUserController = require("../controllers/adminUserController");

router.use(authenticateToken, authorizeRole("Admin"));

router.get("/students", adminUserController.getStudents);
router.get("/instructors", adminUserController.getInstructors);
router.get("/students/:studentId", adminUserController.getStudent);
router.patch(
  "/students/:studentId",
  csrfProtection,
  adminUserController.updateStudent
);
router.patch(
  "/students/:studentId/status",
  csrfProtection,
  adminUserController.updateStudentStatus
);
router.post(
  "/students/:studentId/enrollments",
  csrfProtection,
  adminUserController.addEnrollment
);
router.post(
  "/instructors/:instructorId/course-assignments",
  csrfProtection,
  adminUserController.addInstructorCourseAssignment
);
router.delete(
  "/students/:studentId/enrollments/:courseId/:semesterId",
  csrfProtection,
  adminUserController.removeEnrollment
);

module.exports = router;