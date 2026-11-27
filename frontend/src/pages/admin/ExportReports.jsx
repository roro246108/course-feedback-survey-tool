import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
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
  Star
} from 'lucide-react';
import '../../App.css';

const ANALYTICS_URL = 'http://localhost:5000/api/analytics';
const SEMESTER_URL = 'http://localhost:5000/api/semester-comparison/';

// The backend returns at most 50 comments per request
const COMMENT_LIMIT = 50;

const NO_FILTERS = {
  courseId: 'all',
  instructorId: 'all',
  semesterId: 'all'
};

const FILTER_LABELS = {
  courseId: 'Course',
  instructorId: 'Instructor',
  semesterId: 'Semester'
};

// ---------- Helpers (same logic as the other Analytics pages) ----------

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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

async function fetchJson(url) {
  let response;

  try {
    response = await fetch(url);
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
    throw new Error(result?.message || 'Unable to retrieve report data.');
  }

  return result;
}

// CSV export built from the data returned by the API
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

function ratingText(value) {
  const rating = toNumber(value);
  return rating === null ? 'No ratings' : rating.toFixed(2);
}

// ---------- Report definitions ----------
// Each report uses one existing GET endpoint. "apiFilters" are sent to the API;
// "listFilters" narrow the returned list on the page (same as Analytics Overview).

const REPORTS = [
  {
    id: 'courses',
    title: 'Course performance',
    description: 'Responses, rating answers and average rating for each course.',
    icon: BookOpen,
    // Data source: GET /api/analytics/course-performance
    apiFilters: ['semesterId', 'instructorId'],
    listFilters: ['courseId'],
    listNote: 'Choosing a course shows only that course in this report.',
    file: 'course-performance',
    url: filters => `${ANALYTICS_URL}/course-performance${buildQuery(filters)}`,
    toRows: result => (result.data || [])
      .map(row => ({ ...row, key: row.course_id }))
      .sort((a, b) => String(a.course_code).localeCompare(String(b.course_code))),
    narrow: (rows, filters) => filters.courseId === 'all'
      ? rows
      : rows.filter(row => String(row.course_id) === filters.courseId),
    columns: [
      { label: 'Course code', value: row => row.course_code },
      { label: 'Course name', value: row => row.course_name },
      { label: 'Feedback responses', value: row => Number(row.total_submissions || 0), num: true },
      { label: 'Rating answers', value: row => Number(row.rating_answers || 0), num: true },
      { label: 'Average rating (out of 5)', value: row => ratingText(row.average_rating), num: true }
    ]
  },
  {
    id: 'instructors',
    title: 'Instructor performance',
    description: 'Course offerings, responses and average rating for each instructor.',
    icon: GraduationCap,
    // Data source: GET /api/analytics/instructor-performance
    apiFilters: ['semesterId', 'courseId'],
    listFilters: ['instructorId'],
    listNote: 'Choosing an instructor shows only that instructor in this report.',
    file: 'instructor-performance',
    url: filters => `${ANALYTICS_URL}/instructor-performance${buildQuery(filters)}`,
    toRows: result => (result.data || [])
      .map(row => ({ ...row, key: row.instructor_id }))
      .sort((a, b) => String(a.instructor_name).localeCompare(String(b.instructor_name))),
    narrow: (rows, filters) => filters.instructorId === 'all'
      ? rows
      : rows.filter(row => String(row.instructor_id) === filters.instructorId),
    columns: [
      { label: 'Instructor', value: row => row.instructor_name },
      { label: 'Course offerings', value: row => Number(row.total_courses || 0), num: true },
      { label: 'Feedback responses', value: row => Number(row.total_submissions || 0), num: true },
      { label: 'Rating answers', value: row => Number(row.rating_answers || 0), num: true },
      { label: 'Average rating (out of 5)', value: row => ratingText(row.average_rating), num: true }
    ]
  },
  {
    id: 'response-rates',
    title: 'Response rates',
    description: 'Students who took part compared with students enrolled, per published or closed survey.',
    icon: Percent,
    // Data source: GET /api/analytics/response-rates
    apiFilters: ['courseId', 'semesterId', 'instructorId'],
    listFilters: [],
    file: 'response-rates',
    url: filters => `${ANALYTICS_URL}/response-rates${buildQuery(filters)}`,
    toRows: result => (result.data || []).map(row => ({ ...row, key: row.survey_id })),
    columns: [
      { label: 'Course code', value: row => row.course_code },
      { label: 'Course name', value: row => row.course_name },
      { label: 'Semester', value: row => semesterLabel(row) },
      { label: 'Survey', value: row => row.survey_title },
      { label: 'Status', value: row => row.status },
      { label: 'Participated students', value: row => Number(row.participated_students || 0), num: true },
      { label: 'Enrolled students', value: row => Number(row.enrolled_students || 0), num: true },
      {
        label: 'Response rate (%)',
        value: row => (row.response_rate === null ? 'No enrolled students' : row.response_rate),
        num: true
      }
    ]
  },
  {
    id: 'distribution',
    title: 'Rating distribution',
    description: 'Number of rating answers for each score from 1 to 5.',
    icon: Star,
    // Data source: GET /api/analytics/rating-distribution
    apiFilters: ['courseId', 'semesterId', 'instructorId'],
    listFilters: [],
    file: 'rating-distribution',
    url: filters => `${ANALYTICS_URL}/rating-distribution${buildQuery(filters)}`,
    toRows: result => {
      const rows = result.data || [];
      const total = rows.reduce((sum, row) => sum + Number(row.count || 0), 0);

      return [...rows]
        .sort((a, b) => b.rating - a.rating)
        .map(row => ({
          ...row,
          key: row.rating,
          share: total > 0 ? Math.round((Number(row.count) / total) * 1000) / 10 : null
        }));
    },
    // A distribution with no rating answers at all is reported as empty
    isEmpty: rows => rows.every(row => Number(row.count || 0) === 0),
    columns: [
      { label: 'Rating', value: row => row.rating, num: true },
      { label: 'Answers', value: row => Number(row.count || 0), num: true },
      { label: 'Share of rating answers (%)', value: row => (row.share === null ? '' : row.share), num: true }
    ]
  },
  {
    id: 'semesters',
    title: 'Semester trend',
    description: 'Results for each semester in order, with the change in average rating.',
    icon: CalendarDays,
    // Data source: GET /api/semester-comparison/
    apiFilters: ['courseId', 'instructorId'],
    listFilters: [],
    unsupportedNote: 'This report compares all semesters, so it is not filtered by semester.',
    file: 'semester-trend',
    url: filters => `${SEMESTER_URL}${buildQuery(filters)}`,
    toRows: result => {
      const semesters = result.data || [];

      return semesters.map((semester, index) => {
        const rating = toNumber(semester.average_rating);

        // Closest earlier semester that has ratings (same rule as Semester Comparison)
        const previous = semesters
          .slice(0, index)
          .reverse()
          .find(item => toNumber(item.average_rating) !== null);

        const change = rating !== null && previous
          ? rating - toNumber(previous.average_rating)
          : null;

        return {
          ...semester,
          key: semester.semester_id,
          change,
          previousName: change !== null ? previous.semester_name : null
        };
      });
    },
    columns: [
      { label: 'Semester', value: row => row.semester_name },
      { label: 'Academic year', value: row => row.academic_year },
      { label: 'Course offerings', value: row => Number(row.course_offerings || 0), num: true },
      { label: 'Feedback responses', value: row => Number(row.total_submissions || 0), num: true },
      { label: 'Rating answers', value: row => Number(row.total_ratings || 0), num: true },
      { label: 'Average rating (out of 5)', value: row => ratingText(row.average_rating), num: true },
      {
        label: 'Change vs previous rated semester',
        value: row => (row.change === null ? '' : row.change.toFixed(2)),
        num: true
      }
    ]
  },
  {
    id: 'comments',
    title: 'Anonymous comments',
    description: `The ${COMMENT_LIMIT} most recent written comments, with no student identity.`,
    icon: MessageSquare,
    // Data source: GET /api/analytics/recent-feedback
    apiFilters: ['courseId', 'semesterId'],
    listFilters: [],
    unsupportedNote: 'Comments are filtered by course and semester only, to protect anonymity.',
    file: 'anonymous-comments',
    url: filters => `${ANALYTICS_URL}/recent-feedback${buildQuery({ ...filters, limit: COMMENT_LIMIT })}`,
    toRows: result => (result.data || []).map(row => ({ ...row, key: row.answer_id })),
    columns: [
      {
        label: 'Submitted at',
        value: row => (row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '')
      },
      { label: 'Course', value: row => row.course_name },
      { label: 'Semester', value: row => semesterLabel(row) },
      { label: 'Comment', value: row => row.text_answer, wide: true }
    ]
  }
];

function supportedFilters(report) {
  return [...report.apiFilters, ...report.listFilters];
}

// Only the filters this report can use
function effectiveFilters(report, filters) {
  return supportedFilters(report).reduce(
    (result, key) => ({ ...result, [key]: filters[key] }),
    {}
  );
}

// ---------- Presentational components ----------

function PanelHead({ title, subtitle, children }) {
  return (
    <header className="rpt-panel-head">
      <div>
        <h2 className="rpt-panel-title">{title}</h2>
        {subtitle && <p className="rpt-panel-sub">{subtitle}</p>}
      </div>

      {children && <div className="rpt-panel-actions">{children}</div>}
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

function ExportReports() {
  const [reportId, setReportId] = useState(REPORTS[0].id);
  const [filters, setFilters] = useState(NO_FILTERS);

  // Filter option lists (real courses, instructors and semesters)
  const [courseOptions, setCourseOptions] = useState([]);
  const [instructorOptions, setInstructorOptions] = useState([]);
  const [semesterOptions, setSemesterOptions] = useState([]);
  const [optionsError, setOptionsError] = useState('');

  // The selected report
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [downloaded, setDownloaded] = useState(null);
  const latestRequest = useRef(0);

  const report = REPORTS.find(item => item.id === reportId) || REPORTS[0];

  const loadOptions = async () => {
    try {
      setOptionsError('');

      const [courseResult, instructorResult, semesterResult] = await Promise.all([
        fetchJson(`${ANALYTICS_URL}/course-performance`),
        fetchJson(`${ANALYTICS_URL}/instructor-performance`),
        fetchJson(`${ANALYTICS_URL}/semester-comparison`)
      ]);

      setCourseOptions(
        [...(courseResult.data || [])].sort((a, b) =>
          String(a.course_code).localeCompare(String(b.course_code))
        )
      );
      setInstructorOptions(
        [...(instructorResult.data || [])].sort((a, b) =>
          String(a.instructor_name).localeCompare(String(b.instructor_name))
        )
      );
      setSemesterOptions(semesterResult.data || []);
    } catch (err) {
      console.error('Report filter options error:', err);
      setOptionsError(err.message || 'Unable to load the filter lists.');
    }
  };

  // Fetch the selected report with the filters it supports
  const loadReport = async (nextReport, nextFilters) => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    const apiParams = nextReport.apiFilters.reduce(
      (result, key) => ({ ...result, [key]: nextFilters[key] }),
      {}
    );

    setLoading(true);
    setError('');
    setDownloaded(null);

    try {
      const result = await fetchJson(nextReport.url(apiParams));

      // Ignore answers that arrive after a newer selection
      if (latestRequest.current !== requestId) return;

      setRows(nextReport.toRows(result));
      setMeta(result.meta || null);
      setLastUpdated(new Date());
    } catch (err) {
      if (latestRequest.current !== requestId) return;
      console.error('Report error:', err);
      setRows([]);
      setMeta(null);
      setError(err.message || 'Unable to load this report.');
    } finally {
      if (latestRequest.current === requestId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadOptions();
    loadReport(REPORTS[0], NO_FILTERS);
  }, []);

  const chooseReport = id => {
    const nextReport = REPORTS.find(item => item.id === id) || REPORTS[0];
    setReportId(nextReport.id);
    loadReport(nextReport, filters);
  };

  const updateFilter = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    setDownloaded(null);

    // Filters this report applies on the page do not need a new request
    if (report.apiFilters.includes(key)) {
      loadReport(report, nextFilters);
    }
  };

  const clearFilters = () => {
    setFilters(NO_FILTERS);
    loadReport(report, NO_FILTERS);
  };

  const refresh = () => {
    loadOptions();
    loadReport(report, filters);
  };

  // ----- What is shown and exported -----
  const applied = effectiveFilters(report, filters);
  const visibleRows = report.narrow ? report.narrow(rows, applied) : rows;
  const commentsHidden = report.id === 'comments' && meta?.commentsHidden === true;
  const isEmpty = visibleRows.length === 0 || (report.isEmpty && report.isEmpty(visibleRows));
  const canDownload = !loading && !error && !commentsHidden && !isEmpty;

  const selectedCourse = courseOptions.find(item => String(item.course_id) === applied.courseId) || null;
  const selectedInstructor = instructorOptions.find(item => String(item.instructor_id) === applied.instructorId) || null;
  const selectedSemester = semesterOptions.find(item => String(item.semester_id) === applied.semesterId) || null;

  const scopeParts = [
    selectedCourse && selectedCourse.course_code,
    selectedInstructor && selectedInstructor.instructor_name,
    selectedSemester && semesterLabel(selectedSemester)
  ].filter(Boolean);

  const scopeLabel = scopeParts.join(' · ');
  const anyFilterSet = Object.values(filters).some(value => value !== 'all');

  const fileScope = scopeLabel
    ? `-${scopeLabel.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '').toLowerCase()}`
    : '';
  const filename = `${report.file}${fileScope}-${dateStamp()}.csv`;

  const exportReport = () => {
    if (!canDownload) return;

    downloadCsv(
      filename,
      report.columns.map(column => column.label),
      visibleRows.map(row => report.columns.map(column => column.value(row)))
    );

    setDownloaded({ filename, rows: visibleRows.length });
  };

  // A filter is disabled when this report cannot use it
  const filterField = (key, id, options, optionLabel, optionValue) => {
    const supported = supportedFilters(report).includes(key);

    return (
      <SelectField
        id={id}
        label={FILTER_LABELS[key]}
        value={supported ? (options.some(item => String(optionValue(item)) === filters[key]) ? filters[key] : 'all') : 'na'}
        onChange={value => updateFilter(key, value)}
        disabled={!supported || options.length === 0}
        hint={supported ? null : 'Not used by this report'}
      >
        {supported ? (
          <>
            <option value="all">All {FILTER_LABELS[key].toLowerCase()}s</option>
            {options.map(item => (
              <option key={optionValue(item)} value={String(optionValue(item))}>
                {optionLabel(item)}
              </option>
            ))}
          </>
        ) : (
          <option value="na">Not available</option>
        )}
      </SelectField>
    );
  };

  return (
    <div className="rpt-page">

      {/* HEADER CARD */}
      <section className="rpt-hero" aria-labelledby="er-title">
        <div className="rpt-hero-top">
          <div className="rpt-hero-main">
            <p className="rpt-hero-eyebrow">
              <FileSpreadsheet size={15} />
              Analytics &amp; Reporting
            </p>

            <h1 id="er-title" className="rpt-hero-title">
              Export <span>Reports</span>
            </h1>

            <p className="rpt-hero-text">
              Choose a report, filter it by course, instructor or semester, check the exact rows
              in the preview and download them as a CSV file.
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
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw size={17} />
              {loading ? 'Refreshing…' : 'Refresh data'}
            </button>
          </div>
        </div>

        <p className="rpt-hero-note">
          All reports are built from live data. Exports contain aggregated counts and anonymous
          comments only, never student identities.
        </p>
      </section>

      {/* STEP 1: REPORT TYPE */}
      <section className="rpt-panel" aria-labelledby="er-step1">
        <PanelHead
          title={<span id="er-step1">1. Choose a report</span>}
          subtitle="Pick the report you want to export. Each card lists the filters it supports."
        />

        <div className="rpt-report-grid" role="radiogroup" aria-labelledby="er-step1">
          {REPORTS.map(item => {
            const Icon = item.icon;
            const selected = item.id === report.id;

            return (
              <label
                key={item.id}
                className={`rpt-report-option${selected ? ' is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="report-type"
                  className="rpt-sr-only"
                  value={item.id}
                  checked={selected}
                  onChange={() => chooseReport(item.id)}
                />
                <span className="rpt-report-option-icon">
                  <Icon size={18} />
                </span>
                <span className="rpt-report-option-copy">
                  <span className="rpt-report-option-title">{item.title}</span>
                  <span className="rpt-report-option-text">{item.description}</span>
                  <span className="rpt-report-option-filters">
                    Filters: {supportedFilters(item).map(key => FILTER_LABELS[key]).join(', ')}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* STEP 2: FILTERS */}
      <section className="rpt-filters" aria-labelledby="er-step2">
        <div className="rpt-filters-head">
          <span className="rpt-filters-icon">
            <Filter size={18} />
          </span>

          <div className="rpt-filters-copy">
            <h2 id="er-step2" className="rpt-filters-title">
              2. Filter the report
            </h2>
            <p className="rpt-filters-sub">
              Only the filters that the selected report supports can be used.
            </p>
          </div>

          {anyFilterSet && (
            <button type="button" className="rpt-btn rpt-btn-ghost" onClick={clearFilters}>
              <RotateCcw size={15} />
              Clear filters
            </button>
          )}
        </div>

        <div className="rpt-filter-grid">
          {filterField(
            'courseId',
            'er-course-filter',
            courseOptions,
            course => `${course.course_code} — ${course.course_name}`,
            course => course.course_id
          )}
          {filterField(
            'instructorId',
            'er-instructor-filter',
            instructorOptions,
            instructor => instructor.instructor_name,
            instructor => instructor.instructor_id
          )}
          {filterField(
            'semesterId',
            'er-semester-filter',
            semesterOptions,
            semester => semesterLabel(semester),
            semester => semester.semester_id
          )}
        </div>

        {scopeLabel && (
          <p className="rpt-scope">
            <Filter size={14} />
            Report for <strong>{scopeLabel}</strong>
            {loading && <span className="rpt-scope-loading">Updating…</span>}
          </p>
        )}

        {(optionsError || report.unsupportedNote || report.listNote) && (
          <p className="rpt-note">
            <Info size={14} />
            {optionsError || [report.unsupportedNote, report.listNote].filter(Boolean).join(' ')}
          </p>
        )}
      </section>

      {/* ERROR */}
      {error && (
        <div className="rpt-alert" role="alert">
          <AlertCircle size={20} />
          <div className="rpt-alert-body">
            <p className="rpt-alert-title">Unable to load this report</p>
            <p className="rpt-alert-text">{error}</p>
          </div>
          <button
            type="button"
            className="rpt-btn rpt-btn-secondary"
            onClick={() => loadReport(report, filters)}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      )}

      {/* STEP 3: PREVIEW AND DOWNLOAD */}
      <section className="rpt-panel" aria-labelledby="er-step3">
        <PanelHead
          title={<span id="er-step3">3. Preview and download: {report.title}</span>}
          subtitle={report.description}
        >
          <button
            type="button"
            className="rpt-btn rpt-btn-solid"
            onClick={exportReport}
            disabled={!canDownload}
          >
            <Download size={16} />
            Download CSV
          </button>
        </PanelHead>

        <dl className="rpt-export-meta">
          <div>
            <dt>Rows</dt>
            <dd>{loading || commentsHidden || isEmpty ? '—' : visibleRows.length}</dd>
          </div>
          <div>
            <dt>File name</dt>
            <dd>{filename}</dd>
          </div>
          <div>
            <dt>Filters applied</dt>
            <dd>{scopeLabel || 'None (all data)'}</dd>
          </div>
        </dl>

        {downloaded && (
          <p className="rpt-notice" role="status">
            <CheckCircle2 size={16} />
            Downloaded <strong>{downloaded.filename}</strong> with {downloaded.rows}{' '}
            {downloaded.rows === 1 ? 'row' : 'rows'}.
          </p>
        )}

        {loading ? (
          <LoadingRows />
        ) : error ? (
          <StateMessage
            icon={AlertCircle}
            title="Report unavailable"
            text="The report could not be loaded. Use Try again above."
          />
        ) : commentsHidden ? (
          <StateMessage
            icon={EyeOff}
            title="Comments hidden to protect anonymity"
            text={`This selection has ${meta.groupResponses} ${meta.groupResponses === 1 ? 'response' : 'responses'}. Comments can only be viewed or exported for groups with at least ${meta.minimumResponses} responses.`}
          />
        ) : isEmpty ? (
          <StateMessage
            icon={report.icon}
            title="No data for this selection"
            text={scopeLabel
              ? 'Nothing matches the selected filters. Try a different course, instructor or semester.'
              : 'This report has no data yet.'}
          />
        ) : (
          <div className="rpt-table-wrap">
            <table className="rpt-table is-wide">
              <thead>
                <tr>
                  {report.columns.map(column => (
                    <th key={column.label} scope="col" className={column.num ? 'is-num' : ''}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => (
                  <tr key={row.key}>
                    {report.columns.map(column => (
                      <td
                        key={column.label}
                        className={column.num ? 'is-num' : column.wide ? 'rpt-cell-wide' : ''}
                      >
                        {column.value(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="rpt-note">
          <Info size={14} />
          <span>
            The CSV contains exactly the rows shown above. The overall summary report is on{' '}
            <Link className="rpt-inline-link" to="/admin/reports">Analytics Overview</Link>, and
            head-to-head semester comparisons are on{' '}
            <Link className="rpt-inline-link" to="/admin/reports/semesters">Semester Comparison</Link>.
          </span>
        </p>
      </section>

    </div>
  );
}

export default ExportReports;
