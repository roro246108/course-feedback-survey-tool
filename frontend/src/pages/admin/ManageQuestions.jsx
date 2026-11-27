import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react';

import {
  addQuestion,
  deleteQuestion,
  getSurveyQuestions,
  getSurveys,
  reorderQuestions,
  updateQuestion
} from '../../services/surveyService';

const sortQuestions = (items) =>
  [...items].sort(
    (left, right) =>
      Number(left.display_order) - Number(right.display_order) ||
      Number(left.question_id) - Number(right.question_id)
  );

const statusClassName = (status) => {
  if (status === 'Published') return 'bg-[#D5F3DF] text-[#17683A]';
  if (status === 'Closed') return 'bg-[#EDF0F2] text-[#46515B]';
  return 'bg-[#FFF0D0] text-[#916000]';
};

function ManageQuestions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [survey, setSurvey] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [hasResponses, setHasResponses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [pendingAction, setPendingAction] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState('Rating');
  const [isRequired, setIsRequired] = useState(true);
  const [formError, setFormError] = useState('');

  const loadSurvey = useCallback(async (signal) => {
    const data = await getSurveyQuestions(id, { signal }, apiFetch);

    if (Number(data.survey_id) !== Number(id)) {
      throw new Error('The server returned a different survey.');
    }

    return data;
  }, [apiFetch, id]);

  const applySurvey = useCallback((data) => {
    setSurvey(data);
    setQuestions(
      sortQuestions(Array.isArray(data.questions) ? data.questions : [])
    );
    setHasResponses(Boolean(data.has_responses));
  }, []);

  const refreshSurvey = useCallback(async () => {
    const data = await loadSurvey();
    applySurvey(data);
  }, [applySurvey, loadSurvey]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const loadPage = async () => {
      setLoading(true);
      setLoadError('');

      try {
        if (id === undefined) {
          const result = await getSurveys({
            signal: controller.signal
          }, apiFetch);
          if (active) {
            setSurveys(Array.isArray(result) ? result : []);
          }
        } else {
          if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
            throw new Error('Invalid survey ID.');
          }

          const data = await loadSurvey(controller.signal);
          if (active) applySurvey(data);
        }
      } catch (error) {
        if (error.name !== 'AbortError' && active) {
          setLoadError(error.message || 'Unable to load survey questions.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPage();

    return () => {
      active = false;
      controller.abort();
    };
  }, [apiFetch, applySurvey, id, loadSurvey]);

  const openAddForm = () => {
    if (hasResponses) {
      setNotice({
        type: 'error',
        message: 'Questions are locked because this survey has responses.'
      });
      return;
    }

    setEditingQuestion(null);
    setQuestionText('');
    setQuestionType('Rating');
    setIsRequired(true);
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (question) => {
    if (hasResponses) {
      setNotice({
        type: 'error',
        message: 'Questions are locked because this survey has responses.'
      });
      return;
    }

    setEditingQuestion(question);
    setQuestionText(question.question_text);
    setQuestionType(question.question_type);
    setIsRequired(Boolean(question.is_required));
    setFormError('');
    setFormOpen(true);
  };

  const handleSaveQuestion = async (event) => {
    event.preventDefault();
    if (pendingAction) return;

    const trimmedText = questionText.trim();
    if (!trimmedText) {
      setFormError('Question text is required.');
      return;
    }
    if (!['Rating', 'Text'].includes(questionType) || typeof isRequired !== 'boolean') {
      setFormError('Choose a valid question type and required setting.');
      return;
    }

    setFormError('');
    setPendingAction('save');

    try {
      const questionData = {
        question_text: trimmedText,
        question_type: questionType,
        is_required: isRequired
      };

      if (editingQuestion) {
        await updateQuestion(id, editingQuestion.question_id, questionData, apiFetch);
      } else {
        await addQuestion(id, questionData, apiFetch);
      }

      setFormOpen(false);
      setNotice({
        type: 'success',
        message: editingQuestion
          ? 'Question updated successfully.'
          : 'Question added successfully.'
      });

      try {
        await refreshSurvey();
      } catch {
        setNotice({
          type: 'error',
          message: 'The question was saved, but the list could not be refreshed.'
        });
      }
    } catch (error) {
      setFormError(error.message || 'Unable to save this question.');
    } finally {
      setPendingAction('');
    }
  };

  const handleDeleteQuestion = async (question) => {
    if (pendingAction) return;

    const confirmed = window.confirm(
      `Delete this question?\n\n"${question.question_text}"\n\nQuestions with submitted answers are protected.`
    );

    if (!confirmed) return;

    setPendingAction('delete');
    setNotice({
      type: 'loading',
      message: `Deleting question "${question.question_text}"...`
    });

    try {
      await deleteQuestion(id, question.question_id, apiFetch);
      setNotice({
        type: 'success',
        message: 'Question deleted successfully.'
      });

      try {
        await refreshSurvey();
      } catch {
        setNotice({
          type: 'error',
          message: 'The question was deleted, but the list could not be refreshed.'
        });
      }
    } catch (error) {
      setNotice({
        type: 'error',
        message: error.message || 'Unable to delete this question.'
      });
    } finally {
      setPendingAction('');
    }
  };

  const handleMoveQuestion = async (index, direction) => {
    if (pendingAction || hasResponses) return;

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const reordered = [...questions];
    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index]
    ];

    setPendingAction('reorder');
    setNotice({
      type: 'loading',
      message: 'Saving question order...'
    });

    try {
      await reorderQuestions(id, {
        question_ids: reordered.map((question) => question.question_id)
      }, apiFetch);
    } catch (error) {
      setNotice({
        type: 'error',
        message: error.message || 'Unable to reorder questions.'
      });
      setPendingAction('');
      return;
    }

    try {
      await refreshSurvey();
      setNotice({
        type: 'success',
        message: 'Question order saved.'
      });
    } catch {
      setNotice({
        type: 'error',
        message: 'The new order was saved, but the list could not be refreshed.'
      });
    } finally {
      setPendingAction('');
    }
  };

  const renderNotice = () => {
    if (!notice) return null;

    const styles = notice.type === 'success'
      ? 'border-green-200 bg-green-50 text-green-800'
      : notice.type === 'loading'
        ? 'border-blue-200 bg-blue-50 text-blue-800'
        : 'border-red-200 bg-red-50 text-red-700';

    return (
      <p role={notice.type === 'error' ? 'alert' : 'status'}
        className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
        {notice.message}
      </p>
    );
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E5E8E3] bg-white p-8 text-sm text-[#66736A]">
        Loading {id ? 'survey questions' : 'surveys'}...
      </div>
    );
  }

  if (id === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#2B5748]">
              Manage Questions
            </h1>
            <p className="mt-1 text-sm text-[#899187]">
              Choose a survey to manage its questions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/surveys')}
            className="inline-flex items-center gap-2 rounded-lg border border-[#C9D4CC] bg-white px-4 py-2.5 text-sm font-semibold text-[#2B5748] hover:bg-[#F1F5F1]"
          >
            <ArrowLeft size={17} />
            Back to Surveys
          </button>
        </div>

        {loadError && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </p>
        )}
        {renderNotice()}

        {surveys.length === 0 && !loadError ? (
          <div className="rounded-2xl border border-[#E5E8E3] bg-white p-8 text-center text-sm text-[#66736A]">
            No surveys are available yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#E5E8E3] bg-white shadow-sm">
            <div className="divide-y divide-[#E5E8E3]">
              {surveys.map((item) => (
                <div
                  key={item.survey_id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <h2 className="font-semibold text-[#263D32]">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-sm text-[#66736A]">
                      {[item.course_code, item.course_name, item.semester_name, item.academic_year]
                        .filter(Boolean)
                        .join(' · ') || 'Survey details unavailable'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/surveys/${item.survey_id}/questions`)}
                    className="rounded-lg bg-[#064D38] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#033D2C]"
                  >
                    Manage Questions
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loadError || !survey) {
    return (
      <div className="space-y-5">
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError || 'Survey not found.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/admin/surveys')}
          className="inline-flex items-center gap-2 rounded-lg border border-[#C9D4CC] bg-white px-4 py-2.5 text-sm font-semibold text-[#2B5748] hover:bg-[#F1F5F1]"
        >
          <ArrowLeft size={17} />
          Back to Surveys
        </button>
      </div>
    );
  }

  const courseLabel = [survey.course_code, survey.course_name]
    .filter(Boolean)
    .join(' — ');
  const semesterLabel = [survey.semester_name, survey.academic_year]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2B5748]">
            Manage Questions
          </h1>
          <p className="mt-1 text-sm text-[#899187]">
            Add, edit, reorder, or remove questions for this survey.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/surveys')}
          className="inline-flex items-center gap-2 rounded-lg border border-[#C9D4CC] bg-white px-4 py-2.5 text-sm font-semibold text-[#2B5748] hover:bg-[#F1F5F1]"
        >
          <ArrowLeft size={17} />
          Back to Surveys
        </button>
      </div>

      {renderNotice()}

      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[#E5E8E3] bg-white p-5 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#E8F2EC] text-[#2B5748]">
            <ClipboardList size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-[#263D32]">
              {survey.title}
            </h2>
            <p className="mt-1 text-sm text-[#66736A]">
              {survey.description || 'No description provided.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-l border-[#E5E8E3] pl-5 text-sm text-[#263D32]">
          <span className="inline-flex items-center gap-2">
            <BookOpen size={19} className="text-[#2B5748]" />
            {courseLabel || 'Course unavailable'}
          </span>
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={19} className="text-[#2B5748]" />
            {semesterLabel || 'Semester unavailable'}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(survey.status)}`}>
            {survey.status}
          </span>
        </div>
      </section>

      {hasResponses && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This survey has submitted responses. Questions are locked to protect historical feedback.
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#E5E8E3] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E8E3] px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-[#2B5748]">
              Survey Questions
            </h2>
            <span className="rounded-full bg-[#E8F2EC] px-3 py-1 text-xs font-semibold text-[#2B5748]">
              {questions.length} {questions.length === 1 ? 'Question' : 'Questions'}
            </span>
          </div>
          <button
            type="button"
            onClick={openAddForm}
            disabled={Boolean(pendingAction) || hasResponses}
            className="inline-flex items-center gap-2 rounded-lg bg-[#064D38] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#033D2C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={18} />
            Add New Question
          </button>
        </div>

        {questions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-[#35483D]">No questions yet</p>
            <p className="mt-1 text-sm text-[#899187]">
              Add a question to start collecting feedback.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-[#E8F2EC] text-sm text-[#263D32]">
                <tr>
                  <th scope="col" className="w-24 px-5 py-4">Order</th>
                  <th scope="col" className="px-5 py-4">Question Text</th>
                  <th scope="col" className="w-32 px-5 py-4">Type</th>
                  <th scope="col" className="w-32 px-5 py-4">Required</th>
                  <th scope="col" className="w-56 px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E8E3]">
                {questions.map((question, index) => (
                  <tr key={question.question_id} className="hover:bg-[#F8FAF8]">
                    <td className="px-5 py-4">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8F2EC] font-semibold text-[#2B5748]">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-[#263D32]">
                      {question.question_text}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-[#EAF3FF] px-3 py-1 text-xs font-semibold text-[#1E63A5]">
                        {question.question_type}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        question.is_required
                          ? 'bg-[#D5F3DF] text-[#17683A]'
                          : 'bg-[#EDF0F2] text-[#46515B]'
                      }`}>
                        {question.is_required ? 'Required' : 'Optional'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          aria-label={`Move question ${index + 1} up`}
                          title="Move up"
                          disabled={index === 0 || Boolean(pendingAction) || hasResponses}
                          onClick={() => handleMoveQuestion(index, -1)}
                          className="rounded-lg border border-[#E1E5E8] p-2 text-[#2B5748] hover:bg-[#E8F2EC] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowUp size={17} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move question ${index + 1} down`}
                          title="Move down"
                          disabled={index === questions.length - 1 || Boolean(pendingAction) || hasResponses}
                          onClick={() => handleMoveQuestion(index, 1)}
                          className="rounded-lg border border-[#E1E5E8] p-2 text-[#2B5748] hover:bg-[#E8F2EC] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowDown size={17} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit question ${index + 1}`}
                          title="Edit question"
                          disabled={Boolean(pendingAction) || hasResponses}
                          onClick={() => openEditForm(question)}
                          className="rounded-lg border border-[#E1E5E8] p-2 text-[#2B5748] hover:bg-[#E8F2EC] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete question ${index + 1}`}
                          title="Delete question"
                          disabled={Boolean(pendingAction) || hasResponses}
                          onClick={() => handleDeleteQuestion(question)}
                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-form-title"
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 id="question-form-title" className="text-xl font-bold text-[#2B5748]">
              {editingQuestion ? 'Edit Question' : 'Add New Question'}
            </h2>
            <form onSubmit={handleSaveQuestion} className="mt-5 space-y-5">
              <div>
                <label htmlFor="question-text" className="mb-2 block text-sm font-semibold text-[#35483D]">
                  Question Text *
                </label>
                <textarea
                  id="question-text"
                  autoFocus
                  rows={4}
                  maxLength={2000}
                  value={questionText}
                  onChange={(event) => setQuestionText(event.target.value)}
                  disabled={Boolean(pendingAction)}
                  className="w-full rounded-lg border border-[#D9DFDA] px-4 py-3 text-sm outline-none focus:border-[#2B5748] disabled:bg-gray-100"
                  placeholder="Write the question students will answer"
                />
              </div>

              <div>
                <label htmlFor="question-type" className="mb-2 block text-sm font-semibold text-[#35483D]">
                  Question Type
                </label>
                <select
                  id="question-type"
                  value={questionType}
                  onChange={(event) => setQuestionType(event.target.value)}
                  disabled={Boolean(pendingAction)}
                  className="w-full rounded-lg border border-[#D9DFDA] bg-white px-4 py-3 text-sm"
                >
                  <option value="Rating">Rating (1–5)</option>
                  <option value="Text">Text</option>
                </select>
              </div>

              <label className="flex items-center gap-3 text-sm font-medium text-[#35483D]">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(event) => setIsRequired(event.target.checked)}
                  disabled={Boolean(pendingAction)}
                  className="h-4 w-4 accent-[#2B5748]"
                />
                Required question
              </label>

              {formError && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  disabled={Boolean(pendingAction)}
                  className="rounded-lg border border-[#C9D4CC] px-4 py-2.5 text-sm font-semibold text-[#2B5748] hover:bg-[#F1F5F1] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(pendingAction)}
                  className="rounded-lg bg-[#064D38] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#033D2C] disabled:opacity-50"
                >
                  {pendingAction === 'save' ? 'Saving...' : 'Save Question'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default ManageQuestions;
