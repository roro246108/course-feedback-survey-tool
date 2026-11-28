
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  ClipboardList,
  Hourglass,
  Play,
  CircleCheck,
  Search,
  Plus,
  Eye,
  Pencil,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
  RefreshCw,
  Info
} from 'lucide-react';

import {
  getSurveys,
  getSurveyById,
  changeSurveyStatus,
  deleteSurvey
} from '../../services/surveyService';
import { getCairoCalendarDayDifference } from '../../utils/surveyDateUtils';


const PAGE_SIZE = 5;


// Format dates
const formatDate = (dateValue) => {
  if (!dateValue) return '—';

  const date = String(dateValue).slice(0, 10);
  const [year, month, day] = date.split('-');

  if (!year || !month || !day) return '—';

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  ).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};


// Get survey status
const getDisplayStatus = (survey) => {
  const status = String(survey.status || 'Draft').toLowerCase();

  if (status === 'closed') return 'Closed';

  if (
    status === 'published' &&
    survey.closing_date &&
    getCairoCalendarDayDifference(survey.closing_date) < 0
  ) {
    return 'Closed';
  }

  if (status === 'published') return 'Published';

  return 'Draft';
};


// Status Badge
function StatusBadge({ status }) {
  const styles = {
    Published: 'bg-[#D5F3DF] text-[#17683A]',
    Draft: 'bg-[#FFF0D0] text-[#916000]',
    Closed: 'bg-[#EDF0F2] text-[#46515B]'
  };

  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold ${
        styles[status] || styles.Draft
      }`}
    >
      {status}
    </span>
  );
}


// Statistics Card
function StatCard({
  title,
  value,
  icon: Icon,
  cardColor,
  iconColor
}) {
  return (
    <div
      className={`flex min-h-[85px] items-center gap-3 rounded-xl border border-black/[0.03] p-4 shadow-sm ${cardColor}`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/60 ${iconColor}`}
      >
        <Icon size={24} strokeWidth={1.8} />
      </div>

      <div>
        <p className="text-sm font-medium text-[#31443A]">
          {title}
        </p>

        <h2 className="mt-1 text-2xl font-bold text-[#17251E]">
          {value}
        </h2>
      </div>
    </div>
  );
}


// Survey Details Modal
function SurveyDetailsModal({
  survey,
  onClose,
  onEdit,
  loading,
  error
}) {
  if (!survey && !loading && !error) return null;

  const questions = Array.isArray(survey?.questions)
    ? [...survey.questions].sort(
        (left, right) =>
          Number(left.display_order) - Number(right.display_order) ||
          Number(left.question_id) - Number(right.question_id)
      )
    : [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E5E8E3] px-6 py-4">

          <div>
            <h2 className="text-xl font-bold text-[#263D32]">
              Survey Details
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              View survey information
            </p>
          </div>

          {survey && (
            <button
              type="button"
              onClick={onEdit}
              title="Edit survey"
              aria-label={`Edit ${survey.title}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E1E5E8] text-[#064D38] shadow-sm transition hover:bg-[#E8F2EC]"
            >
              <Pencil size={17} />
            </button>
          )}

        </div>


        {/* Modal Content */}
        <div className="max-h-[70vh] overflow-y-auto p-6">

          {loading && (
            <div className="py-12 text-center text-gray-500">
              <RefreshCw
                className="mx-auto mb-3 animate-spin"
                size={25}
              />

              Loading survey details...
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {survey && !loading && (
            <div className="space-y-5">

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Survey Title
                </p>

                <h3 className="mt-2 text-xl font-bold text-[#263D32]">
                  {survey.title}
                </h3>
              </div>

              <div>
                <StatusBadge
                  status={getDisplayStatus(survey)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                {[
                  ['Course', survey.course_name],
                  ['Instructor', survey.instructor_name],
                  [
                    'Semester',
                    `${survey.semester_name || ''} ${survey.academic_year || ''}`.trim()
                  ],
                  ['Opening Date', formatDate(survey.opening_date)],
                  ['Closing Date', formatDate(survey.closing_date)],
                  ['Survey ID', survey.survey_id]
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-[#F5F8F5] p-4"
                  >
                    <p className="text-xs text-gray-500">
                      {label}
                    </p>

                    <p className="mt-1 font-semibold text-[#263D32]">
                      {value || '—'}
                    </p>
                  </div>
                ))}

              </div>

              <div>
                <p className="text-sm font-semibold text-[#263D32]">
                  Description
                </p>

                <p className="mt-2 rounded-xl bg-[#F5F8F5] p-4 text-sm leading-6 text-gray-600">
                  {survey.description || 'No description provided.'}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-[#263D32]">
                  Questions
                </p>

                {questions.length === 0 ? (
                  <p className="mt-2 rounded-xl bg-[#F5F8F5] p-4 text-sm text-gray-600">
                    No questions have been added.
                  </p>
                ) : (
                  <ol className="mt-2 space-y-3">
                    {questions.map((question, index) => (
                      <li
                        key={question.question_id}
                        className="rounded-xl bg-[#F5F8F5] p-4"
                      >
                        <p className="text-sm font-medium text-[#263D32]">
                          {index + 1}. {question.question_text}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          {question.question_type} ·{' '}
                          {question.is_required ? 'Required' : 'Optional'}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

            </div>
          )}

        </div>


        {/* Modal Footer */}
        <div className="flex justify-end border-t border-[#E5E8E3] px-6 py-4">

          <button
            onClick={onClose}
            className="rounded-xl bg-[#064D38] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#033D2C]"
          >
            Close
          </button>

        </div>

      </div>
    </div>
  );
}


// ============================================
// MAIN MANAGE SURVEYS PAGE
// ============================================

function ManageSurveys() {

  const navigate = useNavigate();
  const location = useLocation();
  const detailsRequest = useRef(null);
  const actionLock = useRef(false);

  // Surveys Data
  const [surveys, setSurveys] = useState([]);

  // Loading and Errors
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Survey Details Modal
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  // Actions Menu
  const [openMenu, setOpenMenu] = useState(null);
  const [pendingActionId, setPendingActionId] = useState(null);
  const [actionNotice, setActionNotice] = useState(() =>
    location.state?.message
      ? { type: 'success', message: location.state.message }
      : null
  );


  // ============================================
  // FETCH SURVEYS
  // ============================================

  const fetchSurveys = useCallback(async () => {

    setLoading(true);
    setError('');

    try {

      const data = await getSurveys();

      if (!Array.isArray(data)) {
        throw new Error('Invalid surveys data received from server.');
      }

      setSurveys(data);
      return true;

    } catch (err) {

      setError(err.message || 'Unable to load surveys.');
      return false;

    } finally {

      setLoading(false);

    }

  }, []);


  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  useEffect(() => {
    if (!location.state?.message) return;

    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!openMenu) return undefined;

    const closeMenu = (event) => {
      if (
        event.target instanceof Element &&
        !event.target.closest('[data-survey-actions-menu]')
      ) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    const closeForViewportChange = () => setOpenMenu(null);

    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeForViewportChange);
    window.addEventListener('scroll', closeForViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeForViewportChange);
      window.removeEventListener('scroll', closeForViewportChange, true);
    };
  }, [openMenu]);

  useEffect(() => () => {
    detailsRequest.current?.abort();
  }, []);

  // ============================================
  // COURSE FILTER OPTIONS
  // ============================================

  const courses = useMemo(() => {

    const uniqueCourses = new Map();

    surveys.forEach((survey) => {

      if (survey.course_id != null) {

        uniqueCourses.set(
          String(survey.course_id),
          survey.course_name || 'Unknown Course'
        );

      }

    });

    return Array.from(uniqueCourses, ([id, name]) => ({
      id,
      name
    }));

  }, [surveys]);


  // ============================================
  // SEMESTER FILTER OPTIONS
  // ============================================

  const semesters = useMemo(() => {

    const uniqueSemesters = new Map();

    surveys.forEach((survey) => {

      if (survey.semester_id != null) {

        uniqueSemesters.set(
          String(survey.semester_id),
          `${survey.semester_name || ''} ${survey.academic_year || ''}`.trim()
        );

      }

    });

    return Array.from(uniqueSemesters, ([id, name]) => ({
      id,
      name
    }));

  }, [surveys]);


  // ============================================
  // STATISTICS
  // ============================================

  const statistics = useMemo(() => {

    const result = {
      total: surveys.length,
      draft: 0,
      published: 0,
      closed: 0
    };

    surveys.forEach((survey) => {

      const status = getDisplayStatus(survey);

      if (status === 'Draft') result.draft++;
      if (status === 'Published') result.published++;
      if (status === 'Closed') result.closed++;

    });

    return result;

  }, [surveys]);


  // ============================================
  // SEARCH AND FILTERS
  // ============================================

  const filteredSurveys = useMemo(() => {

    const normalizedSearch = searchTerm.trim().toLowerCase();

    return surveys.filter((survey) => {

      const matchesSearch =
        !normalizedSearch ||
        [
          survey.title,
          survey.course_name,
          survey.instructor_name,
          survey.course_code
        ].some((value) =>
          String(value || '').toLowerCase().includes(normalizedSearch)
        );


      const matchesCourse =
        courseFilter === 'all' ||
        String(survey.course_id) === courseFilter;


      const matchesSemester =
        semesterFilter === 'all' ||
        String(survey.semester_id) === semesterFilter;


      const matchesStatus =
        statusFilter === 'all' ||
        getDisplayStatus(survey) === statusFilter;


      return (
        matchesSearch &&
        matchesCourse &&
        matchesSemester &&
        matchesStatus
      );

    });

  }, [
    surveys,
    searchTerm,
    courseFilter,
    semesterFilter,
    statusFilter
  ]);


  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    courseFilter,
    semesterFilter,
    statusFilter
  ]);


  // ============================================
  // PAGINATION
  // ============================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSurveys.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const paginatedSurveys = filteredSurveys.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );


  // ============================================
  // VIEW SURVEY DETAILS
  // ============================================

  const handleViewSurvey = async (surveyId) => {
    detailsRequest.current?.abort();
    const controller = new AbortController();
    detailsRequest.current = controller;

    setSelectedSurvey(null);
    setDetailsError('');
    setDetailsLoading(true);
    setOpenMenu(null);

    try {

      const data = await getSurveyById(surveyId, {
        signal: controller.signal
      });

      if (Number(data.survey_id) !== Number(surveyId)) {
        throw new Error('The server returned a different survey.');
      }

      if (!controller.signal.aborted) {
        setSelectedSurvey(data);
      }

    } catch (err) {

      if (err.name !== 'AbortError' && !controller.signal.aborted) {
        setDetailsError(
          err.message || 'Unable to load survey details.'
        );
      }

    } finally {

      if (!controller.signal.aborted) {
        setDetailsLoading(false);
      }

    }

  };

  const closeSurveyDetails = () => {
    detailsRequest.current?.abort();
    detailsRequest.current = null;
    setSelectedSurvey(null);
    setDetailsLoading(false);
    setDetailsError('');
  };

  const runSurveyAction = async (survey, label, action) => {
    if (actionLock.current) return;

    const actionVerb = {
      Publishing: 'publish',
      Closing: 'close',
      Deleting: 'delete'
    }[label];
    const actionPastTense = {
      Publishing: 'published',
      Closing: 'closed',
      Deleting: 'deleted'
    }[label];

    actionLock.current = true;
    setOpenMenu(null);
    setPendingActionId(survey.survey_id);
    setActionNotice({
      type: 'loading',
      message: `${label} "${survey.title}"...`
    });

    try {
      await action();
      const refreshed = await fetchSurveys();

      setActionNotice({
        type: refreshed ? 'success' : 'error',
        message: refreshed
          ? `"${survey.title}" ${actionPastTense} successfully.`
          : `"${survey.title}" was ${actionPastTense}, but the survey list could not be refreshed.`
      });
    } catch (actionError) {
      setActionNotice({
        type: 'error',
        message: actionError.message || `Unable to ${actionVerb} survey.`
      });
    } finally {
      actionLock.current = false;
      setPendingActionId(null);
    }
  };

  const handleStatusAction = (survey, nextStatus) => {
    const label = nextStatus === 'Published' ? 'Publishing' : 'Closing';

    return runSurveyAction(survey, label, () =>
      changeSurveyStatus(survey.survey_id, nextStatus)
    );
  };

  const handleDeleteSurvey = (survey) => {
    setOpenMenu(null);

    const confirmed = window.confirm(
      `Confirm permanent deletion of "${survey.title}"? If it has submitted responses, deletion will be blocked and its historical feedback will be preserved.`
    );

    if (!confirmed) return;

    return runSurveyAction(survey, 'Deleting', () =>
      deleteSurvey(survey.survey_id)
    );
  };

  const toggleActionsMenu = (event, surveyId) => {
    if (pendingActionId !== null) return;

    if (openMenu?.surveyId === surveyId) {
      setOpenMenu(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 192;
    const menuHeight = 152;
    const belowTop = rect.bottom + 6;
    const top = belowTop + menuHeight <= window.innerHeight
      ? belowTop
      : Math.max(8, rect.top - menuHeight - 6);
    const left = Math.max(
      8,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)
    );

    setOpenMenu({
      surveyId,
      top,
      left
    });
  };


  // ============================================
  // CLEAR FILTERS
  // ============================================

  const clearFilters = () => {

    setSearchTerm('');
    setCourseFilter('all');
    setSemesterFilter('all');
    setStatusFilter('all');

  };


  // Pagination Numbers
  const firstResult =
    filteredSurveys.length === 0
      ? 0
      : (safePage - 1) * PAGE_SIZE + 1;

  const lastResult = Math.min(
    safePage * PAGE_SIZE,
    filteredSurveys.length
  );


  // ============================================
  // RENDER
  // ============================================

  return (

    <div className="w-full space-y-6">

      {/* ================================== */}
      {/* PAGE HEADER */}
      {/* ================================== */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

        <div>

          <h1 className="text-3xl font-bold text-[#064D38]">
            Manage Surveys
          </h1>

          <p className="mt-1.5 text-sm text-[#526052]">
            View, edit, and manage all course feedback surveys.
          </p>

        </div>


        <button
          onClick={() => navigate('/admin/surveys/create')}
          className="flex items-center justify-center gap-2.5 rounded-xl bg-[#064D38] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#033D2C] hover:shadow-md"
        >

          <Plus size={21} />

          Create Survey

        </button>

      </div>


      {/* ================================== */}
      {/* STATISTICS CARDS */}
      {/* ================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <StatCard
          title="Total Surveys"
          value={statistics.total}
          icon={ClipboardList}
          cardColor="bg-[#EEF4FB]"
          iconColor="text-[#064D38]"
        />

        <StatCard
          title="Draft"
          value={statistics.draft}
          icon={Hourglass}
          cardColor="bg-[#FFF8E8]"
          iconColor="text-[#956400]"
        />

        <StatCard
          title="Published"
          value={statistics.published}
          icon={Play}
          cardColor="bg-[#EFF8F2]"
          iconColor="text-[#17683A]"
        />

        <StatCard
          title="Closed"
          value={statistics.closed}
          icon={CircleCheck}
          cardColor="bg-[#F2F3F5]"
          iconColor="text-[#52606A]"
        />

      </div>


      {/* ================================== */}
      {/* SEARCH AND FILTERS */}
      {/* ================================== */}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">

        {/* Search */}

        <div className="flex h-12 min-w-0 items-center gap-3 rounded-xl border border-[#E1E5E8] bg-white px-4 shadow-sm">

          <Search
            size={20}
            className="shrink-0 text-[#40564B]"
          />

          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by title, course, or instructor..."
            className="w-full min-w-0 bg-transparent text-sm text-[#263D32] outline-none placeholder:text-gray-400"
          />

        </div>


        {/* Course Filter */}

        <select
          value={courseFilter}
          onChange={(event) => setCourseFilter(event.target.value)}
          className="h-12 min-w-0 rounded-xl border border-[#E1E5E8] bg-white px-4 text-sm font-medium text-[#263D32] shadow-sm outline-none focus:border-[#064D38]"
        >

          <option value="all">All Courses</option>

          {courses.map((course) => (

            <option key={course.id} value={course.id}>
              {course.name}
            </option>

          ))}

        </select>


        {/* Semester Filter */}

        <select
          value={semesterFilter}
          onChange={(event) => setSemesterFilter(event.target.value)}
          className="h-12 min-w-0 rounded-xl border border-[#E1E5E8] bg-white px-4 text-sm font-medium text-[#263D32] shadow-sm outline-none focus:border-[#064D38]"
        >

          <option value="all">All Semesters</option>

          {semesters.map((semester) => (

            <option key={semester.id} value={semester.id}>
              {semester.name}
            </option>

          ))}

        </select>


        {/* Status Filter */}

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-12 min-w-0 rounded-xl border border-[#E1E5E8] bg-white px-4 text-sm font-medium text-[#263D32] shadow-sm outline-none focus:border-[#064D38]"
        >

          <option value="all">All Statuses</option>
          <option value="Published">Published</option>
          <option value="Draft">Draft</option>
          <option value="Closed">Closed</option>

        </select>

      </div>


      {/* ================================== */}
      {/* ERROR MESSAGE */}
      {/* ================================== */}

      {error && (

        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">

          <p className="text-sm text-red-700">
            {error}
          </p>

          <button
            onClick={fetchSurveys}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm"
          >

            <RefreshCw size={16} />

            Try Again

          </button>

        </div>

      )}

      {actionNotice && (
        <div
          role={actionNotice.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${
            actionNotice.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : actionNotice.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-[#E1E5E8] bg-white text-[#526052]'
          }`}
        >
          {actionNotice.type === 'loading' && (
            <RefreshCw size={16} className="animate-spin" />
          )}
          <span>{actionNotice.message}</span>
          {actionNotice.type !== 'loading' && (
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="ml-auto rounded p-1"
              aria-label="Dismiss action message"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}


      {/* ================================== */}
      {/* SURVEYS TABLE */}
      {/* ================================== */}

      <div className="w-full overflow-hidden rounded-xl border border-[#E5E8E3] bg-white shadow-sm">

        {/* Horizontal Scroll Container */}

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1350px] table-fixed border-collapse text-left">

            {/* Column Widths */}

            <colgroup>
              <col style={{ width: '55px' }} />
              <col style={{ width: '165px' }} />
              <col style={{ width: '125px' }} />
              <col style={{ width: '135px' }} />
              <col style={{ width: '115px' }} />
              <col style={{ width: '185px' }} />
              <col style={{ width: '125px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '105px' }} />
              <col style={{ width: '105px' }} />
              <col style={{ width: '135px' }} />
            </colgroup>


            {/* TABLE HEADER */}

            <thead className="bg-[#E8F2EC]">

              <tr className="text-[13px] font-semibold text-[#17251E]">

                <th className="px-3 py-4">
                  #
                </th>

                <th className="px-3 py-4">
                  Survey Title
                </th>

                <th className="px-3 py-4">
                  Course
                </th>

                <th className="px-3 py-4">
                  Instructor
                </th>

                <th className="px-3 py-4">
                  Semester
                </th>

                <th className="px-3 py-4">
                  Dates
                </th>

                <th className="px-3 py-4 text-center">

                  <span className="inline-flex items-center justify-center gap-1">

                    Eligible Students

                    <Info size={14} />

                  </span>

                </th>

                <th className="px-3 py-4 text-center">
                  Responses
                </th>

                <th className="px-3 py-4 text-center">
                  Response Rate
                </th>

                <th className="px-3 py-4 text-center">
                  Status
                </th>

                {/* Sticky Actions Header */}

                <th className="sticky right-0 z-20 w-[135px] bg-[#E8F2EC] px-2 py-4 text-center shadow-[-5px_0_8px_rgba(0,0,0,0.04)]">
                  Actions
                </th>

              </tr>

            </thead>


            {/* TABLE BODY */}

            <tbody className="divide-y divide-[#EEF0EF]">

              {loading ? (

                <tr>

                  <td
                    colSpan="11"
                    className="py-14 text-center text-gray-500"
                  >

                    <RefreshCw
                      size={25}
                      className="mx-auto mb-3 animate-spin text-[#064D38]"
                    />

                    Loading surveys...

                  </td>

                </tr>

              ) : !error && paginatedSurveys.length === 0 ? (

                <tr>

                  <td
                    colSpan="11"
                    className="px-5 py-14 text-center"
                  >

                    <ClipboardList
                      size={35}
                      className="mx-auto mb-3 text-gray-300"
                    />

                    <p className="font-semibold text-[#263D32]">
                      No surveys found
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Try changing your search or filters.
                    </p>

                    <button
                      onClick={clearFilters}
                      className="mt-4 text-sm font-semibold text-[#064D38] underline"
                    >
                      Clear filters
                    </button>

                  </td>

                </tr>

              ) : (

                paginatedSurveys.map((survey, index) => (

                  <tr
                    key={survey.survey_id}
                    className="group transition hover:bg-[#F8FAF8]"
                  >

                    {/* Number */}

                    <td className="px-3 py-3.5 text-sm font-medium text-[#263D32]">
                      {(safePage - 1) * PAGE_SIZE + index + 1}
                    </td>


                    {/* Survey Title */}

                    <td className="break-words px-3 py-3.5">

                      <p className="text-sm font-semibold leading-5 text-[#17251E]">
                        {survey.title}
                      </p>

                    </td>


                    {/* Course */}

                    <td className="break-words px-3 py-3.5 text-sm leading-5 text-[#263D32]">

                      {survey.course_code || survey.course_name || '—'}

                    </td>


                    {/* Instructor */}

                    <td className="break-words px-3 py-3.5 text-sm leading-5 text-[#263D32]">

                      {survey.instructor_name || '—'}

                    </td>


                    {/* Semester */}

                    <td className="px-3 py-3.5 text-sm text-[#263D32]">

                      <p className="break-words">
                        {survey.semester_name || '—'}
                      </p>

                      <p className="mt-0.5 text-xs text-gray-500">
                        {survey.academic_year || ''}
                      </p>

                    </td>


                    {/* Dates */}

                    <td className="px-3 py-3.5">

                      <div className="flex items-start gap-2 text-sm text-[#263D32]">

                        <CalendarDays
                          size={18}
                          className="mt-0.5 shrink-0"
                        />

                        <div className="min-w-0">

                          <p className="whitespace-nowrap">
                            {formatDate(survey.opening_date)}
                          </p>

                          <p className="mt-1 whitespace-nowrap">
                            {formatDate(survey.closing_date)}
                          </p>

                        </div>

                      </div>

                    </td>


                    {/* Eligible Students */}

                    <td className="px-3 py-3.5 text-center text-sm font-medium text-[#263D32]">
                      {Number.isFinite(Number(survey.eligible_students))
                        ? Number(survey.eligible_students)
                        : 0}
                    </td>


                    {/* Responses */}

                    <td className="px-3 py-3.5 text-center text-sm font-medium text-[#263D32]">
                      {Number.isFinite(Number(survey.responses))
                        ? Number(survey.responses)
                        : 0}
                    </td>


                    {/* Response Rate */}

                    <td className="px-3 py-3.5 text-center text-sm font-medium text-[#263D32]">
                      {survey.response_rate === null
                        ? 'No eligible students'
                        : Number.isFinite(Number(survey.response_rate))
                          ? `${Number(survey.response_rate)}%`
                          : '—'}
                    </td>


                    {/* Status */}

                    <td className="px-3 py-3.5 text-center">

                      <StatusBadge
                        status={getDisplayStatus(survey)}
                      />

                    </td>


                    {/* STICKY ACTIONS COLUMN */}

                    <td className="sticky right-0 z-10 bg-white px-2 py-3.5 shadow-[-5px_0_8px_rgba(0,0,0,0.04)] transition group-hover:bg-[#F8FAF8]">

                      <div className="flex items-center justify-center gap-1.5">

                        {/* View Button */}

                        <button
                          type="button"
                          disabled={pendingActionId !== null}
                          onClick={() =>
                            handleViewSurvey(survey.survey_id)
                          }
                          title="View survey"
                          aria-label={`View ${survey.title}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E1E5E8] text-[#064D38] shadow-sm transition hover:bg-[#E8F2EC]"
                        >

                          <Eye size={17} />

                        </button>


                        {/* Edit Button */}

                        <button
                          type="button"
                          disabled={pendingActionId !== null}
                          onClick={() => {
                            setOpenMenu(null);
                            navigate(`/admin/surveys/${survey.survey_id}/edit`);
                          }}
                          title="Edit survey"
                          aria-label={`Edit ${survey.title}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E1E5E8] text-[#064D38] shadow-sm transition hover:bg-[#E8F2EC] disabled:cursor-not-allowed disabled:opacity-50"
                        >

                          <Pencil size={17} />

                        </button>


                        {/* More Actions */}

                        <div
                          className="relative"
                          data-survey-actions-menu
                        >

                          <button
                            type="button"
                            disabled={pendingActionId !== null}
                            onClick={(event) =>
                              toggleActionsMenu(event, survey.survey_id)
                            }
                            title="More actions"
                            aria-label={`More actions for ${survey.title}`}
                            aria-expanded={openMenu?.surveyId === survey.survey_id}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E1E5E8] text-[#064D38] shadow-sm transition hover:bg-[#E8F2EC] disabled:cursor-not-allowed disabled:opacity-50"
                          >

                            <MoreHorizontal size={18} />

                          </button>


                        </div>

                      </div>

                    </td>

                    {openMenu?.surveyId === survey.survey_id && createPortal(
                      <div
                        data-survey-actions-menu
                        role="menu"
                        aria-label={`Actions for ${survey.title}`}
                        className="z-[110] w-48 rounded-xl border border-[#E5E8E3] bg-white p-1 shadow-lg"
                        style={{
                          position: 'fixed',
                          top: openMenu.top,
                          left: openMenu.left
                        }}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          disabled={pendingActionId !== null}
                          onClick={() => {
                            setOpenMenu(null);
                            navigate(`/admin/surveys/${survey.survey_id}/questions`);
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#263D32] hover:bg-[#F1F5F1] disabled:opacity-50"
                        >
                          Manage Questions
                        </button>

                        {survey.status === 'Draft' && (
                          <button
                            type="button"
                            role="menuitem"
                            disabled={pendingActionId !== null}
                            onClick={() =>
                              handleStatusAction(survey, 'Published')
                            }
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#263D32] hover:bg-[#F1F5F1] disabled:opacity-50"
                          >
                            Publish Survey
                          </button>
                        )}

                        {survey.status === 'Published' && (
                          <button
                            type="button"
                            role="menuitem"
                            disabled={pendingActionId !== null}
                            onClick={() =>
                              handleStatusAction(survey, 'Closed')
                            }
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#263D32] hover:bg-[#F1F5F1] disabled:opacity-50"
                          >
                            Close Survey
                          </button>
                        )}

                        <button
                          type="button"
                          role="menuitem"
                          disabled={pendingActionId !== null}
                          onClick={() => handleDeleteSurvey(survey)}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete Survey
                        </button>
                      </div>,
                      document.body
                    )}

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>


        {/* ================================== */}
        {/* PAGINATION */}
        {/* ================================== */}

        <div className="flex flex-col justify-between gap-3 border-t border-[#E5E8E3] px-5 py-4 sm:flex-row sm:items-center">

          <p className="text-sm text-[#46554B]">

            Showing {firstResult} to {lastResult} of {filteredSurveys.length} surveys

          </p>


          <div className="flex flex-wrap items-center justify-end gap-1.5">

            {/* Previous */}

            <button
              disabled={safePage === 1 || loading}
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E5E8] text-[#263D32] transition hover:bg-[#F1F5F1] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >

              <ChevronLeft size={19} />

            </button>


            {/* Page Numbers */}

            {Array.from(
              { length: totalPages },
              (_, index) => index + 1
            ).map((page) => (

              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                disabled={loading}
                className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition ${
                  safePage === page
                    ? 'border-[#064D38] bg-[#064D38] text-white'
                    : 'border-[#E1E5E8] text-[#263D32] hover:bg-[#F1F5F1]'
                }`}
              >

                {page}

              </button>

            ))}


            {/* Next */}

            <button
              disabled={safePage === totalPages || loading}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1)
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E1E5E8] text-[#263D32] transition hover:bg-[#F1F5F1] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >

              <ChevronRight size={19} />

            </button>

          </div>

        </div>

      </div>


      {/* ================================== */}
      {/* SURVEY DETAILS MODAL */}
      {/* ================================== */}

      {(selectedSurvey !== null || detailsLoading || detailsError) && (

        <SurveyDetailsModal
          survey={selectedSurvey}
          loading={detailsLoading}
          error={detailsError}
          onEdit={() => {
            const surveyId = selectedSurvey?.survey_id;
            closeSurveyDetails();
            if (surveyId != null) {
              navigate(`/admin/surveys/${surveyId}/edit`);
            }
          }}
          onClose={closeSurveyDetails}
        />

      )}

    </div>

  );

}

export default ManageSurveys;
