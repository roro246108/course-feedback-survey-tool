const API_BASE_URL = `${
  import.meta.env.VITE_API_URL || "http://localhost:5000"
}`.replace(/\/+$/, "") + "/api";

async function readResponse(response, fallbackMessage) {
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    const error = new Error(result?.message || fallbackMessage);
    error.status = response.status;
    throw error;
  }

  return result;
}

export async function getStudents(apiFetch, options = {}) {
  const response = await apiFetch(`${API_BASE_URL}/admin/students`, options);
  const result = await readResponse(response, "Unable to load students.");
  if (!Array.isArray(result.data)) {
    throw new Error("Invalid student data received from the server.");
  }
  return result.data;
}

export async function getInstructors(apiFetch, options = {}) {
  const response = await apiFetch(`${API_BASE_URL}/admin/instructors`, options);
  const result = await readResponse(response, "Unable to load instructors.");
  if (!Array.isArray(result.data)) {
    throw new Error("Invalid instructor data received from the server.");
  }
  return result.data;
}

export async function inviteUser(apiFetch, invitation) {
  const response = await apiFetch(`${API_BASE_URL}/auth/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invitation),
  });
  return readResponse(response, "Unable to send the invitation.");
}

export async function changeStudentStatus(apiFetch, studentId, accountStatus) {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/students/${encodeURIComponent(studentId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountStatus }),
    }
  );
  return readResponse(response, "Unable to update the student account status.");
}

export async function updateStudentName(apiFetch, studentId, fullName) {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/students/${encodeURIComponent(studentId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName }),
    }
  );
  return readResponse(response, "Unable to update the student.");
}

export async function assignStudentCourses(
  apiFetch,
  studentId,
  courseIds,
  semesterId
) {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/students/${encodeURIComponent(studentId)}/enrollments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseIds, semesterId }),
    }
  );
  return readResponse(response, "Unable to assign the course.");
}

export async function assignStudentCourse(
  apiFetch,
  studentId,
  courseId,
  semesterId
) {
  return assignStudentCourses(apiFetch, studentId, [courseId], semesterId);
}

export async function assignInstructorCourses(
  apiFetch,
  instructorId,
  courseIds,
  semesterId
) {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/instructors/${encodeURIComponent(instructorId)}/course-assignments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseIds, semesterId }),
    }
  );
  return readResponse(response, "Unable to assign the course.");
}

export async function assignInstructorCourse(
  apiFetch,
  instructorId,
  courseId,
  semesterId
) {
  return assignInstructorCourses(apiFetch, instructorId, [courseId], semesterId);
}

export async function removeStudentCourse(
  apiFetch,
  studentId,
  courseId,
  semesterId
) {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/students/${encodeURIComponent(studentId)}/enrollments/${encodeURIComponent(courseId)}/${encodeURIComponent(semesterId)}`,
    { method: "DELETE" }
  );
  return readResponse(response, "Unable to remove the course assignment.");
}

export async function removeInstructorCourse(
  apiFetch,
  instructorId,
  courseId,
  semesterId
) {
  const response = await apiFetch(
    `${API_BASE_URL}/admin/instructors/${encodeURIComponent(instructorId)}/course-assignments/${encodeURIComponent(courseId)}/${encodeURIComponent(semesterId)}`,
    { method: "DELETE" }
  );
  return readResponse(response, "Unable to remove the course assignment.");
}
