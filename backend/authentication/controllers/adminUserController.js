const adminUserModel = require("../models/adminUserModel");

function parseId(value, label) {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  ) {
    const error = new Error(`Invalid ${label} ID.`);
    error.status = 400;
    throw error;
  }

  return Number(value);
}

function parseCourseIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    const error = new Error("Select at least one course.");
    error.status = 400;
    throw error;
  }

  return [...new Set(value.map((courseId) => parseId(String(courseId), "course")))];
}

function sendBatchAssignmentResponse(res, result, accountType) {
  const { assignments, alreadyAssignedCourseIds } = result;

  if (assignments.length === 0) {
    return res.status(409).json({
      success: false,
      message: `All selected courses are already assigned to this ${accountType.toLowerCase()} for that semester.`,
      data: { assignments, alreadyAssignedCourseIds },
    });
  }

  const assignedCount = assignments.length;
  const assignedLabel = assignedCount === 1 ? "course" : "courses";
  const duplicateMessage = alreadyAssignedCourseIds.length
    ? ` ${alreadyAssignedCourseIds.length} already assigned ${alreadyAssignedCourseIds.length === 1 ? "course was" : "courses were"} skipped.`
    : "";

  return res.status(201).json({
    success: true,
    message: `Assigned ${assignedCount} ${assignedLabel} to ${accountType.toLowerCase()}.${duplicateMessage}`,
    data: { assignments, alreadyAssignedCourseIds },
  });
}

function sendError(res, error) {
  if (error.status) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  const statuses = {
    STUDENT_NOT_FOUND: 404,
    INSTRUCTOR_NOT_FOUND: 404,
    COURSE_NOT_FOUND: 404,
    SEMESTER_NOT_FOUND: 404,
    STUDENT_STATUS_NOT_CHANGEABLE: 409,
  };
  const status = statuses[error.code];

  if (status) {
    return res.status(status).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Admin student management failed:", error);
  return res.status(500).json({
    success: false,
    message: "Student management request failed.",
  });
}

async function getStudents(req, res) {
  try {
    const students = await adminUserModel.getStudents();
    return res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function getInstructors(req, res) {
  try {
    const instructors = await adminUserModel.getInstructors();
    return res.status(200).json({
      success: true,
      count: instructors.length,
      data: instructors,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function getStudent(req, res) {
  try {
    const studentId = parseId(req.params.studentId, "student");
    const student = await adminUserModel.getStudentById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    return res.status(200).json({ success: true, data: student });
  } catch (error) {
    return sendError(res, error);
  }
}

async function updateStudent(req, res) {
  try {
    const studentId = parseId(req.params.studentId, "student");
    const fullName = req.body?.fullName;

    if (
      typeof fullName !== "string" ||
      fullName.trim().length < 2 ||
      fullName.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: "Student name must be between 2 and 150 characters.",
      });
    }

    const student = await adminUserModel.updateStudentName(
      studentId,
      fullName.trim()
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student updated successfully.",
      data: student,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function updateStudentStatus(req, res) {
  try {
    const studentId = parseId(req.params.studentId, "student");
    const { accountStatus } = req.body || {};

    if (!["Active", "Inactive"].includes(accountStatus)) {
      return res.status(400).json({
        success: false,
        message: "Account status must be Active or Inactive.",
      });
    }

    const student = await adminUserModel.updateStudentAccountStatus(
      studentId,
      accountStatus
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Student account ${accountStatus.toLowerCase()} successfully.`,
      data: student,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function addEnrollment(req, res) {
  try {
    const studentId = parseId(req.params.studentId, "student");
    const semesterId = parseId(String(req.body?.semesterId ?? ""), "semester");

    if (req.body?.courseIds !== undefined) {
      const courseIds = parseCourseIds(req.body.courseIds);
      const result = await adminUserModel.addStudentEnrollments(
        studentId,
        courseIds,
        semesterId
      );
      return sendBatchAssignmentResponse(res, result, "Student");
    }

    const courseId = parseId(String(req.body?.courseId ?? ""), "course");
    const enrollment = await adminUserModel.addStudentEnrollment(
      studentId,
      courseId,
      semesterId
    );

    if (!enrollment) {
      return res.status(409).json({
        success: false,
        message: "This student is already assigned to that course and semester.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Course assigned successfully.",
      data: enrollment,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function addInstructorCourseAssignment(req, res) {
  try {
    const instructorId = parseId(req.params.instructorId, "instructor");
    const semesterId = parseId(String(req.body?.semesterId ?? ""), "semester");

    if (req.body?.courseIds !== undefined) {
      const courseIds = parseCourseIds(req.body.courseIds);
      const result = await adminUserModel.addInstructorCourseAssignments(
        instructorId,
        courseIds,
        semesterId
      );
      return sendBatchAssignmentResponse(res, result, "Instructor");
    }

    const courseId = parseId(String(req.body?.courseId ?? ""), "course");
    const assignment = await adminUserModel.addInstructorCourseAssignment(
      instructorId,
      courseId,
      semesterId
    );

    if (!assignment) {
      return res.status(409).json({
        success: false,
        message: "This instructor is already assigned to that course and semester.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Course assigned successfully.",
      data: assignment,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function removeEnrollment(req, res) {
  try {
    const studentId = parseId(req.params.studentId, "student");
    const courseId = parseId(req.params.courseId, "course");
    const semesterId = parseId(req.params.semesterId, "semester");

    const removed = await adminUserModel.removeStudentEnrollment(
      studentId,
      courseId,
      semesterId
    );

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: "Student course assignment not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Course assignment removed.",
    });
  } catch (error) {
    return sendError(res, error);
  }
}

async function removeInstructorCourseAssignment(req, res) {
  try {
    const instructorId = parseId(req.params.instructorId, "instructor");
    const courseId = parseId(req.params.courseId, "course");
    const semesterId = parseId(req.params.semesterId, "semester");

    const removed = await adminUserModel.removeInstructorCourseAssignment(
      instructorId,
      courseId,
      semesterId
    );

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: "Instructor course assignment not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Course assignment removed.",
    });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  getStudents,
  getInstructors,
  getStudent,
  updateStudent,
  updateStudentStatus,
  addEnrollment,
  addInstructorCourseAssignment,
  removeEnrollment,
  removeInstructorCourseAssignment,
};
