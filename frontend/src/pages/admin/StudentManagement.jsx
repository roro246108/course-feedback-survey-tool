
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MailPlus,
  RefreshCw,
  UserRound,
  UserRoundPen,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  assignInstructorCourses,
  assignStudentCourses,
  changeStudentStatus,
  getInstructors,
  getStudents,
  inviteUser,
  removeInstructorCourse,
  removeStudentCourse,
  updateStudentName,
} from "../../services/adminStudentService";
import { getCourses, getSemesters } from "../../services/surveyService";

function StudentManagement() {
  const { apiFetch } = useAuth();

  const [students, setStudents] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [accountType, setAccountType] = useState("Student");
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [coursesError, setCoursesError] = useState("");
  const [semestersError, setSemestersError] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");

  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    role: "Student",
    personalEmail: "",
    academicEmail: "",
  });

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editedName, setEditedName] = useState("");

  const fetchData = useCallback(async (signal) => {
    try {
      const getAccounts =
        accountType === "Student" ? getStudents : getInstructors;

      const accountRows = await getAccounts(apiFetch, { signal });

      if (signal?.aborted) return;

      if (accountType === "Student") {
        setStudents(accountRows);
      } else {
        setInstructors(accountRows);
      }
    } catch (requestError) {
      if (signal?.aborted) return;

      setError(
        requestError.message || "Unable to load account management data."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [apiFetch, accountType]);

  const loadData = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    await fetchData(signal);
  }, [fetchData]);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    fetchData(controller.signal);

    return () => controller.abort();
  }, [fetchData]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchCoursesAndSemesters() {
      setCoursesLoading(true);
      setSemestersLoading(true);

      try {
        const courseRows = await getCourses(
          { signal: controller.signal },
          apiFetch
        );
        if (!controller.signal.aborted) setCourses(courseRows);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setCoursesError(
            requestError.message || "Unable to load courses."
          );
        }
      } finally {
        if (!controller.signal.aborted) setCoursesLoading(false);
      }

      try {
        const semesterRows = await getSemesters(
          { signal: controller.signal },
          apiFetch
        );
        if (!controller.signal.aborted) setSemesters(semesterRows);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setSemestersError(
            requestError.message || "Unable to load semesters."
          );
        }
      } finally {
        if (!controller.signal.aborted) setSemestersLoading(false);
      }
    }

    fetchCoursesAndSemesters();

    return () => controller.abort();
  }, [apiFetch]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return students;

    return students.filter((student) =>
      [
        student.full_name,
        student.email,
        student.student_id,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      )
    );
  }, [search, students]);

  const filteredInstructors = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return instructors;

    return instructors.filter((instructor) =>
      [
        instructor.full_name,
        instructor.email,
        instructor.instructor_id,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      )
    );
  }, [instructors, search]);

  const filteredAccounts =
    accountType === "Student" ? filteredStudents : filteredInstructors;

  const totalAccounts =
    accountType === "Student" ? students.length : instructors.length;

  const accountTypeLower = accountType.toLowerCase();

  async function handleInvite(event) {
    event.preventDefault();

    setSaving(true);
    setNotice("");
    setError("");

    try {
      const result = await inviteUser(apiFetch, inviteForm);

      setNotice(result.message || `${inviteForm.role} invitation sent.`);

      setInviteForm({
        fullName: "",
        role: "Student",
        personalEmail: "",
        academicEmail: "",
      });
    } catch (requestError) {
      setError(
        requestError.message || "Unable to send the invitation."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleNameUpdate(event, studentId) {
    event.preventDefault();

    setSaving(true);
    setNotice("");
    setError("");

    try {
      await updateStudentName(apiFetch, studentId, editedName);

      setNotice("Student name updated.");
      setEditingId(null);

      await loadData();
    } catch (requestError) {
      setError(requestError.message || "Unable to update student.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(student) {
    const nextStatus =
      student.account_status === "Active" ? "Inactive" : "Active";

    const action =
      nextStatus === "Inactive" ? "deactivate" : "activate";

    const confirmation =
      nextStatus === "Inactive"
        ? `Deactivate ${student.full_name}? Their active sessions will be revoked.`
        : `Reactivate ${student.full_name}'s account?`;

    if (!window.confirm(confirmation)) return;

    setSaving(true);
    setNotice("");
    setError("");

    try {
      await changeStudentStatus(
        apiFetch,
        student.student_id,
        nextStatus
      );

      setNotice(`Student account ${action}d.`);

      await loadData();
    } catch (requestError) {
      setError(
        requestError.message || "Unable to update student account status."
      );
    } finally {
      setSaving(false);
    }
  }

  function toggleCourse(courseId) {
    const normalizedId = String(courseId);
    setSelectedCourseIds((currentIds) =>
      currentIds.includes(normalizedId)
        ? currentIds.filter((id) => id !== normalizedId)
        : [...currentIds, normalizedId]
    );
  }

  async function handleCourseAssignment(event) {
    event.preventDefault();

    if (!selectedAccountId) {
      setError(`Select a ${accountTypeLower} account.`);
      return;
    }

    if (selectedCourseIds.length === 0) {
      setError("Select at least one course.");
      return;
    }

    if (!selectedSemesterId) {
      setError("Select a semester.");
      return;
    }

    setSaving(true);
    setNotice("");
    setError("");

    try {
      const courseIds = selectedCourseIds.map(Number);
      const semesterId = Number(selectedSemesterId);

      const result =
        accountType === "Student"
          ? await assignStudentCourses(
              apiFetch,
              Number(selectedAccountId),
              courseIds,
              semesterId
            )
          : await assignInstructorCourses(
              apiFetch,
              Number(selectedAccountId),
              courseIds,
              semesterId
            );

      setNotice(result.message || "Course assignment saved.");
      setSelectedCourseIds([]);
      await loadData();
    } catch (requestError) {
      setError(
        requestError.message || "Unable to assign the selected courses."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCourseRemoval(account, course) {
    const accountId =
      accountType === "Student"
        ? account.student_id
        : account.instructor_id;
    const accountName = account.full_name;

    if (
      !window.confirm(
        `Remove ${course.course_code} - ${course.course_name} from ${accountName}?`
      )
    ) {
      return;
    }

    setSaving(true);
    setNotice("");
    setError("");

    try {
      if (accountType === "Student") {
        await removeStudentCourse(
          apiFetch,
          accountId,
          course.course_id,
          course.semester_id
        );
      } else {
        await removeInstructorCourse(
          apiFetch,
          accountId,
          course.course_id,
          course.semester_id
        );
      }

      setNotice("Course assignment removed.");
      await loadData();
    } catch (requestError) {
      setError(
        requestError.message || "Unable to remove the course assignment."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-7">
      {/* Page Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[2px] text-[#89977F]">
            Accounts & enrollment
          </p>

          <h1 className="mt-1 font-serif text-3xl font-bold text-[#2B5748]">
            User Management
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-[#647264]">
            Invite students and instructors and update student account names.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-[#A6B398]/50 bg-white px-4 py-2.5 text-sm font-semibold text-[#2B5748] disabled:opacity-60"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {/* Error and Success Messages */}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {notice}
        </p>
      )}

      {/* Invite User */}
      <section className="rounded-2xl border border-[#E5E8E3] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <MailPlus
            className="text-[#2B5748]"
            size={21}
            aria-hidden="true"
          />

          <div>
            <h2 className="font-serif text-xl font-bold text-[#2B5748]">
              Invite a user
            </h2>

            <p className="text-sm text-[#647264]">
              The invitation goes to the personal email. The{" "}
              {inviteForm.role.toLowerCase()} signs in with the academic email.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleInvite}
          className="grid gap-4 md:grid-cols-2"
        >
          <label className="text-sm font-medium text-[#526456]">
            Full name

            <input
              required
              minLength={2}
              maxLength={150}
              autoComplete="name"
              value={inviteForm.fullName}
              onChange={(event) =>
                setInviteForm({
                  ...inviteForm,
                  fullName: event.target.value,
                })
              }
              className="mt-1.5 w-full rounded-xl border border-[#D8DED3] px-3 py-2.5 outline-none focus:border-[#2B5748]"
            />
          </label>

          <label className="text-sm font-medium text-[#526456]">
            Account Type

            <select
              required
              value={inviteForm.role}
              onChange={(event) =>
                setInviteForm({
                  ...inviteForm,
                  role: event.target.value,
                })
              }
              className="mt-1.5 w-full rounded-xl border border-[#D8DED3] bg-white px-3 py-2.5"
            >
              <option value="Student">Student</option>
              <option value="Instructor">Instructor</option>
            </select>
          </label>

          <label className="text-sm font-medium text-[#526456]">
            Personal email (invitation delivery)

            <input
              required
              type="email"
              maxLength={255}
              autoComplete="email"
              value={inviteForm.personalEmail}
              onChange={(event) =>
                setInviteForm({
                  ...inviteForm,
                  personalEmail: event.target.value,
                })
              }
              className="mt-1.5 w-full rounded-xl border border-[#D8DED3] px-3 py-2.5 outline-none focus:border-[#2B5748]"
            />
          </label>

          <label className="text-sm font-medium text-[#526456]">
            Academic email (login)

            <input
              required
              type="email"
              maxLength={255}
              autoComplete="email"
              value={inviteForm.academicEmail}
              onChange={(event) =>
                setInviteForm({
                  ...inviteForm,
                  academicEmail: event.target.value,
                })
              }
              className="mt-1.5 w-full rounded-xl border border-[#D8DED3] px-3 py-2.5 outline-none focus:border-[#2B5748]"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="justify-self-start self-end rounded-xl bg-[#2B5748] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Send invitation
          </button>
        </form>
      </section>

      {/* Assign Courses */}
      <section className="rounded-2xl border border-[#E5E8E3] bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="font-serif text-xl font-bold text-[#2B5748]">
            Assign courses
          </h2>
          <p className="mt-1 text-sm text-[#647264]">
            Assign one or more courses and a semester to a student or instructor.
          </p>
        </div>

        <form
          onSubmit={handleCourseAssignment}
          className="grid gap-4 lg:grid-cols-3"
        >
          <label className="text-sm font-medium text-[#526456]">
            Account

            <select
              required
              value={selectedAccountId}
              onChange={(event) =>
                setSelectedAccountId(event.target.value)
              }
              disabled={loading}
              className="mt-1.5 w-full rounded-xl border border-[#D8DED3] bg-white px-3 py-2.5"
            >
              <option value="">
                Select a {accountTypeLower}
              </option>
              {(accountType === "Student" ? students : instructors).map(
                (account) => {
                  const accountId =
                    accountType === "Student"
                      ? account.student_id
                      : account.instructor_id;

                  return (
                    <option key={accountId} value={String(accountId)}>
                      {account.full_name} (ID: {accountId})
                    </option>
                  );
                }
              )}
            </select>
          </label>

          <div className="text-sm font-medium text-[#526456]">
            Courses

            <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl border border-[#D8DED3] bg-white p-2">
              {coursesLoading ? (
                <p className="px-2 py-2 text-sm font-normal text-[#647264]">
                  Loading courses...
                </p>
              ) : coursesError ? (
                <p className="px-2 py-2 text-sm font-normal text-red-700">
                  {coursesError}
                </p>
              ) : courses.length === 0 ? (
                <p className="px-2 py-2 text-sm font-normal text-[#647264]">
                  No courses available.
                </p>
              ) : (
                courses.map((course) => {
                  const courseId = String(course.course_id);
                  return (
                    <label
                      key={course.course_id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 font-normal hover:bg-[#F4F6F1]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.includes(courseId)}
                        onChange={() => toggleCourse(courseId)}
                        className="h-4 w-4 accent-[#2B5748]"
                      />
                      <span>
                        {course.course_code} - {course.course_name}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

          </div>

          <label className="text-sm font-medium text-[#526456]">
            Semester

            <select
              required
              value={selectedSemesterId}
              onChange={(event) =>
                setSelectedSemesterId(event.target.value)
              }
              disabled={semestersLoading}
              className="mt-1.5 w-full rounded-xl border border-[#D8DED3] bg-white px-3 py-2.5"
            >
              <option value="">
                {semestersLoading
                  ? "Loading semesters..."
                  : "Select a semester"}
              </option>
              {semesters.map((semester) => (
                <option
                  key={semester.semester_id}
                  value={String(semester.semester_id)}
                >
                  {semester.semester_name} - {semester.academic_year}
                </option>
              ))}
            </select>

            {semestersError && (
              <p className="mt-2 text-sm font-normal text-red-700">
                {semestersError}
              </p>
            )}
          </label>

          <button
            type="submit"
            disabled={saving || coursesLoading || semestersLoading}
            className="justify-self-start rounded-xl bg-[#2B5748] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Assign courses
          </button>
        </form>
      </section>

      {/* Accounts List */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#2B5748]">
              {accountType === "Student" ? "Students" : "Instructors"}
            </h2>

            <p className="mt-1 text-sm text-[#647264]">
              {totalAccounts} registered {accountTypeLower}
              {totalAccounts === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm text-[#526456]">
              Account type

              <select
                value={accountType}
                onChange={(event) => {
                  setAccountType(event.target.value);
                  setSelectedAccountId("");
                }}
                className="ml-2 rounded-lg border border-[#D8DED3] bg-white px-3 py-2"
              >
                <option value="Student">Student</option>
                <option value="Instructor">Instructor</option>
              </select>
            </label>

            <label className="text-sm text-[#526456]">
              Search

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, academic email, or ID"
                className="ml-2 rounded-lg border border-[#D8DED3] px-3 py-2 outline-none focus:border-[#2B5748]"
              />
            </label>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div
            role="status"
            className="rounded-2xl bg-white p-8 text-center text-sm text-[#647264]"
          >
            Loading {accountTypeLower}...
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredAccounts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#C8D2C3] bg-white px-6 py-10 text-center text-sm text-[#647264]">
            {totalAccounts
              ? `No ${accountTypeLower} accounts match your search.`
              : `No ${accountTypeLower} accounts have been created yet.`}
          </div>
        )}

        {/* Students */}
        {!loading &&
          accountType === "Student" &&
          filteredStudents.map((student) => (
            <article
              key={student.student_id}
              className="rounded-2xl border border-[#E5E8E3] bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E9EDE4] text-[#2B5748]">
                    <UserRound size={20} aria-hidden="true" />
                  </span>

                  <div>
                    <h3 className="font-semibold text-[#2B5748]">
                      {student.full_name}
                    </h3>

                    <p className="mt-0.5 text-sm text-[#647264]">
                      Academic email (login): {student.email}
                    </p>

                    <p className="mt-1 text-xs text-[#89977F]">
                      Student ID: {student.student_id} ·{" "}
                      {student.account_status}
                      {student.email_verified
                        ? " · Verified"
                        : " · Not verified"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {student.account_status === "Pending" ? (
                    <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      Awaiting email verification
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleStatusChange(student)}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                        student.account_status === "Active"
                          ? "border border-red-200 text-red-700"
                          : "bg-[#2B5748] text-white"
                      }`}
                    >
                      {student.account_status === "Active"
                        ? "Deactivate"
                        : "Activate"}
                    </button>
                  )}

                  {editingId === student.student_id ? (
                    <form
                      onSubmit={(event) =>
                        handleNameUpdate(event, student.student_id)
                      }
                      className="flex flex-wrap gap-2"
                    >
                      <input
                        aria-label="Student full name"
                        required
                        minLength={2}
                        maxLength={150}
                        value={editedName}
                        onChange={(event) =>
                          setEditedName(event.target.value)
                        }
                        className="rounded-lg border border-[#D8DED3] px-3 py-2 text-sm"
                      />

                      <button
                        disabled={saving}
                        className="rounded-lg bg-[#2B5748] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-[#D8DED3] px-3 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(student.student_id);
                        setEditedName(student.full_name);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#D8DED3] px-3 py-2 text-sm font-medium text-[#2B5748]"
                    >
                      <UserRoundPen size={16} aria-hidden="true" />
                      Edit name
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-[#EDF0EA] pt-4">
                <h4 className="text-sm font-semibold text-[#2B5748]">
                  Course assignments
                </h4>

                {student.courses?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {student.courses.map((course) => (
                      <span
                        key={`${course.course_id}-${course.semester_id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#D8DED3] bg-[#F8FAF6] px-3 py-2 text-xs text-[#526456]"
                      >
                        <span>
                          <strong>{course.course_code}</strong>
                          {" - "}
                          {course.course_name}
                          <span className="block text-[#89977F]">
                            {course.semester_name} {course.academic_year}
                          </span>
                        </span>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            handleCourseRemoval(student, course)
                          }
                          className="font-bold text-red-700 disabled:opacity-60"
                          aria-label={`Remove ${course.course_name}`}
                        >
                          Remove
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[#89977F]">
                    No course assignments.
                  </p>
                )}
              </div>
            </article>
          ))}

        {/* Instructors */}
        {!loading &&
          accountType === "Instructor" &&
          filteredInstructors.map((instructor) => (
            <article
              key={instructor.instructor_id}
              className="rounded-2xl border border-[#E5E8E3] bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E9EDE4] text-[#2B5748]">
                  <UserRound size={20} aria-hidden="true" />
                </span>

                <div>
                  <h3 className="font-semibold text-[#2B5748]">
                    {instructor.full_name}
                  </h3>

                  <p className="mt-0.5 text-sm text-[#647264]">
                    Academic email (login): {instructor.email}
                  </p>

                  <p className="mt-1 text-xs text-[#89977F]">
                    Instructor ID: {instructor.instructor_id}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-[#EDF0EA] pt-4">
                <h4 className="text-sm font-semibold text-[#2B5748]">
                  Course assignments
                </h4>

                {instructor.courses?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {instructor.courses.map((course) => (
                      <span
                        key={`${course.course_id}-${course.semester_id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#D8DED3] bg-[#F8FAF6] px-3 py-2 text-xs text-[#526456]"
                      >
                        <span>
                          <strong>{course.course_code}</strong>
                          {" - "}
                          {course.course_name}
                          <span className="block text-[#89977F]">
                            {course.semester_name} {course.academic_year}
                          </span>
                        </span>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            handleCourseRemoval(instructor, course)
                          }
                          className="font-bold text-red-700 disabled:opacity-60"
                          aria-label={`Remove ${course.course_name}`}
                        >
                          Remove
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[#89977F]">
                    No course assignments.
                  </p>
                )}
              </div>
            </article>
          ))}
      </section>
    </div>
  );
}

export default StudentManagement;
