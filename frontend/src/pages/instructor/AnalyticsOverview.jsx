import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Clock3,
  Download,
  EyeOff,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  Info,
  MessageSquare,
  Percent,
  RefreshCw,
  RotateCcw,
  Star,
  TrendingUp,
  Users
} from 'lucide-react';
import '../../App.css';

const API_URL = 'http://localhost:5000/api/analytics';

// Number of recent comments requested from the API
const COMMENT_LIMIT = 10;

const NO_FILTERS = {
  courseId: 'all',
  instructorId: 'all',
  semesterId: 'all'
};

// ---------- Helpers ----------

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatRating(value) {
  const rating = toNumber(value);
  return rating === null ? '—' : rating.toFixed(2);
}

// The trend API returns plain 'YYYY-MM-DD' dates. Build the date from its parts
// so it is shown as that calendar day in every timezone (no UTC shift).
function parseCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  return match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
}

function formatDay(date) {
  return parseCalendarDate(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

function formatTime(date) {
  return date
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';
}

function semesterLabel(semester) {
  if (!semester) return '';
  return semester.academic_year
    ? `${semester.semester_name} ${semester.academic_year}`
    : semester.semester_name;
}

function hasActiveFilters(filters) {
  return Object.values(filters).some(value => value !== 'all');
}

// Query string with only the filters that are set
function buildQuery(params) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '' && value !== 'all') {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

const SERVER_UNREACHABLE =
  'The analytics server could not be reached. Please make sure the backend is running, then try again.';

async function fetchJson(path, apiFetch) {
  let response;

  try {
    response = await apiFetch(`${API_URL}/${path}`);
  } catch {
    // fetch only throws when no response arrives (server stopped or offline)
    throw new Error(SERVER_UNREACHABLE);
  }

  let result = null;

  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || 'Unable to retrieve analytics data.');
  }

  return result;
}

function sortRows(rows, nameKey, sortBy) {
  return [...rows].sort((a, b) => {
    if (sortBy === 'responses') {
      return Number(b.total_submissions || 0) - Number(a.total_submissions || 0);
    }

    if (sortBy === 'name') {
      return String(a[nameKey] || '').localeCompare(String(b[nameKey] || ''));
    }

    const ratingA = toNumber(a.average_rating);
    const ratingB = toNumber(b.average_rating);

    // Rating sorts: entries without ratings always go last
    if (ratingA === null && ratingB === null) return 0;
    if (ratingA === null) return 1;
    if (ratingB === null) return -1;

    // 'lowest' = ascending; 'rating' (default) = descending
    return sortBy === 'lowest' ? ratingA - ratingB : ratingB - ratingA;
  });
}

// CSV export built from the data already returned by the API
function csvCell(value) {
  if (value === null || value === undefined) return '';

  let text = String(value);

  // Prevent spreadsheet formula injection from text values
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map(row => row.map(csvCell).join(','))
    .join('\r\n');

  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Small presentational components ----------

function RatingMeter({ rating }) {
  const width = rating === null ? 0 : Math.min(Math.max(rating, 0), 5) * 20;

  return (
    <span className="rpt-meter" aria-hidden="true">
      <span className="rpt-meter-fill" style={{ width: `${width}%` }} />
    </span>
  );
}

function RatingCell({ value }) {
  const rating = toNumber(value);

  if (rating === null) {
    return <span className="rpt-pill is-neutral">No ratings yet</span>;
  }

  return (
    <div className="rpt-rating">
      <span className="rpt-rating-value">
        {rating.toFixed(2)}
        <span className="rpt-rating-scale">/ 5</span>
      </span>
      <RatingMeter rating={rating} />
    </div>
  );
}

function StatCard({ label, value, decimals = 0, suffix = '', hint, icon: Icon, tone, loading, rating = false }) {
  const numeric = toNumber(value);
  const hasValue = !loading && numeric !== null;

  return (
    <article className={`rpt-stat ${tone}`}>
      <div className="rpt-stat-top">
        <span className="rpt-stat-icon">
          <Icon size={20} strokeWidth={1.9} />
        </span>
        <span className="rpt-stat-label">{label}</span>
      </div>

      <p className="rpt-stat-value">
        {loading ? (
          <span className="rpt-skeleton rpt-skeleton-value" />
        ) : hasValue ? (
          numeric.toFixed(decimals)
        ) : (
          '—'
        )}
        {hasValue && suffix && <span className="rpt-stat-suffix">{suffix}</span>}
      </p>

      {rating && hasValue && <RatingMeter rating={numeric} />}

      <p className="rpt-stat-hint">{hint}</p>
    </article>
  );
}

function PanelHead({ title, subtitle, filtered = false, children }) {
  return (
    <header className="rpt-panel-head">
      <div>
        <h2 className="rpt-panel-title">{title}</h2>
        {subtitle && <p className="rpt-panel-sub">{subtitle}</p>}
      </div>

      {(filtered || children) && (
        <div className="rpt-panel-actions">
          {filtered && <span className="rpt-pill is-filtered">Filtered</span>}
          {children}
        </div>
      )}
    </header>
  );
}

function StateMessage({ icon: Icon, title, text }) {
  return (
    <div className="rpt-state">
      <span className="rpt-state-icon">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <p className="rpt-state-title">{title}</p>
      {text && <p className="rpt-state-text">{text}</p>}
    </div>
  );
}

function LoadingRows({ rows = 4 }) {
  return (
    <div className="rpt-loading" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="rpt-skeleton rpt-skeleton-row" />
      ))}
    </div>
  );
}

function SelectField({ id, label, value, onChange, disabled, hint, children }) {
  return (
    <div className="rpt-field">
      <label className="rpt-label" htmlFor={id}>
        {label}
      </label>

      <div className="rpt-select-wrap">
        <select
          id={id}
          className="rpt-select"
          value={value}
          onChange={event => onChange(event.target.value)}
          disabled={disabled}
        >
          {children}
        </select>

        <svg className="rpt-select-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {hint && <p className="rpt-field-hint">{hint}</p>}
    </div>
  );
}

// ---------- Page ----------

function AnalyticsOverview() {
  const { apiFetch, user } = useAuth();
  const reportBase = user?.role === 'Instructor' ? '/instructor/reports' : '/admin/reports';
  // Unfiltered data (also used for the filter option lists)
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [commentsMeta, setCommentsMeta] = useState(null);
  const [distribution, setDistribution] = useState([]);
  const [responseRates, setResponseRates] = useState([]);
  const [semesters, setSemesters] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Filters are sent to the API; the filtered reports replace the unfiltered ones
  const [filters, setFilters] = useState(NO_FILTERS);
  const [filteredReports, setFilteredReports] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const reportRequest = useRef(0);

  // Fetch real analytics data (unfiltered)
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const endpoints = [
        'overview',
        'feedback-trends',
        'course-performance',
        'instructor-performance',
        `recent-feedback?limit=${COMMENT_LIMIT}`,
        'rating-distribution',
        'response-rates',
        'semester-comparison'
      ];

      const results = await Promise.all(endpoints.map(path => fetchJson(path, apiFetch)));

      setOverview(results[0].data);
      setTrends(results[1].data || []);
      setCourses(results[2].data || []);
      setInstructors(results[3].data || []);
      setRecentFeedback(results[4].data || []);
      setCommentsMeta(results[4].meta || null);
      setDistribution(results[5].data || []);
      setResponseRates(results[6].data || []);
      setSemesters(results[7].data || []);

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Analytics error:', err);
      setError(err.message || 'Something went wrong while loading analytics.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Fetch the reports that support filtering, using the selected filters
  const loadFilteredReports = async nextFilters => {
    const requestId = reportRequest.current + 1;
    reportRequest.current = requestId;

    if (!hasActiveFilters(nextFilters)) {
      setFilteredReports(null);
      setReportsError('');
      setReportsLoading(false);
      return;
    }

    const { courseId, semesterId, instructorId } = nextFilters;

    setReportsLoading(true);
    setReportsError('');

    try {
      const [courseResult, instructorResult, commentResult, distributionResult, rateResult] =
        await Promise.all([
          fetchJson(`course-performance${buildQuery({ semesterId, instructorId })}`, apiFetch),
          fetchJson(`instructor-performance${buildQuery({ semesterId, courseId })}`, apiFetch),
          fetchJson(`recent-feedback${buildQuery({ courseId, semesterId, limit: COMMENT_LIMIT })}`, apiFetch),
          fetchJson(`rating-distribution${buildQuery({ courseId, semesterId, instructorId })}`, apiFetch),
          fetchJson(`response-rates${buildQuery({ courseId, semesterId, instructorId })}`, apiFetch)
        ]);

      // Ignore answers that arrive after a newer filter change
      if (reportRequest.current !== requestId) return;

      setFilteredReports({
        courses: courseResult.data || [],
        instructors: instructorResult.data || [],
        comments: commentResult.data || [],
        commentsMeta: commentResult.meta || null,
        distribution: distributionResult.data || [],
        responseRates: rateResult.data || []
      });
    } catch (err) {
      if (reportRequest.current !== requestId) return;
      console.error('Filtered analytics error:', err);
      setReportsError(err.message || 'Unable to apply the filters.');
    } finally {
      if (reportRequest.current === requestId) {
        setReportsLoading(false);
      }
    }
  };

  const updateFilter = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    loadFilteredReports(nextFilters);
  };

  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setSortBy('rating');
    loadFilteredReports(NO_FILTERS);
  };

  const refreshAll = async () => {
    await fetchAnalytics();
    await loadFilteredReports(filters);
  };

  // Data shown in the filterable panels
  const reports = filteredReports ?? {
    courses,
    instructors,
    comments: recentFeedback,
    commentsMeta,
    distribution,
    responseRates
  };

  const filtersActive = hasActiveFilters(filters);
  const panelsLoading = loading || reportsLoading;

  const selectedCourse = filters.courseId === 'all'
    ? null
    : courses.find(course => String(course.course_id) === filters.courseId) || null;

  const selectedInstructor = filters.instructorId === 'all'
    ? null
    : instructors.find(item => String(item.instructor_id) === filters.instructorId) || null;

  const selectedSemester = filters.semesterId === 'all'
    ? null
    : semesters.find(item => String(item.semester_id) === filters.semesterId) || null;

  const courseOptions = useMemo(() => sortRows(courses, 'course_name', 'name'), [courses]);
  const instructorOptions = useMemo(() => sortRows(instructors, 'instructor_name', 'name'), [instructors]);

  // The course table is narrowed to the selected course, the instructor table
  // to the selected instructor; the other filters are applied by the API.
  const visibleCourses = useMemo(
    () => sortRows(
      filters.courseId === 'all'
        ? reports.courses
        : reports.courses.filter(course => String(course.course_id) === filters.courseId),
      'course_name',
      sortBy
    ),
    [reports.courses, filters.courseId, sortBy]
  );

  const visibleInstructors = useMemo(
    () => sortRows(
      filters.instructorId === 'all'
        ? reports.instructors
        : reports.instructors.filter(item => String(item.instructor_id) === filters.instructorId),
      'instructor_name',
      sortBy
    ),
    [reports.instructors, filters.instructorId, sortBy]
  );

  const focusCourse = selectedCourse
    ? reports.courses.find(course => String(course.course_id) === filters.courseId) || null
    : null;

  const focusInstructor = selectedInstructor
    ? reports.instructors.find(item => String(item.instructor_id) === filters.instructorId) || null
    : null;

  const scopeLabel = [
    selectedCourse && selectedCourse.course_code,
    selectedInstructor && selectedInstructor.instructor_name,
    selectedSemester && semesterLabel(selectedSemester)
  ].filter(Boolean).join(' · ');

  // ----- Trend -----
  const trendTotal = trends.reduce(
    (sum, item) => sum + Number(item.total_submissions || 0),
    0
  );

  const maxTrend = Math.max(
    ...trends.map(item => Number(item.total_submissions || 0)),
    1
  );

  const hasTrendData = trendTotal > 0;

  const peakDay = hasTrendData
    ? trends.reduce((best, item) =>
        Number(item.total_submissions || 0) > Number(best.total_submissions || 0)
          ? item
          : best
      )
    : null;

  // ----- Rating distribution -----
  const distributionTotal = reports.distribution.reduce(
    (sum, item) => sum + Number(item.count || 0),
    0
  );

  const distributionMax = Math.max(
    ...reports.distribution.map(item => Number(item.count || 0)),
    1
  );

  // Highest rating first
  const distributionRows = [...reports.distribution].sort((a, b) => b.rating - a.rating);

  // ----- Downloadable reports -----
  const filterNote = scopeLabel ? `-${scopeLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` : '';

  const exportSummary = () => {
    downloadCsv(
      `analytics-summary-${dateStamp()}.csv`,
      ['Metric', 'Value'],
      [
        ['Total feedback responses', overview?.totalSubmissions ?? ''],
        ['Average rating (out of 5)', toNumber(overview?.averageRating)?.toFixed(2) ?? ''],
        ['Rating answers', overview?.totalRatingAnswers ?? ''],
        ['Written comments', overview?.totalTextAnswers ?? ''],
        ['Total courses', overview?.totalCourses ?? ''],
        ['Total instructors', overview?.totalInstructors ?? ''],
        ['Responses in the last 7 days', trendTotal],
        ['Generated at', new Date().toISOString()]
      ]
    );
  };

  const exportCourses = () => {
    downloadCsv(
      `course-performance${filterNote}-${dateStamp()}.csv`,
      ['Course code', 'Course name', 'Feedback responses', 'Rating answers', 'Average rating (out of 5)'],
      visibleCourses.map(course => [
        course.course_code,
        course.course_name,
        Number(course.total_submissions || 0),
        Number(course.rating_answers || 0),
        toNumber(course.average_rating)?.toFixed(2) ?? 'No ratings'
      ])
    );
  };

  const exportInstructors = () => {
    downloadCsv(
      `instructor-performance${filterNote}-${dateStamp()}.csv`,
      ['Instructor', 'Course offerings', 'Feedback responses', 'Rating answers', 'Average rating (out of 5)'],
      visibleInstructors.map(instructor => [
        instructor.instructor_name,
        Number(instructor.total_courses || 0),
        Number(instructor.total_submissions || 0),
        Number(instructor.rating_answers || 0),
        toNumber(instructor.average_rating)?.toFixed(2) ?? 'No ratings'
      ])
    );
  };

  const exportResponseRates = () => {
    downloadCsv(
      `response-rates${filterNote}-${dateStamp()}.csv`,
      ['Course code', 'Course name', 'Semester', 'Survey', 'Status', 'Participated students', 'Enrolled students', 'Response rate (%)'],
      reports.responseRates.map(row => [
        row.course_code,
        row.course_name,
        semesterLabel(row),
        row.survey_title,
        row.status,
        row.participated_students,
        row.enrolled_students,
        row.response_rate ?? ''
      ])
    );
  };

  const exportDistribution = () => {
    downloadCsv(
      `rating-distribution${filterNote}-${dateStamp()}.csv`,
      ['Rating', 'Answers', 'Share of rating answers (%)'],
      reports.distribution.map(row => [
        row.rating,
        row.count,
        distributionTotal > 0 ? Math.round((row.count / distributionTotal) * 1000) / 10 : ''
      ])
    );
  };

  const noData = loading || Boolean(error && !overview);
  const commentsHidden = reports.commentsMeta?.commentsHidden === true;

  return (
    <div className="rpt-page">

      {/* HEADER CARD WITH SUMMARY TILES */}
      <section className="rpt-hero" aria-labelledby="ao-title">
        <div className="rpt-hero-top">
          <div className="rpt-hero-main">
            <p className="rpt-hero-eyebrow">
              <BarChart3 size={15} />
              Analytics &amp; Reporting
            </p>

            <h1 id="ao-title" className="rpt-hero-title">
              Analytics <span>Overview</span>
            </h1>

            <p className="rpt-hero-text">
              Aggregated, anonymous student feedback across courses, instructors and
              semesters. Filter the results, review performance and download reports.
            </p>
          </div>

          <div className="rpt-hero-side">
            <div className="rpt-hero-meta">
              <span className="rpt-hero-meta-label">
                <Clock3 size={14} />
                Last updated
              </span>
              <span className="rpt-hero-meta-value">{formatTime(lastUpdated)}</span>
            </div>

            <button
              type="button"
              className="rpt-btn rpt-btn-primary"
              onClick={refreshAll}
              disabled={loading}
            >
              <RefreshCw size={17} />
              {loading ? 'Refreshing…' : 'Refresh data'}
            </button>
          </div>
        </div>

        <div className="rpt-stats">
          <StatCard
            label="Feedback responses"
            value={overview?.totalSubmissions}
            hint={overview && !loading
              ? `${overview.totalRatingAnswers} ratings · ${overview.totalTextAnswers} written comments`
              : 'Anonymous submissions with answers'}
            icon={MessageSquare}
            tone="is-sage"
            loading={loading}
          />

          <StatCard
            label="Average rating"
            value={overview?.averageRating}
            decimals={2}
            suffix="/ 5"
            hint={toNumber(overview?.averageRating) === null && !loading
              ? 'No ratings recorded yet'
              : 'Mean of all rating answers'}
            icon={Star}
            tone="is-beige"
            loading={loading}
            rating
          />

          <StatCard
            label="Courses"
            value={overview?.totalCourses}
            hint="Courses registered in the system"
            icon={BookOpen}
            tone="is-blue"
            loading={loading}
          />

          <StatCard
            label="Instructors"
            value={overview?.totalInstructors}
            hint="Instructors linked to courses"
            icon={GraduationCap}
            tone="is-mist"
            loading={loading}
          />
        </div>

        <p className="rpt-hero-note">
          Totals across all courses and semesters. A response is a submission with at least one
          rating or written answer.
        </p>
      </section>

      {/* ERROR */}
      {error && (
        <div className="rpt-alert" role="alert">
          <AlertCircle size={20} />
          <div className="rpt-alert-body">
            <p className="rpt-alert-title">Unable to load analytics</p>
            <p className="rpt-alert-text">{error}</p>
          </div>
          <button
            type="button"
            className="rpt-btn rpt-btn-secondary"
            onClick={refreshAll}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      )}

      {/* FILTERS */}
      <section className="rpt-filters" aria-labelledby="ao-filter-title">
        <div className="rpt-filters-head">
          <span className="rpt-filters-icon">
            <Filter size={18} />
          </span>

          <div className="rpt-filters-copy">
            <h2 id="ao-filter-title" className="rpt-filters-title">
              Filter results
            </h2>
            <p className="rpt-filters-sub">
              Filters apply to the reports below. The summary and 7-day trend always show all data.
            </p>
          </div>

          {(filtersActive || sortBy !== 'rating') && (
            <button type="button" className="rpt-btn rpt-btn-ghost" onClick={clearFilters}>
              <RotateCcw size={15} />
              Clear filters
            </button>
          )}
        </div>

        <div className="rpt-filter-grid">
          <SelectField
            id="ao-course-filter"
            label="Course"
            value={selectedCourse ? filters.courseId : 'all'}
            onChange={value => updateFilter('courseId', value)}
            disabled={noData || courses.length === 0}
          >
            <option value="all">All courses</option>
            {courseOptions.map(course => (
              <option key={course.course_id} value={String(course.course_id)}>
                {course.course_code} — {course.course_name}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="ao-instructor-filter"
            label="Instructor"
            value={selectedInstructor ? filters.instructorId : 'all'}
            onChange={value => updateFilter('instructorId', value)}
            disabled={noData || instructors.length === 0}
          >
            <option value="all">All instructors</option>
            {instructorOptions.map(instructor => (
              <option key={instructor.instructor_id} value={String(instructor.instructor_id)}>
                {instructor.instructor_name}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="ao-semester-filter"
            label="Semester"
            value={selectedSemester ? filters.semesterId : 'all'}
            onChange={value => updateFilter('semesterId', value)}
            disabled={noData || semesters.length === 0}
            hint={
              <>
                Trends over time:{' '}
                <Link className="rpt-inline-link" to={`${reportBase}/semesters`}>
                  Semester Comparison
                </Link>
              </>
            }
          >
            <option value="all">All semesters</option>
            {semesters.map(semester => (
              <option key={semester.semester_id} value={String(semester.semester_id)}>
                {semesterLabel(semester)}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="rpt-filter-bar">
          <SelectField
            id="ao-sort"
            label="Sort tables by"
            value={sortBy}
            onChange={setSortBy}
            disabled={noData}
          >
            <option value="rating">Highest average rating</option>
            <option value="lowest">Lowest average rating</option>
            <option value="responses">Most responses</option>
            <option value="name">Name (A–Z)</option>
          </SelectField>
        </div>

        {filtersActive && (
          <p className="rpt-scope">
            <Filter size={14} />
            Showing results for <strong>{scopeLabel}</strong>
            {reportsLoading && <span className="rpt-scope-loading">Updating…</span>}
          </p>
        )}

        {(selectedCourse || selectedInstructor) && !reportsLoading && (
          <div className="rpt-focus-list">
            {selectedCourse && (
              <div className="rpt-focus">
                <span className="rpt-focus-icon"><BookOpen size={17} /></span>
                <div>
                  <p className="rpt-focus-title">
                    {selectedCourse.course_name}
                    <span>{selectedCourse.course_code}</span>
                  </p>
                  <p className="rpt-focus-text">
                    {focusCourse ? (
                      <>
                        {focusCourse.total_submissions} responses · average rating{' '}
                        <strong>{formatRating(focusCourse.average_rating)}</strong> / 5
                      </>
                    ) : (
                      'No offering of this course matches the other filters.'
                    )}
                  </p>
                </div>
              </div>
            )}

            {selectedInstructor && (
              <div className="rpt-focus">
                <span className="rpt-focus-icon"><GraduationCap size={17} /></span>
                <div>
                  <p className="rpt-focus-title">{selectedInstructor.instructor_name}</p>
                  <p className="rpt-focus-text">
                    {focusInstructor ? (
                      <>
                        {focusInstructor.total_courses} course offerings ·{' '}
                        {focusInstructor.total_submissions} responses · average rating{' '}
                        <strong>{formatRating(focusInstructor.average_rating)}</strong> / 5
                      </>
                    ) : (
                      'This instructor has no offering that matches the other filters.'
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {reportsError && (
        <div className="rpt-alert" role="alert">
          <AlertCircle size={20} />
          <div className="rpt-alert-body">
            <p className="rpt-alert-title">Unable to apply the filters</p>
            <p className="rpt-alert-text">{reportsError}</p>
          </div>
          <button
            type="button"
            className="rpt-btn rpt-btn-secondary"
            onClick={() => loadFilteredReports(filters)}
            disabled={reportsLoading}
          >
            Try again
          </button>
        </div>
      )}

      {/* TREND + RATING DISTRIBUTION */}
      <div className="rpt-grid-main">
        <section className="rpt-panel">
          <PanelHead
            title="Submission trend"
            subtitle="Feedback responses per day over the last 7 days (all data, not filtered)."
          >
            {!loading && (
              <span className="rpt-pill is-soft">{trendTotal} responses</span>
            )}
          </PanelHead>

          {loading ? (
            <LoadingRows rows={3} />
          ) : trends.length > 0 ? (
            <>
              <div className="rpt-bars" role="list" aria-label="Daily feedback responses">
                {trends.map((item, index) => {
                  const count = Number(item.total_submissions || 0);
                  const height = count === 0 ? 0 : Math.max((count / maxTrend) * 100, 4);
                  const isPeak = peakDay === item;

                  return (
                    <div
                      key={`${item.submission_date}-${index}`}
                      className="rpt-bar-col"
                      role="listitem"
                    >
                      <span className={`rpt-bar-value${count === 0 ? ' is-zero' : ''}`}>{count}</span>
                      <div className="rpt-bar-track">
                        <div
                          className={`rpt-bar${isPeak ? ' is-peak' : ''}${count === 0 ? ' is-zero' : ''}`}
                          style={{ height: `${height}%` }}
                          title={`${formatDay(item.submission_date)}: ${count} responses`}
                        />
                      </div>
                      <span className="rpt-bar-label">{formatDay(item.submission_date)}</span>
                    </div>
                  );
                })}
              </div>

              <p className="rpt-panel-foot">
                {hasTrendData ? (
                  <>
                    Busiest day: <strong>{formatDay(peakDay.submission_date)}</strong> with{' '}
                    {Number(peakDay.total_submissions)} responses.
                  </>
                ) : (
                  'No responses were submitted in the last 7 days.'
                )}
              </p>
            </>
          ) : (
            <StateMessage
              icon={TrendingUp}
              title="Trend data unavailable"
              text="The daily trend could not be loaded."
            />
          )}
        </section>

        <section className="rpt-panel">
          <PanelHead
            title="Rating distribution"
            filtered={filtersActive}
            subtitle="Number of rating answers for each score."
          >
            <button
              type="button"
              className="rpt-btn rpt-btn-secondary rpt-btn-sm"
              onClick={exportDistribution}
              disabled={panelsLoading || distributionTotal === 0}
            >
              <Download size={15} />
              CSV
            </button>
          </PanelHead>

          {panelsLoading ? (
            <LoadingRows rows={5} />
          ) : distributionTotal > 0 ? (
            <>
              <ul className="rpt-hbars" aria-label="Rating answers by score">
                {distributionRows.map(row => {
                  const share = Math.round((row.count / distributionTotal) * 1000) / 10;

                  return (
                    <li key={row.rating} className="rpt-hbar">
                      <div className="rpt-hbar-head">
                        <span className="rpt-hbar-name">
                          {row.rating} {row.rating === 1 ? 'star' : 'stars'}
                        </span>
                        <span className="rpt-hbar-value">
                          {row.count}
                          <span className="rpt-hbar-share">{share}%</span>
                        </span>
                      </div>
                      <span className="rpt-hbar-track">
                        <span
                          className={`rpt-hbar-fill is-score-${row.rating}`}
                          style={{ width: `${(row.count / distributionMax) * 100}%` }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>

              <p className="rpt-panel-foot">
                Based on <strong>{distributionTotal}</strong> rating answers.
              </p>
            </>
          ) : (
            <StateMessage
              icon={Star}
              title="No rating answers"
              text={filtersActive
                ? 'No ratings match the selected filters.'
                : 'The distribution appears once students submit ratings.'}
            />
          )}
        </section>
      </div>

      {/* COURSE + INSTRUCTOR REPORTS */}
      <div className="rpt-grid-2">
        <section className="rpt-panel">
          <PanelHead
            title="Course performance"
            filtered={filtersActive}
            subtitle="Average rating and response count for each course."
          >
            <button
              type="button"
              className="rpt-btn rpt-btn-secondary rpt-btn-sm"
              onClick={exportCourses}
              disabled={panelsLoading || visibleCourses.length === 0}
            >
              <Download size={15} />
              CSV
            </button>
          </PanelHead>

          {panelsLoading ? (
            <LoadingRows />
          ) : visibleCourses.length > 0 ? (
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th scope="col" className="is-rank">#</th>
                    <th scope="col">Course</th>
                    <th scope="col" className="is-num">Responses</th>
                    <th scope="col">Average rating</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCourses.map((course, index) => (
                    <tr key={course.course_id}>
                      <td className="is-rank">{index + 1}</td>
                      <td>
                        <span className="rpt-cell-title">{course.course_name}</span>
                        <span className="rpt-cell-sub">{course.course_code}</span>
                      </td>
                      <td className="is-num">{Number(course.total_submissions || 0)}</td>
                      <td><RatingCell value={course.average_rating} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <StateMessage
              icon={BookOpen}
              title="No courses match"
              text={filtersActive
                ? 'No course offering matches the selected filters.'
                : 'Courses will appear here once they are added to the system.'}
            />
          )}

          {!panelsLoading && reports.courses.length > 0 && (
            <p className="rpt-panel-foot">
              Showing {visibleCourses.length} of {courses.length} courses
            </p>
          )}
        </section>

        <section className="rpt-panel">
          <PanelHead
            title="Instructor performance"
            filtered={filtersActive}
            subtitle="Aggregated feedback for each instructor."
          >
            <button
              type="button"
              className="rpt-btn rpt-btn-secondary rpt-btn-sm"
              onClick={exportInstructors}
              disabled={panelsLoading || visibleInstructors.length === 0}
            >
              <Download size={15} />
              CSV
            </button>
          </PanelHead>

          {panelsLoading ? (
            <LoadingRows />
          ) : visibleInstructors.length > 0 ? (
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th scope="col" className="is-rank">#</th>
                    <th scope="col">Instructor</th>
                    <th scope="col" className="is-num">Responses</th>
                    <th scope="col">Average rating</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInstructors.map((instructor, index) => (
                    <tr key={instructor.instructor_id}>
                      <td className="is-rank">{index + 1}</td>
                      <td>
                        <span className="rpt-cell-title">{instructor.instructor_name}</span>
                        <span className="rpt-cell-sub">
                          {Number(instructor.total_courses || 0)}{' '}
                          {Number(instructor.total_courses) === 1 ? 'course offering' : 'course offerings'}
                        </span>
                      </td>
                      <td className="is-num">{Number(instructor.total_submissions || 0)}</td>
                      <td><RatingCell value={instructor.average_rating} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <StateMessage
              icon={Users}
              title="No instructors match"
              text={filtersActive
                ? 'No instructor teaches an offering that matches the selected filters.'
                : 'Instructor results appear once instructors are linked to courses.'}
            />
          )}

          {!panelsLoading && reports.instructors.length > 0 && (
            <p className="rpt-panel-foot">
              Showing {visibleInstructors.length} of {instructors.length} instructors
            </p>
          )}
        </section>
      </div>

      {/* RESPONSE RATES */}
      <section className="rpt-panel">
        <PanelHead
          title="Response rates"
          filtered={filtersActive}
          subtitle="Students who took part compared with students enrolled, for published and closed surveys."
        >
          <button
            type="button"
            className="rpt-btn rpt-btn-secondary rpt-btn-sm"
            onClick={exportResponseRates}
            disabled={panelsLoading || reports.responseRates.length === 0}
          >
            <Download size={15} />
            CSV
          </button>
        </PanelHead>

        {panelsLoading ? (
          <LoadingRows />
        ) : reports.responseRates.length > 0 ? (
          <div className="rpt-table-wrap">
            <table className="rpt-table is-wide">
              <thead>
                <tr>
                  <th scope="col">Course</th>
                  <th scope="col">Semester</th>
                  <th scope="col">Survey</th>
                  <th scope="col" className="is-num">Took part</th>
                  <th scope="col">Response rate</th>
                </tr>
              </thead>
              <tbody>
                {reports.responseRates.map(row => (
                  <tr key={row.survey_id}>
                    <td>
                      <span className="rpt-cell-title">{row.course_name}</span>
                      <span className="rpt-cell-sub">{row.course_code}</span>
                    </td>
                    <td>{semesterLabel(row)}</td>
                    <td>
                      <span className="rpt-cell-title">{row.survey_title}</span>
                      <span className="rpt-cell-sub">{row.status}</span>
                    </td>
                    <td className="is-num">
                      {row.participated_students} / {row.enrolled_students}
                    </td>
                    <td>
                      {row.response_rate === null ? (
                        <span className="rpt-pill is-neutral">No enrolled students</span>
                      ) : (
                        <div className="rpt-rating">
                          <span className="rpt-rating-value">{row.response_rate}%</span>
                          <span className="rpt-meter" aria-hidden="true">
                            <span
                              className="rpt-meter-fill"
                              style={{ width: `${Math.min(row.response_rate, 100)}%` }}
                            />
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <StateMessage
            icon={Percent}
            title="No published or closed surveys"
            text={filtersActive
              ? 'No published or closed survey matches the selected filters.'
              : 'Response rates appear once surveys are published.'}
          />
        )}

        <p className="rpt-note">
          <Info size={14} />
          Only counts are shown. Participation records are never linked to the answers a student gave.
        </p>
      </section>

      {/* COMMENTS + DOWNLOADS */}
      <div className="rpt-grid-main">
        <section className="rpt-panel">
          <PanelHead
            title="Recent comments"
            filtered={filters.courseId !== 'all' || filters.semesterId !== 'all'}
            subtitle={`Latest anonymous written feedback (up to ${COMMENT_LIMIT}).`}
          />

          {panelsLoading ? (
            <LoadingRows rows={3} />
          ) : commentsHidden ? (
            <StateMessage
              icon={EyeOff}
              title="Comments hidden to protect anonymity"
              text={`This selection has ${reports.commentsMeta.groupResponses} ${reports.commentsMeta.groupResponses === 1 ? 'response' : 'responses'}. Written comments are only shown for groups with at least ${reports.commentsMeta.minimumResponses} responses. Ratings and totals above are still included.`}
            />
          ) : reports.comments.length > 0 ? (
            <ul className="rpt-feed">
              {reports.comments.map(feedback => (
                <li key={feedback.answer_id} className="rpt-feed-item">
                  <p className="rpt-feed-meta">
                    {[
                      feedback.submitted_at && new Date(feedback.submitted_at).toLocaleString(),
                      feedback.course_name || 'Course feedback',
                      feedback.semester_name && semesterLabel(feedback)
                    ].filter(Boolean).join(' · ')}
                  </p>
                  <p className="rpt-feed-text">{feedback.text_answer}</p>
                </li>
              ))}
            </ul>
          ) : (
            <StateMessage
              icon={MessageSquare}
              title="No comments"
              text={filtersActive
                ? 'No written comments match the selected course and semester.'
                : 'Written feedback will appear here once students submit it.'}
            />
          )}

          <p className="rpt-note">
            <Info size={14} />
            Comments are anonymous and filtered by course and semester only. No student identity is
            shown or stored with a response.
          </p>
        </section>

        <section className="rpt-panel is-dark">
          <PanelHead
            title="Download reports"
            subtitle="CSV files built from the data on this page. Course, instructor, response-rate and distribution reports are downloaded from the CSV button on each panel, using the current filters."
          />

          <div className="rpt-downloads">
            <button
              type="button"
              className="rpt-download"
              onClick={exportSummary}
              disabled={loading || !overview}
            >
              <span className="rpt-download-icon"><FileSpreadsheet size={18} /></span>
              <span className="rpt-download-copy">
                <span className="rpt-download-title">Summary report</span>
                <span className="rpt-download-text">Overall totals and average rating</span>
              </span>
              <Download size={16} className="rpt-download-arrow" />
            </button>
          </div>

          <Link className="rpt-link-field rpt-downloads-link" to={`${reportBase}/export`}>
            <span className="rpt-link-field-text">All reports with preview</span>
            <span className="rpt-link-field-cta">
              Export Reports
              <ArrowRight size={14} />
            </span>
          </Link>

          <Link className="rpt-link-field rpt-downloads-link" to={`${reportBase}/semesters`}>
            <span className="rpt-link-field-text">Compare semesters</span>
            <span className="rpt-link-field-cta">
              Open
              <ArrowRight size={14} />
            </span>
          </Link>
        </section>
      </div>

    </div>
  );
}

export default AnalyticsOverview;
