
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, X } from 'lucide-react';

import {
  getSurveyById,
  getCourses,
  getSemesters,
  getInstructorsByCourseAndSemester,
  updateSurvey
} from '../../services/surveyService';

// Convert API date values to YYYY-MM-DD for date inputs.
const getDateValue = (value) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

function EditSurvey() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    course: '',
    semester: '',
    instructor: '',
    status: 'Draft',
    description: '',
    openingDate: '',
    closingDate: ''
  });

  const [questions, setQuestions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [instructors, setInstructors] = useState([]);

  const [initialStatus, setInitialStatus] = useState('Draft');
  const [hasResponses, setHasResponses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errors, setErrors] = useState({});
  const [pageError, setPageError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // ============================================
  // LOAD SURVEY, COURSES AND SEMESTERS
  // ============================================

  useEffect(() => {
    const controller = new AbortController();

    const loadSurvey = async () => {
      try {
        setLoading(true);
        setPageError('');

        const [survey, coursesData, semestersData] = await Promise.all([
          getSurveyById(id, { signal: controller.signal }),
          getCourses({ signal: controller.signal }),
          getSemesters({ signal: controller.signal })
        ]);

        if (controller.signal.aborted) return;

        if (!survey) {
          throw new Error('Survey was not found.');
        }

        const courseId = String(survey.course_id ?? '');
        const semesterId = String(survey.semester_id ?? '');
        const instructorId = String(survey.instructor_id ?? '');

        setCourses(Array.isArray(coursesData) ? coursesData : []);
        setSemesters(Array.isArray(semestersData) ? semestersData : []);

        setFormData({
          title: survey.title || '',
          course: courseId,
          semester: semesterId,
          instructor: instructorId,
          status: survey.status || 'Draft',
          description: survey.description || '',
          openingDate: getDateValue(survey.opening_date),
          closingDate: getDateValue(survey.closing_date)
        });
        setInitialStatus(survey.status || 'Draft');

        setQuestions(
          Array.isArray(survey.questions)
            ? survey.questions.map((question) => ({
                question_id: question.question_id,
                question_text: question.question_text || '',
                question_type: question.question_type || 'Text',
                is_required: Boolean(question.is_required),
                display_order: question.display_order
              }))
            : []
        );

        setHasResponses(Boolean(survey.has_responses));
      } catch (error) {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setPageError(error.message || 'Unable to load survey.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadSurvey();

    return () => controller.abort();
  }, [id]);

  // ============================================
  // LOAD INSTRUCTORS WHEN COURSE / SEMESTER CHANGE
  // ============================================

  useEffect(() => {
    if (!formData.course || !formData.semester) {
      setInstructors([]);
      return;
    }

    const controller = new AbortController();

    const loadInstructors = async () => {
      try {
        const data = await getInstructorsByCourseAndSemester(
          formData.course,
          formData.semester,
          { signal: controller.signal }
        );

        if (!controller.signal.aborted) {
          setInstructors(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setInstructors([]);

          setErrors((previous) => ({
            ...previous,
            instructor: error.message || 'Unable to load instructors.'
          }));
        }
      }
    };

    loadInstructors();

    return () => controller.abort();
  }, [formData.course, formData.semester]);

  // ============================================
  // HANDLE FORM CHANGES
  // ============================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
      ...(name === 'course' || name === 'semester'
        ? { instructor: '' }
        : {})
    }));

    if (name === 'course' || name === 'semester') {
      setInstructors([]);
    }

    setErrors((previous) => ({
      ...previous,
      [name]: '',
      ...(name === 'course' || name === 'semester'
        ? { instructor: '' }
        : {})
    }));

    setSubmitError('');
  };

  // ============================================
  // QUESTION HANDLERS
  // ============================================

  const handleQuestionChange = (index, field, value) => {
    if (hasResponses) return;

    setQuestions((previous) =>
      previous.map((question, questionIndex) =>
        questionIndex === index
          ? { ...question, [field]: value }
          : question
      )
    );

    setErrors((previous) => ({
      ...previous,
      questions: ''
    }));

    setSubmitError('');
  };

  const handleAddQuestion = () => {
    if (hasResponses) return;

    setQuestions((previous) => [
      ...previous,
      {
        question_text: '',
        question_type: 'Text',
        is_required: true,
        display_order: previous.length + 1
      }
    ]);

    setErrors((previous) => ({
      ...previous,
      questions: ''
    }));
  };

  const handleRemoveQuestion = (index) => {
    if (hasResponses) return;

    setQuestions((previous) =>
      previous.filter((_, questionIndex) => questionIndex !== index)
    );

    setErrors((previous) => ({
      ...previous,
      questions: ''
    }));
  };

  // ============================================
  // FORM VALIDATION
  // ============================================

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.title.trim()) {
      nextErrors.title = 'Survey title is required.';
    } else if (formData.title.trim().length > 200) {
      nextErrors.title = 'Survey title cannot exceed 200 characters.';
    }

    if (!formData.course) {
      nextErrors.course = 'Please select a course.';
    }

    if (!formData.semester) {
      nextErrors.semester = 'Please select a semester.';
    }

    if (!formData.instructor) {
      nextErrors.instructor = 'Please select an instructor.';
    }

    if (!formData.status) {
      nextErrors.status = 'Please select a status.';
    }

    if (formData.status === 'Published' && questions.length === 0) {
      nextErrors.questions = 'Add at least one question before publishing.';
    }

    if (!hasResponses) {
      if (questions.some((question) => !question.question_text.trim())) {
        nextErrors.questions = 'Every question must have question text.';
      }
    }

    if (!formData.openingDate) {
      nextErrors.openingDate = 'Opening date is required.';
    }

    if (!formData.closingDate) {
      nextErrors.closingDate = 'Closing date is required.';
    } else if (
      formData.openingDate &&
      formData.closingDate <= formData.openingDate
    ) {
      nextErrors.closingDate = 'Closing date must be after opening date.';
    }

    if (formData.description.length > 500) {
      nextErrors.description = 'Description cannot exceed 500 characters.';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const allowedStatuses = {
    Draft: ['Draft', 'Published'],
    Published: ['Published', 'Closed'],
    Closed: ['Closed']
  }[initialStatus] || [initialStatus];

  // ============================================
  // SUBMIT UPDATED SURVEY
  // ============================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting || !validateForm()) return;

    try {
      setIsSubmitting(true);
      setSubmitError('');

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,

        course_id: Number(formData.course),
        semester_id: Number(formData.semester),
        instructor_id: Number(formData.instructor),

        status: formData.status,

        opening_date: formData.openingDate,
        closing_date: formData.closingDate,

        // Preserve IDs of existing questions.
        // New questions do not have a question_id.
        questions: questions.map((question, index) => ({
          ...(question.question_id
            ? { question_id: question.question_id }
            : {}),
          question_text: question.question_text.trim(),
          question_type: question.question_type,
          is_required: question.is_required,
          display_order: index + 1
        }))
      };

      await updateSurvey(id, payload);

      navigate('/admin/surveys', {
        state: {
          message: 'Survey updated successfully.'
        }
      });
    } catch (error) {
      setSubmitError(error.message || 'Unable to update survey.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center gap-3 text-[#526052]">
        <RefreshCw className="animate-spin" size={22} />
        Loading survey...
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================

  if (pageError) {
    return (
      <div className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">{pageError}</p>

        <button
          type="button"
          onClick={() => navigate('/admin/surveys')}
          className="rounded-lg bg-[#064D38] px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Manage Surveys
        </button>
      </div>
    );
  }

  // ============================================
  // MAIN PAGE
  // ============================================

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">

      {/* PAGE HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin/surveys')}
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#526052] hover:text-[#064D38]"
          >
            <ArrowLeft size={17} />
            Back to Manage Surveys
          </button>

          <h1 className="text-3xl font-bold text-[#064D38]">
            Edit Survey
          </h1>

          <p className="mt-1 text-sm text-[#899187]">
            Update survey information and questions.
          </p>
        </div>

        <span className="rounded-full bg-[#E8F2EC] px-4 py-2 text-sm font-semibold text-[#064D38]">
          Survey ID: {id}
        </span>
      </div>

      {/* RESPONSE LOCK NOTICE */}

      {hasResponses && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This survey already has responses. Its questions are locked to
          protect submitted answers. You can still edit the survey information.
        </div>
      )}

      {/* SURVEY INFORMATION */}

      <section className="rounded-2xl border border-[#E5E8E3] bg-white p-6 shadow-sm">
        <h2 className="mb-6 rounded-lg bg-[#E1E9E0] px-4 py-3 font-semibold text-[#2B5748]">
          Survey Information
        </h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

          {/* TITLE */}

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-[#35483D]">
              Survey Title *
            </label>

            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              maxLength={200}
              className="w-full rounded-lg border border-[#D9DFDA] px-4 py-3 text-sm outline-none focus:border-[#2B5748]"
            />

            {errors.title && (
              <p className="mt-1 text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          {/* COURSE */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#35483D]">
              Course *
            </label>

            <select
              name="course"
              value={formData.course}
              onChange={handleChange}
              className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm"
            >
              <option value="">Select a course</option>

              {courses.map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {course.course_code} - {course.course_name}
                </option>
              ))}
            </select>

            {errors.course && (
              <p className="mt-1 text-sm text-red-500">{errors.course}</p>
            )}
          </div>

          {/* SEMESTER */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#35483D]">
              Semester *
            </label>

            <select
              name="semester"
              value={formData.semester}
              onChange={handleChange}
              className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm"
            >
              <option value="">Select a semester</option>

              {semesters.map((semester) => (
                <option
                  key={semester.semester_id}
                  value={semester.semester_id}
                >
                  {semester.semester_name} - {semester.academic_year}
                </option>
              ))}
            </select>

            {errors.semester && (
              <p className="mt-1 text-sm text-red-500">{errors.semester}</p>
            )}
          </div>

          {/* INSTRUCTOR */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#35483D]">
              Instructor *
            </label>

            <select
              name="instructor"
              value={formData.instructor}
              onChange={handleChange}
              disabled={!formData.course || !formData.semester}
              className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm disabled:bg-gray-100"
            >
              <option value="">Select an instructor</option>

              {instructors.map((instructor) => (
                <option
                  key={instructor.instructor_id}
                  value={instructor.instructor_id}
                >
                  {instructor.instructor_name}
                </option>
              ))}
            </select>

            {errors.instructor && (
              <p className="mt-1 text-sm text-red-500">
                {errors.instructor}
              </p>
            )}
          </div>

          {/* STATUS */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#35483D]">
              Status *
            </label>

            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm"
            >
              {allowedStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            {errors.status && (
              <p className="mt-1 text-sm text-red-500">{errors.status}</p>
            )}
          </div>
        </div>
      </section>

      {/* SURVEY QUESTIONS */}

      <section className="rounded-2xl border border-[#E5E8E3] bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="rounded-lg bg-[#E1E9E0] px-4 py-3 font-semibold text-[#2B5748]">
              Survey Questions
            </h2>

            <p className="mt-2 text-sm text-[#899187]">
              Manage written-response and rating questions.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddQuestion}
            disabled={hasResponses}
            className="rounded-lg border border-[#2B5748] px-4 py-2 text-sm font-semibold text-[#2B5748] hover:bg-[#F1F5F1] disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add Question
          </button>
        </div>

        {errors.questions && (
          <p className="mb-4 text-sm text-red-500">{errors.questions}</p>
        )}

        {questions.length === 0 && (
          <p className="rounded-lg bg-[#F4F7F6] px-4 py-3 text-sm text-[#66736A]">
            No questions have been added.
          </p>
        )}

        <div className="space-y-4">
          {questions.map((question, index) => (
            <div
              key={question.question_id ?? `new-${index}`}
              className="space-y-4 rounded-xl border border-[#E5E8E3] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[#35483D]">
                    Question {index + 1}
                  </h3>

                  {question.question_id && (
                    <p className="text-xs text-gray-400">
                      Question ID: {question.question_id}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={hasResponses}
                  onClick={() => handleRemoveQuestion(index)}
                  className="flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X size={15} />
                  Remove
                </button>
              </div>

              {/* QUESTION TEXT */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                  Question text *
                </label>

                <textarea
                  value={question.question_text}
                  disabled={hasResponses}
                  onChange={(event) =>
                    handleQuestionChange(
                      index,
                      'question_text',
                      event.target.value
                    )
                  }
                  rows={3}
                  className="w-full rounded-lg border border-[#D9DFDA] px-4 py-3 text-sm outline-none focus:border-[#2B5748] disabled:bg-gray-100"
                />
              </div>

              {/* QUESTION TYPE AND REQUIRED */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                    Response type
                  </label>

                  <select
                    value={question.question_type}
                    disabled={hasResponses}
                    onChange={(event) =>
                      handleQuestionChange(
                        index,
                        'question_type',
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm disabled:bg-gray-100"
                  >
                    <option value="Text">Written response</option>
                    <option value="Rating">Rating</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 text-sm font-medium text-[#35483D] sm:pt-8">
                  <input
                    type="checkbox"
                    checked={question.is_required}
                    disabled={hasResponses}
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

      {/* SURVEY DETAILS */}

      <section className="rounded-2xl border border-[#E5E8E3] bg-white p-6 shadow-sm">
        <h2 className="mb-6 rounded-lg bg-[#E1E9E0] px-4 py-3 font-semibold text-[#2B5748]">
          Survey Details
        </h2>

        <div className="space-y-5">

          {/* DESCRIPTION */}

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#35483D]">
              Description
            </label>

            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              maxLength={500}
              rows={4}
              className="w-full rounded-lg border border-[#D9DFDA] px-4 py-3 text-sm outline-none focus:border-[#2B5748]"
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

          {/* DATES */}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            {/* OPENING DATE */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                Opening Date *
              </label>

              <input
                type="date"
                name="openingDate"
                value={formData.openingDate}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#D9DFDA] px-4 py-3 text-sm"
              />

              {errors.openingDate && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.openingDate}
                </p>
              )}
            </div>

            {/* CLOSING DATE */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#35483D]">
                Closing Date *
              </label>

              <input
                type="date"
                name="closingDate"
                value={formData.closingDate}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#D9DFDA] px-4 py-3 text-sm"
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

      {/* SUBMIT ERROR */}

      {submitError && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-700"
        >
          {submitError}
        </p>
      )}

      {/* ACTION BUTTONS */}

      <div className="flex justify-end gap-3 pb-4">
        <button
          type="button"
          onClick={() => navigate('/admin/surveys')}
          disabled={isSubmitting}
          className="rounded-lg border border-[#C9D4CC] bg-white px-6 py-3 text-sm font-semibold text-[#2B5748] hover:bg-[#F1F5F1] disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-[#2B5748] px-7 py-3 text-sm font-semibold text-white hover:bg-[#214638] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

export default EditSurvey;
