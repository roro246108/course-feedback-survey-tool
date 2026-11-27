
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  createSurvey,
  getCourses,
  getInstructorsByCourseAndSemester,
  getSemesters
} from '../../services/surveyService';

function CreateSurvey() {
  const { apiFetch } = useAuth();

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    course: '',
    semester: '',
    instructor: '',
    status: '',
    description: '',
    openingDate: '',
    closingDate: ''
  });

  // Validation Errors
  const [errors, setErrors] = useState({});
  const [questions, setQuestions] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Courses State
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState('');

  // Semesters State
  const [semesters, setSemesters] = useState([]);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [semestersError, setSemestersError] = useState('');

  // Instructors State
  const [instructors, setInstructors] = useState([]);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [instructorsError, setInstructorsError] = useState('');

  // Fetch Courses
  useEffect(() => {
    const controller = new AbortController();

    const fetchCourses = async () => {
      try {
        const result = await getCourses({ signal: controller.signal }, apiFetch);
        setCourses(result);

      } catch (error) {
        if (error.name !== 'AbortError') {
          setCoursesError(error.message || 'Unable to load courses.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setCoursesLoading(false);
        }
      }
    };

    fetchCourses();

    return () => controller.abort();
  }, [apiFetch]);

  // Fetch Semesters
  useEffect(() => {
    const controller = new AbortController();

    const fetchSemesters = async () => {
      try {
        const result = await getSemesters({ signal: controller.signal }, apiFetch);
        setSemesters(result);

      } catch (error) {
        if (error.name !== 'AbortError') {
          setSemestersError(error.message || 'Unable to load semesters.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setSemestersLoading(false);
        }
      }
    };

    fetchSemesters();

    return () => controller.abort();
  }, [apiFetch]);

  // Fetch Instructors Based on Selected Course and Semester
  useEffect(() => {

    // Both selections are required before fetching instructors
    if (!formData.course || !formData.semester) {
      return;
    }

    const controller = new AbortController();

    const fetchInstructors = async () => {
      try {
        const result = await getInstructorsByCourseAndSemester(
          formData.course,
          formData.semester,
          { signal: controller.signal },
          apiFetch
        );
        setInstructors(result);

      } catch (error) {
        if (error.name !== 'AbortError') {
          setInstructorsError(error.message || 'Unable to load instructors.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setInstructorsLoading(false);
        }
      }
    };

    fetchInstructors();

    return () => {
      controller.abort();
    };

  }, [apiFetch, formData.course, formData.semester]);

  // Handle Input Changes
  const handleChange = (event) => {
    const { name, value } = event.target;
    const course = name === 'course' ? value : formData.course;
    const semester = name === 'semester' ? value : formData.semester;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,

      // Reset instructor when course or semester changes
      ...(name === 'course' || name === 'semester'
        ? { instructor: '' }
        : {})
    }));

    setErrors((previousErrors) => ({
      ...previousErrors,
      [name]: '',
      ...(name === 'course' || name === 'semester'
        ? { instructor: '' }
        : {})
    }));
    setSubmitError('');
    setSubmitSuccess('');

    if (name === 'course' || name === 'semester') {
      setInstructors([]);
      setInstructorsError('');
      setInstructorsLoading(Boolean(course && semester));
    }
  };

  const handleQuestionChange = (index, field, value) => {
    setQuestions((previousQuestions) =>
      previousQuestions.map((question, questionIndex) =>
        questionIndex === index
          ? { ...question, [field]: value }
          : question
      )
    );
    setErrors((previousErrors) => ({
      ...previousErrors,
      questions: undefined,
      status: ''
    }));
    setSubmitError('');
    setSubmitSuccess('');
  };

  const handleAddQuestion = () => {
    setQuestions((previousQuestions) => [
      ...previousQuestions,
      {
        question_text: '',
        question_type: 'Text',
        is_required: true
      }
    ]);
    setErrors((previousErrors) => ({
      ...previousErrors,
      questions: undefined,
      status: ''
    }));
    setSubmitError('');
    setSubmitSuccess('');
  };

  const handleRemoveQuestion = (index) => {
    setQuestions((previousQuestions) =>
      previousQuestions.filter((_, questionIndex) => questionIndex !== index)
    );
    setErrors((previousErrors) => ({
      ...previousErrors,
      questions: undefined,
      status: ''
    }));
    setSubmitError('');
    setSubmitSuccess('');
  };

  // Get Today's Date
  const getToday = () => {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  // Validate Survey Form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Survey title is required.';
    } else if (formData.title.trim().length > 200) {
      newErrors.title = 'Survey title cannot exceed 200 characters.';
    }

    if (!formData.course) {
      newErrors.course = 'Please select a course.';
    }

    if (!formData.semester) {
      newErrors.semester = 'Please select a semester.';
    }

    if (!formData.instructor) {
      newErrors.instructor = 'Please select an instructor.';
    }

    if (!formData.status) {
      newErrors.status = 'Please select a survey status.';
    } else if (formData.status === 'Published' && questions.length === 0) {
      newErrors.status =
        'Add at least one question before publishing this survey.';
    }

    const questionErrors = questions.map((question) =>
      question.question_text.trim() ? '' : 'Question text is required.'
    );

    if (questionErrors.some(Boolean)) {
      newErrors.questions = questionErrors;
    }

    if (!formData.openingDate) {
      newErrors.openingDate = 'Opening date is required.';
    } else if (formData.openingDate < getToday()) {
      newErrors.openingDate =
        'Opening date cannot be in the past.';
    }

    if (!formData.closingDate) {
      newErrors.closingDate = 'Closing date is required.';
    } else if (
      formData.openingDate &&
      formData.closingDate <= formData.openingDate
    ) {
      newErrors.closingDate =
        'Closing date must be after the opening date.';
    } else if (formData.closingDate < getToday()) {
      newErrors.closingDate =
        'Closing date cannot be in the past.';
    }

    if (formData.description.length > 500) {
      newErrors.description =
        'Description cannot exceed 500 characters.';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // Handle Create Survey
  const handleCreateSurvey = async () => {
    const isValid = validateForm();

    if (!isValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');

    try {
      const createdSurvey = await createSurvey({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        course_id: Number(formData.course),
        semester_id: Number(formData.semester),
        instructor_id: Number(formData.instructor),
        status: formData.status,
        opening_date: formData.openingDate,
        closing_date: formData.closingDate,
        questions: questions.map((question) => ({
          ...question,
          question_text: question.question_text.trim()
        }))
      }, apiFetch);

      setSubmitSuccess(
        `Survey created successfully${createdSurvey?.survey_id
          ? ` (ID: ${createdSurvey.survey_id})`
          : ''}.`
      );
      setFormData({
        title: '',
        course: '',
        semester: '',
        instructor: '',
        status: '',
        description: '',
        openingDate: '',
        closingDate: ''
      });
      setErrors({});
      setQuestions([]);
      setInstructors([]);
      setInstructorsError('');
      setInstructorsLoading(false);
    } catch (error) {
      setSubmitError(error.message || 'Unable to create the survey.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset Form
  const handleCancel = () => {
    setFormData({
      title: '',
      course: '',
      semester: '',
      instructor: '',
      status: '',
      description: '',
      openingDate: '',
      closingDate: ''
    });

    setErrors({});
    setSubmitError('');
    setSubmitSuccess('');
    setQuestions([]);
    setInstructors([]);
    setInstructorsError('');
    setInstructorsLoading(false);
  };

  // Selected Course
  const selectedCourse = courses.find(
    (course) => String(course.course_id) === formData.course
  );

  // Selected Semester
  const selectedSemester = semesters.find(
    (semester) =>
      String(semester.semester_id) === formData.semester
  );

  // Selected Instructor
  const selectedInstructor = instructors.find(
    (instructor) =>
      String(instructor.instructor_id) === formData.instructor
  );

  return (
    <div className="space-y-6">
      {submitSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-4 right-4 top-4 z-[100] flex items-center gap-3 rounded-xl border border-[#C9D4CC] bg-white px-4 py-3 text-sm text-[#2B5748] shadow-lg sm:left-auto sm:right-6 sm:top-6 sm:max-w-sm"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#2B5748]" />
          <p className="flex-1">{submitSuccess}</p>
          <button
            type="button"
            onClick={() => setSubmitSuccess('')}
            aria-label="Dismiss success message"
            className="rounded p-1 text-[#66736A] transition hover:bg-[#F1F5F1] hover:text-[#2B5748]"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#263D32]">
          Create Survey
        </h1>

        <p className="mt-2 text-sm text-[#899187]">
          Design a new course feedback survey for a specific course.
        </p>
      </div>

      {/* Page Content */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        {/* Survey Form */}
        <div className="space-y-6 xl:col-span-2">

          {/* Survey Information */}
          <section className="rounded-2xl border border-[#E5E8E3] bg-white p-6 shadow-sm">

            <h2 className="mb-6 rounded-lg bg-[#E1E9E0] px-4 py-3 font-semibold text-[#2B5748]">
              Survey Information
            </h2>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

              {/* Survey Title */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                  Survey Title <span className="text-red-500">*</span>
                </label>

                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  maxLength={200}
                  placeholder="Enter survey title"
                  className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2B5748] focus:ring-2 focus:ring-[#2B5748]/10"
                />

                {errors.title && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.title}
                  </p>
                )}
              </div>

              {/* Course */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                  Course <span className="text-red-500">*</span>
                </label>

                <select
                  name="course"
                  value={formData.course}
                  onChange={handleChange}
                  disabled={coursesLoading || !!coursesError}
                  className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm text-[#35483D] outline-none transition focus:border-[#2B5748] focus:ring-2 focus:ring-[#2B5748]/10 disabled:bg-gray-100"
                >
                  <option value="">
                    {coursesLoading
                      ? 'Loading courses...'
                      : coursesError
                        ? 'Unable to load courses'
                        : 'Select a course'}
                  </option>

                  {courses.map((course) => (
                    <option
                      key={course.course_id}
                      value={String(course.course_id)}
                    >
                      {course.course_code} - {course.course_name}
                    </option>
                  ))}
                </select>

                {coursesError && (
                  <p className="mt-1 text-sm text-red-500">
                    {coursesError}
                  </p>
                )}

                {!coursesLoading &&
                  !coursesError &&
                  courses.length === 0 && (
                    <p className="mt-1 text-sm text-gray-500">
                      No courses available.
                    </p>
                  )}

                {errors.course && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.course}
                  </p>
                )}
              </div>

              {/* Semester */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                  Semester <span className="text-red-500">*</span>
                </label>

                <select
                  name="semester"
                  value={formData.semester}
                  onChange={handleChange}
                  disabled={semestersLoading || !!semestersError}
                  className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm text-[#35483D] outline-none transition focus:border-[#2B5748] focus:ring-2 focus:ring-[#2B5748]/10 disabled:bg-gray-100"
                >
                  <option value="">
                    {semestersLoading
                      ? 'Loading semesters...'
                      : semestersError
                        ? 'Unable to load semesters'
                        : 'Select a semester'}
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
                  <p className="mt-1 text-sm text-red-500">
                    {semestersError}
                  </p>
                )}

                {errors.semester && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.semester}
                  </p>
                )}
              </div>

              {/* Instructor */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                  Instructor <span className="text-red-500">*</span>
                </label>

                <select
                  name="instructor"
                  value={formData.instructor}
                  onChange={handleChange}
                  disabled={
                    !formData.course ||
                    !formData.semester ||
                    instructorsLoading ||
                    !!instructorsError
                  }
                  className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm text-[#35483D] outline-none transition focus:border-[#2B5748] focus:ring-2 focus:ring-[#2B5748]/10 disabled:bg-gray-100"
                >
                  <option value="">
                    {!formData.course || !formData.semester
                      ? 'Select course and semester first'
                      : instructorsLoading
                        ? 'Loading instructors...'
                        : instructorsError
                          ? 'Unable to load instructors'
                          : instructors.length === 0
                            ? 'No instructors available'
                            : 'Select an instructor'}
                  </option>

                  {instructors.map((instructor) => (
                    <option
                      key={instructor.instructor_id}
                      value={String(instructor.instructor_id)}
                    >
                      {instructor.instructor_name}
                    </option>
                  ))}
                </select>

                {instructorsError && (
                  <p className="mt-1 text-sm text-red-500">
                    {instructorsError}
                  </p>
                )}

                {errors.instructor && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.instructor}
                  </p>
                )}
              </div>

              {/* Survey Status */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                  Survey Status <span className="text-red-500">*</span>
                </label>

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm text-[#35483D] outline-none transition focus:border-[#2B5748] focus:ring-2 focus:ring-[#2B5748]/10"
                >
                  <option value="">
                    Select survey status
                  </option>

                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                </select>

                {errors.status && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.status}
                  </p>
                )}
              </div>

            </div>
          </section>

          {/* Survey Questions */}
          <section className="rounded-2xl border border-[#E5E8E3] bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="rounded-lg bg-[#E1E9E0] px-4 py-3 font-semibold text-[#2B5748]">
                  Survey Questions
                </h2>
                <p className="mt-2 text-sm text-[#899187]">
                  Add written-response or rating questions to your survey.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddQuestion}
                className="rounded-lg border border-[#2B5748] px-4 py-2 text-sm font-semibold text-[#2B5748] transition hover:bg-[#F1F5F1]"
              >
                + Add Question
              </button>
            </div>

            {questions.length === 0 && (
              <p className="rounded-lg bg-[#F4F7F6] px-4 py-3 text-sm text-[#66736A]">
                Drafts can be saved without questions. Add at least one question
                if you want to publish this survey.
              </p>
            )}

            <div className="space-y-4">
              {questions.map((question, index) => (
                <div
                  key={index}
                  className="space-y-4 rounded-xl border border-[#E5E8E3] p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[#35483D]">
                      Question {index + 1}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(index)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                      aria-label={`Remove question ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                      Question text <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={question.question_text}
                      onChange={(event) =>
                        handleQuestionChange(
                          index,
                          'question_text',
                          event.target.value
                        )
                      }
                      rows={3}
                      placeholder="Write the question students will answer"
                      className="w-full resize-y rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2B5748] focus:ring-2 focus:ring-[#2B5748]/10"
                    />
                    {errors.questions?.[index] && (
                      <p className="mt-1 text-sm text-red-500">
                        {errors.questions[index]}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                        Response type
                      </label>
                      <select
                        value={question.question_type}
                        onChange={(event) =>
                          handleQuestionChange(
                            index,
                            'question_type',
                            event.target.value
                          )
                        }
                        className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm text-[#35483D] outline-none transition focus:border-[#2B5748] focus:ring-2 focus:ring-[#2B5748]/10"
                      >
                        <option value="Text">Written response</option>
                        <option value="Rating">Rating</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-3 text-sm font-medium text-[#35483D] sm:pt-8">
                      <input
                        type="checkbox"
                        checked={question.is_required}
                        onChange={(event) =>
                          handleQuestionChange(
                            index,
                            'is_required',
                            event.target.checked
                          )
                        }
                        className="h-4 w-4 accent-[#2B5748]"
                      />
                      Required question
                    </label>
                  </div>
                </div>
              ))}
            </div>

          </section>

          {/* Survey Details */}
          <section className="rounded-2xl border border-[#E5E8E3] bg-white p-6 shadow-sm">

            <h2 className="mb-6 rounded-lg bg-[#E1E9E0] px-4 py-3 font-semibold text-[#2B5748]">
              Survey Details
            </h2>

            <div className="space-y-5">

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                  Description
                </label>

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  maxLength={500}
                  placeholder="Enter a brief description for the survey (optional)"
                  className="w-full resize-y rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2B5748] focus:ring-2 focus:ring-[#2B5748]/10"
                />

                {errors.description && (
                  <p className="mt-1 text-sm text-red-500">
                    {errors.description}
                  </p>
                )}

                <p className="mt-1 text-right text-xs text-[#899187]">
                  {formData.description.length}/500 characters
                </p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                {/* Opening Date */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                    Opening Date <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="date"
                    name="openingDate"
                    value={formData.openingDate}
                    onChange={handleChange}
                    min={getToday()}
                    className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2B5748] focus:ring-2 focus:ring-[#2B5748]/10"
                  />

                  {errors.openingDate && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.openingDate}
                    </p>
                  )}
                </div>

                {/* Closing Date */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                    Closing Date <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="date"
                    name="closingDate"
                    value={formData.closingDate}
                    onChange={handleChange}
                    min={formData.openingDate || getToday()}
                    className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2B5748] focus:ring-2 focus:ring-[#2B5748]/10"
                  />

                  {errors.closingDate && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.closingDate}
                    </p>
                  )}
                </div>

              </div>
            </div>
          </section>

        </div>

        {/* Survey Preview */}
        <aside className="h-fit rounded-2xl border border-[#E5E8E3] bg-white p-6 shadow-sm">

          <h2 className="text-lg font-semibold text-[#2B5748]">
            Survey Preview
          </h2>

          <p className="mt-2 text-sm text-[#899187]">
            A quick preview of the survey details.
          </p>

          <div className="mt-6 space-y-4">

            {/* Title */}
            <div className="border-b border-[#E5E8E3] pb-4">
              <p className="text-sm font-semibold text-[#35483D]">
                Title
              </p>

              <p className="mt-1 text-sm text-[#899187]">
                {formData.title || '—'}
              </p>
            </div>

            {/* Course */}
            <div className="border-b border-[#E5E8E3] pb-4">
              <p className="text-sm font-semibold text-[#35483D]">
                Course
              </p>

              <p className="mt-1 text-sm text-[#899187]">
                {selectedCourse
                  ? selectedCourse.course_name
                  : '—'}
              </p>
            </div>

            {/* Semester */}
            <div className="border-b border-[#E5E8E3] pb-4">
              <p className="text-sm font-semibold text-[#35483D]">
                Semester
              </p>

              <p className="mt-1 text-sm text-[#899187]">
                {selectedSemester
                  ? `${selectedSemester.semester_name} ${selectedSemester.academic_year}`
                  : '—'}
              </p>
            </div>

            {/* Instructor */}
            <div className="border-b border-[#E5E8E3] pb-4">
              <p className="text-sm font-semibold text-[#35483D]">
                Instructor
              </p>

              <p className="mt-1 text-sm text-[#899187]">
                {selectedInstructor
                  ? selectedInstructor.instructor_name
                  : '—'}
              </p>
            </div>

            {/* Status */}
            <div className="border-b border-[#E5E8E3] pb-4">
              <p className="text-sm font-semibold text-[#35483D]">
                Status
              </p>

              <span className="mt-2 inline-block rounded-full bg-[#F3E7CF] px-4 py-1 text-xs font-semibold text-[#88703D]">
                {formData.status || 'Not selected'}
              </span>
            </div>

            {/* Description */}
            <div className="border-b border-[#E5E8E3] pb-4">
              <p className="text-sm font-semibold text-[#35483D]">
                Description
              </p>

              <p className="mt-1 break-words text-sm text-[#899187]">
                {formData.description || '—'}
              </p>
            </div>

            {/* Opening Date */}
            <div>
              <p className="text-sm font-semibold text-[#35483D]">
                Opening Date
              </p>

              <p className="mt-1 text-sm text-[#899187]">
                {formData.openingDate || '—'}
              </p>
            </div>

            {/* Closing Date */}
            <div>
              <p className="text-sm font-semibold text-[#35483D]">
                Closing Date
              </p>

              <p className="mt-1 text-sm text-[#899187]">
                {formData.closingDate || '—'}
              </p>
            </div>

          </div>
        </aside>

      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pb-4">

        {submitError && (
          <p role="alert" className="mr-auto self-center text-sm text-red-600">
            {submitError}
          </p>
        )}

        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="rounded-lg border border-[#C9D4CC] bg-white px-7 py-3 text-sm font-semibold text-[#2B5748] transition hover:bg-[#F1F5F1]"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleCreateSurvey}
          disabled={isSubmitting}
          className="rounded-lg bg-[#2B5748] px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#214638] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Saving...' : '+ Create Survey'}
        </button>

      </div>

    </div>
  );
}

export default CreateSurvey;
