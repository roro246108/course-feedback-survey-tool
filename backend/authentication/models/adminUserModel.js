const pool = require("../../database/db");
const sessionModel = require("./sessionModel");

const STUDENTS_QUERY = `
  SELECT
    u.user_id AS student_id,
    u.full_name,
    u.email,
    u.account_status,
<<<<<<< Updated upstream
    u.email_verified,
    COALESCE(
      json_agg(
        json_build_object(
          'course_id', c.course_id,
          'course_code', c.course_code,
          'course_name', c.course_name,
          'semester_id', sem.semester_id,
          'semester_name', sem.semester_name,
          'academic_year', sem.academic_year
        )
        ORDER BY sem.start_date DESC, c.course_name
      ) FILTER (WHERE e.enrollment_id IS NOT NULL),
      '[]'::json
    ) AS courses
  FROM users u
  LEFT JOIN enrollments e
    ON e.student_id = u.user_id
  LEFT JOIN courses c
    ON c.course_id = e.course_id
  LEFT JOIN semesters sem
    ON sem.semester_id = e.semester_id
=======
    u.email_verified
  FROM users u
>>>>>>> Stashed changes
  WHERE u.role = 'Student'
`;

async function getStudents(db = pool) {
  const result = await db.query(`
    ${STUDENTS_QUERY}
    GROUP BY u.user_id
    ORDER BY u.full_name, u.user_id;
  `);

  return result.rows;
}

async function getInstructors(db = pool) {
  const result = await db.query(`
    SELECT
      u.user_id AS instructor_id,
      u.full_name,
<<<<<<< Updated upstream
      u.email,
      COALESCE(
        json_agg(
          json_build_object(
            'course_id', c.course_id,
            'course_code', c.course_code,
            'course_name', c.course_name,
            'semester_id', sem.semester_id,
            'semester_name', sem.semester_name,
            'academic_year', sem.academic_year
          )
          ORDER BY sem.start_date DESC, c.course_name
        ) FILTER (WHERE ci.course_instructor_id IS NOT NULL),
        '[]'::json
      ) AS courses
    FROM users u
    LEFT JOIN course_instructors ci
      ON ci.instructor_id = u.user_id
    LEFT JOIN courses c
      ON c.course_id = ci.course_id
    LEFT JOIN semesters sem
      ON sem.semester_id = ci.semester_id
=======
      u.email
    FROM users u
>>>>>>> Stashed changes
    WHERE u.role = 'Instructor'
    GROUP BY u.user_id
    ORDER BY u.full_name, u.user_id;
  `);

  return result.rows;
}

async function getStudentById(studentId, db = pool) {
  const result = await db.query(`
    ${STUDENTS_QUERY}
      AND u.user_id = $1
    GROUP BY u.user_id;
  `, [studentId]);

  return result.rows[0] || null;
}

async function updateStudentName(studentId, fullName, db = pool) {
  const result = await db.query(`
    UPDATE users
    SET full_name = $1
    WHERE user_id = $2
      AND role = 'Student'
    RETURNING user_id AS student_id, full_name, email, account_status, email_verified;
  `, [fullName, studentId]);

  return result.rows[0] || null;
}

async function updateStudentAccountStatus(studentId, accountStatus, db = pool) {
  const client = await db.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const targetResult = await client.query(`
      SELECT user_id, account_status, email_verified
      FROM users
      WHERE user_id = $1
        AND role = 'Student'
      FOR UPDATE;
    `, [studentId]);
    const target = targetResult.rows[0];

    if (!target) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return null;
    }

    if (!["Active", "Inactive"].includes(target.account_status)) {
      const error = new Error(
        "Pending student accounts must complete email verification before status changes."
      );
      error.code = "STUDENT_STATUS_NOT_CHANGEABLE";
      throw error;
    }

    if (accountStatus === "Active" && !target.email_verified) {
      const error = new Error(
        "Student email must be verified before the account can be activated."
      );
      error.code = "STUDENT_STATUS_NOT_CHANGEABLE";
      throw error;
    }

    if (target.account_status === accountStatus) {
      await client.query("COMMIT");
      transactionStarted = false;
      return target;
    }

    const updatedResult = await client.query(`
      UPDATE users
      SET account_status = $1
      WHERE user_id = $2
        AND role = 'Student'
      RETURNING user_id, account_status;
    `, [accountStatus, studentId]);

    if (accountStatus === "Inactive") {
      await sessionModel.revokeAllUserSessions(studentId, client);
    }

    await client.query("COMMIT");
    transactionStarted = false;
    return updatedResult.rows[0] || null;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Student status transaction rollback failed.");
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

<<<<<<< Updated upstream
async function addStudentEnrollment(studentId, courseId, semesterId, db = pool) {
  const result = await db.query(`
    INSERT INTO enrollments (student_id, course_id, semester_id)
    SELECT $1, $2, $3
    WHERE EXISTS (
      SELECT 1 FROM users
      WHERE user_id = $1 AND role = 'Student'
    )
      AND EXISTS (SELECT 1 FROM courses WHERE course_id = $2)
      AND EXISTS (SELECT 1 FROM semesters WHERE semester_id = $3)
    ON CONFLICT (student_id, course_id, semester_id) DO NOTHING
    RETURNING enrollment_id, student_id, course_id, semester_id;
  `, [studentId, courseId, semesterId]);

  if (result.rows[0]) {
    return result.rows[0];
  }

  const student = await db.query(
    `SELECT user_id FROM users WHERE user_id = $1 AND role = 'Student';`,
    [studentId]
  );
  if (student.rowCount === 0) {
    const error = new Error("Student not found.");
    error.code = "STUDENT_NOT_FOUND";
    throw error;
  }

  const course = await db.query(
    "SELECT course_id FROM courses WHERE course_id = $1;",
    [courseId]
  );
  if (course.rowCount === 0) {
    const error = new Error("Course not found.");
    error.code = "COURSE_NOT_FOUND";
    throw error;
  }

  const semester = await db.query(
    "SELECT semester_id FROM semesters WHERE semester_id = $1;",
    [semesterId]
  );
  if (semester.rowCount === 0) {
    const error = new Error("Semester not found.");
    error.code = "SEMESTER_NOT_FOUND";
    throw error;
  }

  return null;
}

async function addInstructorCourseAssignment(
  instructorId,
  courseId,
  semesterId,
  db = pool
) {
  const result = await db.query(`
    INSERT INTO course_instructors (
      course_id,
      semester_id,
      instructor_id
    )
    SELECT $2, $3, $1
    WHERE EXISTS (
      SELECT 1 FROM users
      WHERE user_id = $1 AND role = 'Instructor'
    )
      AND EXISTS (SELECT 1 FROM courses WHERE course_id = $2)
      AND EXISTS (SELECT 1 FROM semesters WHERE semester_id = $3)
    ON CONFLICT (course_id, semester_id, instructor_id) DO NOTHING
    RETURNING course_instructor_id, instructor_id, course_id, semester_id;
  `, [instructorId, courseId, semesterId]);

  if (result.rows[0]) {
    return result.rows[0];
  }

  const instructor = await db.query(
    `SELECT user_id FROM users WHERE user_id = $1 AND role = 'Instructor';`,
    [instructorId]
  );
  if (instructor.rowCount === 0) {
    const error = new Error("Instructor not found.");
    error.code = "INSTRUCTOR_NOT_FOUND";
    throw error;
  }

  const course = await db.query(
    "SELECT course_id FROM courses WHERE course_id = $1;",
    [courseId]
  );
  if (course.rowCount === 0) {
    const error = new Error("Course not found.");
    error.code = "COURSE_NOT_FOUND";
    throw error;
  }

  const semester = await db.query(
    "SELECT semester_id FROM semesters WHERE semester_id = $1;",
    [semesterId]
  );
  if (semester.rowCount === 0) {
    const error = new Error("Semester not found.");
    error.code = "SEMESTER_NOT_FOUND";
    throw error;
  }

  return null;
}

async function validateBatchAssignmentTarget(
  client,
  accountId,
  role,
  courseIds,
  semesterId
) {
  const accountResult = await client.query(`
    SELECT user_id
    FROM users
    WHERE user_id = $1
      AND role = $2
    FOR UPDATE;
  `, [accountId, role]);

  if (accountResult.rowCount === 0) {
    const error = new Error(`${role} not found.`);
    error.code = role === "Student" ? "STUDENT_NOT_FOUND" : "INSTRUCTOR_NOT_FOUND";
    throw error;
  }

  const coursesResult = await client.query(`
    SELECT course_id
    FROM courses
    WHERE course_id = ANY($1::int[]);
  `, [courseIds]);

  if (coursesResult.rowCount !== courseIds.length) {
    const error = new Error("One or more selected courses were not found.");
    error.code = "COURSE_NOT_FOUND";
    throw error;
  }

  const semesterResult = await client.query(`
    SELECT semester_id
    FROM semesters
    WHERE semester_id = $1;
  `, [semesterId]);

  if (semesterResult.rowCount === 0) {
    const error = new Error("Semester not found.");
    error.code = "SEMESTER_NOT_FOUND";
    throw error;
  }
}

async function addStudentEnrollments(
  studentId,
  courseIds,
  semesterId,
  db = pool
) {
  const uniqueCourseIds = [...new Set(courseIds)];
  const client = await db.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    await validateBatchAssignmentTarget(
      client,
      studentId,
      "Student",
      uniqueCourseIds,
      semesterId
    );

    const result = await client.query(`
      INSERT INTO enrollments (student_id, course_id, semester_id)
      SELECT $1, selected.course_id, $3
      FROM UNNEST($2::int[]) AS selected(course_id)
      ON CONFLICT (student_id, course_id, semester_id) DO NOTHING
      RETURNING enrollment_id, student_id, course_id, semester_id;
    `, [studentId, uniqueCourseIds, semesterId]);

    const insertedCourseIds = new Set(
      result.rows.map((row) => Number(row.course_id))
    );
    const alreadyAssignedCourseIds = uniqueCourseIds.filter(
      (courseId) => !insertedCourseIds.has(courseId)
    );

    await client.query("COMMIT");
    transactionStarted = false;
    return {
      assignments: result.rows,
      alreadyAssignedCourseIds,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Student enrollment transaction rollback failed.", rollbackError);
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

async function addInstructorCourseAssignments(
  instructorId,
  courseIds,
  semesterId,
  db = pool
) {
  const uniqueCourseIds = [...new Set(courseIds)];
  const client = await db.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    await validateBatchAssignmentTarget(
      client,
      instructorId,
      "Instructor",
      uniqueCourseIds,
      semesterId
    );

    const result = await client.query(`
      INSERT INTO course_instructors (
        course_id,
        semester_id,
        instructor_id
      )
      SELECT selected.course_id, $3, $1
      FROM UNNEST($2::int[]) AS selected(course_id)
      ON CONFLICT (course_id, semester_id, instructor_id) DO NOTHING
      RETURNING course_instructor_id, instructor_id, course_id, semester_id;
    `, [instructorId, uniqueCourseIds, semesterId]);

    const insertedCourseIds = new Set(
      result.rows.map((row) => Number(row.course_id))
    );
    const alreadyAssignedCourseIds = uniqueCourseIds.filter(
      (courseId) => !insertedCourseIds.has(courseId)
    );

    await client.query("COMMIT");
    transactionStarted = false;
    return {
      assignments: result.rows,
      alreadyAssignedCourseIds,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Instructor assignment transaction rollback failed.", rollbackError);
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

async function removeStudentEnrollment(
  studentId,
  courseId,
  semesterId,
  db = pool
) {
  const result = await db.query(`
    DELETE FROM enrollments e
    USING users u
    WHERE e.student_id = u.user_id
      AND u.role = 'Student'
      AND e.student_id = $1
      AND e.course_id = $2
      AND e.semester_id = $3
    RETURNING e.enrollment_id;
  `, [studentId, courseId, semesterId]);

  return result.rowCount === 1;
}

=======
>>>>>>> Stashed changes
module.exports = {
  getStudents,
  getInstructors,
  getStudentById,
  updateStudentName,
  updateStudentAccountStatus,
<<<<<<< Updated upstream
  addStudentEnrollment,
  addStudentEnrollments,
  addInstructorCourseAssignment,
  addInstructorCourseAssignments,
  removeStudentEnrollment,
=======
>>>>>>> Stashed changes
};
