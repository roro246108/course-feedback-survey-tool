import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Clock3,
  Download,
  Filter,
  Info,
  LineChart,
  MessageSquare,
  Minus,
  RefreshCw,
  RotateCcw,
  Star,
  TrendingUp,
  Trophy
} from 'lucide-react';
import '../../App.css';

const API_URL = 'http://localhost:5000/api/semester-comparison/';

// Used only to fill the course and instructor filter lists
const ANALYTICS_URL = 'http://localhost:5000/api/analytics';

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

// Ratings are returned rounded to 2 decimals, so smaller differences are "no change"
const RATING_EPSILON = 0.005;

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

function formatTime(date) {
  return date
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';
}

function semesterLabel(semester) {
  if (!semester) return '';
  return semester.academic_year
    ? `${semester.semester_name} · ${semester.academic_year}`
    : semester.semester_name;
}

function getDirection(delta, epsilon = 0) {
  if (delta === null || delta === undefined) return null;
  if (delta > epsilon) return 'up';
  if (delta < -epsilon) return 'down';
  return 'flat';
}

function formatDelta(delta, decimals = 0) {
  if (delta === null) return '';
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${Math.abs(delta).toFixed(decimals)}`;
}

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

// ---------- Presentational components ----------

function RatingMeter({ rating }) {
  const width = rating === null ? 0 : Math.min(Math.max(rating, 0), 5) * 20;

  return (
    <span className="rpt-meter" aria-hidden="true">
      <span className="rpt-meter-fill" style={{ width: `${width}%` }} />
    </span>
  );
}

function DeltaBadge({ delta, decimals = 0, unit = '', epsilon = 0 }) {
  const direction = getDirection(delta, epsilon);

  if (direction === null) {
    return <span className="rpt-pill is-neutral">Not comparable</span>;
  }

  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const label = direction === 'up' ? 'Increase' : direction === 'down' ? 'Decrease' : 'Unchanged';

  return (
    <span className={`rpt-pill is-${direction}`} title={label}>
      <Icon size={14} />
      <span className="rpt-sr-only">{label}: </span>
      {direction === 'flat' ? 'No change' : `${formatDelta(delta, decimals)}${unit}`}
    </span>
  );
}

function StatCard({ label, value, hint, icon: Icon, tone, loading, suffix }) {
  return (
    <article className={`rpt-stat ${tone}`}>
      <div className="rpt-stat-top">
        <span className="rpt-stat-icon">
          <Icon size={20} strokeWidth={1.9} />
        </span>
        <span className="rpt-stat-label">{label}</span>
      </div>

      <p className="rpt-stat-value">
        {loading ? <span className="rpt-skeleton rpt-skeleton-value" /> : value}
        {!loading && suffix && value !== '—' && <span className="rpt-stat-suffix">{suffix}</span>}
      </p>

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

function CompareCard({ role, label, semester, notOffered }) {
  const rating = toNumber(semester.average_rating);

  return (
    <article className={`rpt-compare-card is-${role}${notOffered ? ' is-not-offered' : ''}`}>
      <p className="rpt-compare-role">{label}</p>
      <h3 className="rpt-compare-name">{semester.semester_name}</h3>
      <p className="rpt-compare-year">{semester.academic_year || 'Academic year not set'}</p>

      <p className="rpt-compare-rating">
        {formatRating(rating)}
        {rating !== null && <span>/ 5</span>}
      </p>
      {rating !== null ? (
        <RatingMeter rating={rating} />
      ) : (
        <span className="rpt-pill is-neutral">
          {notOffered ? 'Not offered for this selection' : 'No ratings yet'}
        </span>
      )}

      <dl className="rpt-compare-facts">
        <div>
          <dt>Responses</dt>
          <dd>{Number(semester.total_submissions || 0)}</dd>
        </div>
        <div>
          <dt>Rating answers</dt>
          <dd>{Number(semester.total_ratings || 0)}</dd>
        </div>
      </dl>
    </article>
  );
}

// Line chart of average rating per semester (plain SVG, no chart library)
function RatingTrendChart({ semesters, baselineId, comparisonId }) {
  const width = Math.max(semesters.length * 120, 560);
  const height = 260;
  const pad = { top: 26, right: 30, bottom: 58, left: 42 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;

  const x = index => pad.left + (
    semesters.length === 1
      ? innerWidth / 2
      : (index * innerWidth) / (semesters.length - 1)
  );
  const y = rating => pad.top + innerHeight - (rating / 5) * innerHeight;

  const points = semesters.map((semester, index) => ({
    semester,
    index,
    rating: toNumber(semester.average_rating)
  }));

  // Break the line where a semester has no ratings
  const segments = [];
  let current = [];

  points.forEach(point => {
    if (point.rating === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(point);
    }
  });

  if (current.length) segments.push(current);

  return (
    <div className="rpt-chart-scroll">
      <svg
        className="rpt-svg"
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: semesters.length > 6 ? `${semesters.length * 90}px` : undefined }}
        role="img"
        aria-label="Average rating for each semester, on a scale of 0 to 5"
      >
        {[0, 1, 2, 3, 4, 5].map(tick => (
          <g key={tick}>
            <line
              className="rpt-grid-line"
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="rpt-axis" x={pad.left - 12} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}

        {segments.map((segment, index) => segment.length > 1 && (
          <polyline
            key={index}
            className="rpt-line"
            points={segment.map(point => `${x(point.index)},${y(point.rating)}`).join(' ')}
          />
        ))}

        {points.map(point => {
          const id = String(point.semester.semester_id);
          const role = id === baselineId ? 'is-base' : id === comparisonId ? 'is-compare' : '';

          return (
            <g key={id}>
              {point.rating !== null ? (
                <>
                  <circle
                    className={`rpt-dot ${role}`}
                    cx={x(point.index)}
                    cy={y(point.rating)}
                    r={role ? 7 : 5}
                  >
                    <title>{`${semesterLabel(point.semester)}: ${point.rating.toFixed(2)} out of 5`}</title>
                  </circle>
                  <text
                    className="rpt-dot-label"
                    x={x(point.index)}
                    y={y(point.rating) - 13}
                    textAnchor="middle"
                  >
                    {point.rating.toFixed(2)}
                  </text>
                </>
              ) : (
                <text
                  className="rpt-axis is-muted"
                  x={x(point.index)}
                  y={pad.top + innerHeight - 8}
                  textAnchor="middle"
                >
                  No ratings
                </text>
              )}

              <text
                className={`rpt-axis rpt-x-label ${role}`}
                x={x(point.index)}
                y={height - pad.bottom + 24}
                textAnchor="middle"
              >
                {point.semester.semester_name}
              </text>
              <text
                className="rpt-axis"
                x={x(point.index)}
                y={height - pad.bottom + 40}
                textAnchor="middle"
              >
                {point.semester.academic_year}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------- Page ----------

function SemesterComparison() {
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedYear, setSelectedYear] = useState('all');
  const [baselineId, setBaselineId] = useState('');
  const [comparisonId, setComparisonId] = useState('');

  // Course / instructor filters (sent to the API) and their option lists
  const [courseFilter, setCourseFilter] = useState('all');
  const [instructorFilter, setInstructorFilter] = useState('all');
  const [courseOptions, setCourseOptions] = useState([]);
  const [instructorOptions, setInstructorOptions] = useState([]);
  const [optionsError, setOptionsError] = useState('');
  const latestRequest = useRef(0);

  const fetchSemesters = async (
    filters = { courseId: courseFilter, instructorId: instructorFilter }
  ) => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    try {
      setLoading(true);
      setError('');

      let response;

      try {
        response = await fetch(`${API_URL}${buildQuery(filters)}`);
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

      if (!response.ok) {
        throw new Error(result?.message || 'Failed to fetch semester comparison');
      }

      if (!result?.success) {
        throw new Error(result?.message || 'Unable to load semester data');
      }

      // Ignore answers that arrive after a newer filter change
      if (latestRequest.current !== requestId) return;

      setSemesters(result.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      if (latestRequest.current !== requestId) return;
      console.error('Semester comparison error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      if (latestRequest.current === requestId) {
        setLoading(false);
      }
    }
  };

  // Course and instructor names for the filter lists
  const fetchFilterOptions = async () => {
    try {
      setOptionsError('');

      const [courseResponse, instructorResponse] = await Promise.all([
        fetch(`${ANALYTICS_URL}/course-performance`),
        fetch(`${ANALYTICS_URL}/instructor-performance`)
      ]).catch(() => {
        throw new Error(SERVER_UNREACHABLE);
      });

      if (!courseResponse.ok || !instructorResponse.ok) {
        throw new Error('Unable to load the course and instructor lists.');
      }

      const [courseResult, instructorResult] = await Promise.all([
        courseResponse.json(),
        instructorResponse.json()
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
    } catch (err) {
      console.error('Filter options error:', err);
      setOptionsError(err.message || 'Unable to load filter options.');
    }
  };

  useEffect(() => {
    fetchSemesters();
    fetchFilterOptions();
  }, []);

  const changeCourse = value => {
    setCourseFilter(value);
    fetchSemesters({ courseId: value, instructorId: instructorFilter });
  };

  const changeInstructor = value => {
    setInstructorFilter(value);
    fetchSemesters({ courseId: courseFilter, instructorId: value });
  };

  const clearGroupFilters = () => {
    setCourseFilter('all');
    setInstructorFilter('all');
    fetchSemesters({ courseId: 'all', instructorId: 'all' });
  };

  const groupFiltered = courseFilter !== 'all' || instructorFilter !== 'all';

  const selectedCourse = courseOptions.find(item => String(item.course_id) === courseFilter) || null;
  const selectedInstructor = instructorOptions.find(item => String(item.instructor_id) === instructorFilter) || null;

  const scopeLabel = [
    selectedCourse && `${selectedCourse.course_code} — ${selectedCourse.course_name}`,
    selectedInstructor && selectedInstructor.instructor_name
  ].filter(Boolean).join(' · ');

  // With a course/instructor filter, a semester without a matching offering is "not offered"
  const isNotOffered = semester =>
    groupFiltered && Number(semester?.course_offerings ?? 1) === 0;

  const academicYears = [
    ...new Set(
      semesters
        .map(item => item.academic_year)
        .filter(Boolean)
    )
  ];

  const filteredSemesters = useMemo(
    () =>
      selectedYear === 'all'
        ? semesters
        : semesters.filter(
            item => item.academic_year === selectedYear
          ),
    [semesters, selectedYear]
  );

  const totalSubmissions = filteredSemesters.reduce(
    (sum, item) => sum + Number(item.total_submissions || 0),
    0
  );

  const ratedSemesters = filteredSemesters.filter(
    item => toNumber(item.average_rating) !== null
  );

  // Weighted average: total of all ratings divided by number of ratings
  const totalRatings = ratedSemesters.reduce(
    (sum, item) => sum + Number(item.total_ratings || 0),
    0
  );

  const totalRatingSum = ratedSemesters.reduce(
    (sum, item) => sum + Number(item.total_rating_sum || 0),
    0
  );

  const averageRating = totalRatings > 0
    ? (totalRatingSum / totalRatings).toFixed(2)
    : null;

  const highestRated = ratedSemesters.length
    ? ratedSemesters.reduce((best, item) =>
        Number(item.average_rating) > Number(best.average_rating) ? item : best
      )
    : null;

  const maxSubmissions = Math.max(
    ...filteredSemesters.map(item => Number(item.total_submissions || 0)),
    1
  );

  // ----- Head-to-head selection -----
  const defaultPool = ratedSemesters.length >= 2 ? ratedSemesters : filteredSemesters;
  const defaultComparison = defaultPool.length ? defaultPool[defaultPool.length - 1] : null;
  const defaultBaseline = defaultPool.length >= 2 ? defaultPool[defaultPool.length - 2] : null;

  const findSemester = id =>
    filteredSemesters.find(item => String(item.semester_id) === id) || null;

  const baseline = findSemester(baselineId) || defaultBaseline;
  const comparison = findSemester(comparisonId) || defaultComparison;

  const baselineKey = baseline ? String(baseline.semester_id) : '';
  const comparisonKey = comparison ? String(comparison.semester_id) : '';

  const sameSemester = Boolean(baseline && comparison && baselineKey === comparisonKey);
  const canCompare = Boolean(baseline && comparison && !sameSemester);

  const baselineRating = baseline ? toNumber(baseline.average_rating) : null;
  const comparisonRating = comparison ? toNumber(comparison.average_rating) : null;

  const ratingDelta = canCompare && baselineRating !== null && comparisonRating !== null
    ? comparisonRating - baselineRating
    : null;

  const submissionsDelta = canCompare
    ? Number(comparison.total_submissions || 0) - Number(baseline.total_submissions || 0)
    : null;

  const ratingAnswersDelta = canCompare
    ? Number(comparison.total_ratings || 0) - Number(baseline.total_ratings || 0)
    : null;

  const missingRatings = canCompare
    ? [baseline, comparison]
        .filter(item => toNumber(item.average_rating) === null)
        .map(item => item.semester_name)
    : [];

  const swapSemesters = () => {
    if (!baseline || !comparison) return;
    setBaselineId(comparisonKey);
    setComparisonId(baselineKey);
  };

  // ----- Change vs previous rated semester (table) -----
  const tableRows = useMemo(
    () =>
      filteredSemesters.map((semester, index) => {
        const rating = toNumber(semester.average_rating);

        // Closest earlier semester in the list that has ratings
        const previous = filteredSemesters
          .slice(0, index)
          .reverse()
          .find(item => toNumber(item.average_rating) !== null);

        const change = rating !== null && previous
          ? rating - toNumber(previous.average_rating)
          : null;

        return {
          semester,
          rating,
          change,
          previousLabel: change !== null ? previous.semester_name : null
        };
      }),
    [filteredSemesters]
  );

  const largestShift = tableRows
    .filter(row => row.change !== null)
    .reduce(
      (best, row) => (best === null || Math.abs(row.change) > Math.abs(best.change) ? row : best),
      null
    );

  // ----- Downloadable reports -----
  const fileScope = scopeLabel
    ? `-${scopeLabel.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '').toLowerCase()}`
    : '';

  const exportSemesters = () => {
    downloadCsv(
      `semester-comparison${fileScope}-${dateStamp()}.csv`,
      [
        'Semester',
        'Academic year',
        'Course offerings',
        'Feedback responses',
        'Rating answers',
        'Average rating (out of 5)',
        'Change vs previous rated semester'
      ],
      tableRows.map(row => [
        row.semester.semester_name,
        row.semester.academic_year,
        Number(row.semester.course_offerings || 0),
        Number(row.semester.total_submissions || 0),
        Number(row.semester.total_ratings || 0),
        row.rating === null ? 'No ratings' : row.rating.toFixed(2),
        row.change === null ? '' : row.change.toFixed(2)
      ])
    );
  };

  const exportComparison = () => {
    if (!canCompare) return;

    downloadCsv(
      `semester-head-to-head${fileScope}-${dateStamp()}.csv`,
      ['Metric', semesterLabel(baseline), semesterLabel(comparison), 'Change'],
      [
        [
          'Average rating (out of 5)',
          baselineRating === null ? 'No ratings' : baselineRating.toFixed(2),
          comparisonRating === null ? 'No ratings' : comparisonRating.toFixed(2),
          ratingDelta === null ? 'Not comparable' : ratingDelta.toFixed(2)
        ],
        [
          'Feedback responses',
          Number(baseline.total_submissions || 0),
          Number(comparison.total_submissions || 0),
          submissionsDelta
        ],
        [
          'Rating answers',
          Number(baseline.total_ratings || 0),
          Number(comparison.total_ratings || 0),
          ratingAnswersDelta
        ]
      ]
    );
  };

  const selectsDisabled = loading || filteredSemesters.length < 2;

  const semesterOptions = filteredSemesters.map(item => (
    <option key={item.semester_id} value={String(item.semester_id)}>
      {semesterLabel(item)}
      {toNumber(item.average_rating) === null ? ' (no ratings)' : ''}
    </option>
  ));

  return (
    <div className="rpt-page">

      {/* HEADER CARD WITH SUMMARY TILES */}
      <section className="rpt-hero" aria-labelledby="sc-title">
        <div className="rpt-hero-top">
          <div className="rpt-hero-main">
            <p className="rpt-hero-eyebrow">
              <CalendarDays size={15} />
              Analytics &amp; Reporting
            </p>

            <h1 id="sc-title" className="rpt-hero-title">
              Semester <span>Comparison</span>
            </h1>

            <p className="rpt-hero-text">
              See how anonymous student feedback changes over time. Compare ratings and
              response activity between any two semesters.
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
              onClick={() => fetchSemesters()}
              disabled={loading}
            >
              <RefreshCw size={17} />
              {loading ? 'Refreshing…' : 'Refresh data'}
            </button>
          </div>
        </div>

        <div className="rpt-stats">
          <StatCard
            label="Semesters"
            value={filteredSemesters.length}
            hint={groupFiltered
              ? `${filteredSemesters.filter(item => !isNotOffered(item)).length} with a matching offering · ${ratedSemesters.length} rated`
              : `${ratedSemesters.length} with rated feedback`}
            icon={CalendarDays}
            tone="is-sage"
            loading={loading}
          />

          <StatCard
            label="Feedback responses"
            value={totalSubmissions}
            hint="Across the semesters in view"
            icon={MessageSquare}
            tone="is-blue"
            loading={loading}
          />

          <StatCard
            label="Average rating"
            value={averageRating === null ? '—' : averageRating}
            suffix="/ 5"
            hint={averageRating === null ? 'No ratings recorded yet' : `Weighted over ${totalRatings} rating answers`}
            icon={Star}
            tone="is-beige"
            loading={loading}
          />

          <StatCard
            label="Highest rated"
            value={highestRated ? highestRated.semester_name : '—'}
            hint={highestRated
              ? `${formatRating(highestRated.average_rating)} / 5 · ${highestRated.academic_year || ''}`
              : 'No ratings recorded yet'}
            icon={Trophy}
            tone="is-mist"
            loading={loading}
          />
        </div>

        <p className="rpt-hero-note">
          {selectedYear === 'all' ? 'All academic years' : `Academic year ${selectedYear}`}
          {' · '}totals for the semesters currently in view.
        </p>
      </section>

      {/* ERROR */}
      {error && (
        <div className="rpt-alert" role="alert">
          <AlertCircle size={20} />
          <div className="rpt-alert-body">
            <p className="rpt-alert-title">Unable to load semester data</p>
            <p className="rpt-alert-text">{error}</p>
          </div>
          <button
            type="button"
            className="rpt-btn rpt-btn-secondary"
            onClick={() => fetchSemesters()}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      )}

      {/* FILTERS */}
      <section className="rpt-filters" aria-labelledby="sc-filter-title">
        <div className="rpt-filters-head">
          <span className="rpt-filters-icon">
            <Filter size={18} />
          </span>

          <div className="rpt-filters-copy">
            <h2 id="sc-filter-title" className="rpt-filters-title">
              Filter results
            </h2>
            <p className="rpt-filters-sub">
              Narrow the semesters to an academic year, a course or an instructor.
            </p>
          </div>

          {groupFiltered && (
            <button type="button" className="rpt-btn rpt-btn-ghost" onClick={clearGroupFilters}>
              <RotateCcw size={15} />
              Clear filters
            </button>
          )}
        </div>

        <div className="rpt-filter-grid is-three">
          <SelectField
            id="academic-year-filter"
            label="Academic year"
            value={selectedYear}
            onChange={setSelectedYear}
            disabled={loading || semesters.length === 0}
            hint={selectedYear === 'all' ? 'Showing all available years' : `Showing ${selectedYear}`}
          >
            <option value="all">All academic years</option>
            {academicYears.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="sc-course-filter"
            label="Course"
            value={selectedCourse ? courseFilter : 'all'}
            onChange={changeCourse}
            disabled={courseOptions.length === 0}
            hint={optionsError || null}
          >
            <option value="all">All courses</option>
            {courseOptions.map(course => (
              <option key={course.course_id} value={String(course.course_id)}>
                {course.course_code} — {course.course_name}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="sc-instructor-filter"
            label="Instructor"
            value={selectedInstructor ? instructorFilter : 'all'}
            onChange={changeInstructor}
            disabled={instructorOptions.length === 0}
          >
            <option value="all">All instructors</option>
            {instructorOptions.map(instructor => (
              <option key={instructor.instructor_id} value={String(instructor.instructor_id)}>
                {instructor.instructor_name}
              </option>
            ))}
          </SelectField>
        </div>

        {groupFiltered && (
          <p className="rpt-scope">
            <Filter size={14} />
            Comparing semesters for <strong>{scopeLabel}</strong>
            {loading && <span className="rpt-scope-loading">Updating…</span>}
          </p>
        )}

        <p className="rpt-note">
          <Info size={14} />
          <span>
            {groupFiltered && (
              <>
                "Not offered" means the selected course or instructor had no course offering in that
                semester.{' '}
              </>
            )}
            For one-semester course and instructor reports, open{' '}
            <Link className="rpt-inline-link" to="/admin/reports">Analytics Overview</Link>. To
            preview and download the semester trend, open{' '}
            <Link className="rpt-inline-link" to="/admin/reports/export">Export Reports</Link>.
          </span>
        </p>
      </section>

      {/* HEAD TO HEAD (with the semester pickers) */}
      <section className="rpt-panel" aria-labelledby="sc-h2h-title">
        <PanelHead
          title={<span id="sc-h2h-title">Semester vs semester</span>}
          subtitle="Pick two semesters. Each change shows how the comparison semester differs from the baseline."
          filtered={groupFiltered}
        >
          <button
            type="button"
            className="rpt-btn rpt-btn-secondary rpt-btn-sm"
            onClick={exportComparison}
            disabled={loading || !canCompare}
          >
            <Download size={15} />
            CSV
          </button>
        </PanelHead>

        <div className="rpt-filter-grid is-compare">
          <SelectField
            id="sc-baseline"
            label="Baseline semester"
            value={baselineKey}
            onChange={setBaselineId}
            disabled={selectsDisabled}
          >
            {filteredSemesters.length === 0 && <option value="">No semesters</option>}
            {semesterOptions}
          </SelectField>

          <div className="rpt-swap-wrap">
            <button
              type="button"
              className="rpt-btn rpt-btn-icon"
              onClick={swapSemesters}
              disabled={selectsDisabled || !canCompare}
              aria-label="Swap baseline and comparison semesters"
              title="Swap semesters"
            >
              <ArrowLeftRight size={17} />
            </button>
          </div>

          <SelectField
            id="sc-comparison"
            label="Comparison semester"
            value={comparisonKey}
            onChange={setComparisonId}
            disabled={selectsDisabled}
          >
            {filteredSemesters.length === 0 && <option value="">No semesters</option>}
            {semesterOptions}
          </SelectField>
        </div>

        <div className="rpt-h2h-body">
          {loading ? (
            <LoadingRows rows={3} />
          ) : filteredSemesters.length === 0 ? (
            <StateMessage
              icon={CalendarDays}
              title="No semesters to compare"
              text="Semester results will appear here once semesters exist in the system."
            />
          ) : filteredSemesters.length < 2 ? (
            <StateMessage
              icon={CalendarDays}
              title="Only one semester in view"
              text="Choose a different academic year, or all years, to compare two semesters."
            />
          ) : sameSemester ? (
            <StateMessage
              icon={ArrowLeftRight}
              title="Choose two different semesters"
              text="The baseline and comparison semesters are the same."
            />
          ) : (
            <>
              <div className="rpt-compare">
                <CompareCard
                  role="base"
                  label="Baseline"
                  semester={baseline}
                  notOffered={isNotOffered(baseline)}
                />
                <span className="rpt-compare-arrow" aria-hidden="true">
                  <ArrowRight size={20} />
                </span>
                <CompareCard
                  role="compare"
                  label="Comparison"
                  semester={comparison}
                  notOffered={isNotOffered(comparison)}
                />
              </div>

              <div className="rpt-delta-list">
                <div className="rpt-delta-row">
                  <span className="rpt-delta-label">Average rating</span>
                  <span className="rpt-delta-values">
                    {formatRating(baselineRating)}
                    <ArrowRight size={13} />
                    {formatRating(comparisonRating)}
                  </span>
                  <DeltaBadge delta={ratingDelta} decimals={2} unit=" pts" epsilon={RATING_EPSILON} />
                </div>

                <div className="rpt-delta-row">
                  <span className="rpt-delta-label">Feedback responses</span>
                  <span className="rpt-delta-values">
                    {Number(baseline.total_submissions || 0)}
                    <ArrowRight size={13} />
                    {Number(comparison.total_submissions || 0)}
                  </span>
                  <DeltaBadge delta={submissionsDelta} />
                </div>

                <div className="rpt-delta-row">
                  <span className="rpt-delta-label">Rating answers</span>
                  <span className="rpt-delta-values">
                    {Number(baseline.total_ratings || 0)}
                    <ArrowRight size={13} />
                    {Number(comparison.total_ratings || 0)}
                  </span>
                  <DeltaBadge delta={ratingAnswersDelta} />
                </div>
              </div>

              {missingRatings.length > 0 && (
                <p className="rpt-note">
                  <Info size={14} />
                  Ratings can't be compared because no ratings were recorded for{' '}
                  {missingRatings.join(' and ')}.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* CHARTS */}
      <div className="rpt-grid-main">
        <section className="rpt-panel">
          <PanelHead
            title="Average rating by semester"
            subtitle="Rating scale 0 to 5, in semester order."
            filtered={groupFiltered}
          >
            {!loading && canCompare && (
              <div className="rpt-chips">
                <span className="rpt-chip is-base">Baseline</span>
                <span className="rpt-chip is-compare">Comparison</span>
              </div>
            )}
          </PanelHead>

          {loading ? (
            <LoadingRows rows={4} />
          ) : ratedSemesters.length > 0 ? (
            <RatingTrendChart
              semesters={filteredSemesters}
              baselineId={canCompare ? baselineKey : ''}
              comparisonId={canCompare ? comparisonKey : ''}
            />
          ) : (
            <StateMessage
              icon={LineChart}
              title="No ratings to chart"
              text="The trend line appears once semesters receive rated feedback."
            />
          )}
        </section>

        <section className="rpt-panel">
          <PanelHead
            title="Responses by semester"
            subtitle="Number of feedback submissions."
            filtered={groupFiltered}
          />

          {loading ? (
            <LoadingRows rows={4} />
          ) : filteredSemesters.length > 0 ? (
            <ul className="rpt-hbars">
              {filteredSemesters.map(item => {
                const count = Number(item.total_submissions || 0);
                const id = String(item.semester_id);
                const role = canCompare && id === baselineKey
                  ? 'is-base'
                  : canCompare && id === comparisonKey
                    ? 'is-compare'
                    : '';

                return (
                  <li key={id} className={`rpt-hbar ${role}`}>
                    <div className="rpt-hbar-head">
                      <span className="rpt-hbar-name">{semesterLabel(item)}</span>
                      <span className="rpt-hbar-value">
                        {isNotOffered(item) ? <span className="rpt-hbar-share">Not offered</span> : count}
                      </span>
                    </div>
                    <span className="rpt-hbar-track">
                      <span
                        className="rpt-hbar-fill"
                        style={{ width: `${(count / maxSubmissions) * 100}%` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <StateMessage
              icon={BarChart3}
              title="No semesters available"
              text="Response activity appears once semesters exist."
            />
          )}
        </section>
      </div>

      {/* KEY FINDING: largest rating shift */}
      {!loading && filteredSemesters.length > 0 && (
        <section aria-labelledby="sc-insights-title">
          <div className="rpt-section-head">
            <h2 id="sc-insights-title" className="rpt-section-title">
              Key finding
            </h2>
            <p className="rpt-section-sub">
              Calculated from the semesters in view.
            </p>
          </div>

          <div className="rpt-insights">
            <article className="rpt-insight">
              <span className="rpt-insight-icon"><TrendingUp size={18} /></span>
              <p className="rpt-insight-label">Largest rating shift</p>
              {largestShift ? (
                <>
                  <p className="rpt-insight-value">
                    {largestShift.previousLabel} → {largestShift.semester.semester_name}
                  </p>
                  <p className="rpt-insight-text">
                    <DeltaBadge
                      delta={largestShift.change}
                      decimals={2}
                      unit=" pts"
                      epsilon={RATING_EPSILON}
                    />
                  </p>
                </>
              ) : (
                <p className="rpt-insight-text">
                  Needs at least two semesters with ratings.
                </p>
              )}
            </article>
          </div>
        </section>
      )}

      {/* DETAILED TABLE */}
      <section className="rpt-panel">
        <PanelHead
          title="Semester breakdown"
          subtitle="Exact results for each semester, in semester order."
          filtered={groupFiltered}
        >
          <button
            type="button"
            className="rpt-btn rpt-btn-secondary rpt-btn-sm"
            onClick={exportSemesters}
            disabled={loading || filteredSemesters.length === 0}
          >
            <Download size={15} />
            CSV
          </button>
        </PanelHead>

        {loading ? (
          <LoadingRows />
        ) : filteredSemesters.length === 0 ? (
          <StateMessage
            icon={CalendarDays}
            title="No semesters available for this selection"
            text="Try a different academic year."
          />
        ) : (
          <div className="rpt-table-wrap">
            <table className="rpt-table is-wide">
              <thead>
                <tr>
                  <th scope="col">Semester</th>
                  <th scope="col" className="is-num">Responses</th>
                  <th scope="col" className="is-num">Rating answers</th>
                  <th scope="col">Average rating</th>
                  <th scope="col">Change vs previous</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(row => {
                  const id = String(row.semester.semester_id);
                  const highlight = !canCompare
                    ? ''
                    : id === baselineKey
                      ? 'is-base'
                      : id === comparisonKey
                        ? 'is-compare'
                        : '';

                  return (
                    <tr key={id} className={highlight}>
                      <td>
                        <span className="rpt-cell-title">{row.semester.semester_name}</span>
                        <span className="rpt-cell-sub">{row.semester.academic_year}</span>
                      </td>
                      <td className="is-num">{Number(row.semester.total_submissions || 0)}</td>
                      <td className="is-num">{Number(row.semester.total_ratings || 0)}</td>
                      <td>
                        {row.rating === null ? (
                          <span className="rpt-pill is-neutral">No ratings yet</span>
                        ) : (
                          <div className="rpt-rating">
                            <span className="rpt-rating-value">
                              {row.rating.toFixed(2)}
                              <span className="rpt-rating-scale">/ 5</span>
                            </span>
                            <RatingMeter rating={row.rating} />
                          </div>
                        )}
                      </td>
                      <td>
                        {row.change === null ? (
                          <span className="rpt-cell-sub">—</span>
                        ) : (
                          <>
                            <DeltaBadge
                              delta={row.change}
                              decimals={2}
                              unit=" pts"
                              epsilon={RATING_EPSILON}
                            />
                            <span className="rpt-cell-sub">vs {row.previousLabel}</span>
                          </>
                        )}
                      </td>
                      <td>
                        {isNotOffered(row.semester) ? (
                          <span className="rpt-pill is-blue">Not offered</span>
                        ) : Number(row.semester.total_submissions || 0) > 0 ? (
                          <span className="rpt-pill is-soft">Feedback received</span>
                        ) : (
                          <span className="rpt-pill is-waiting">Awaiting feedback</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredSemesters.length > 0 && (
          <p className="rpt-panel-foot">
            "Change vs previous" compares each semester with the previous semester in this list
            that has ratings.
          </p>
        )}
      </section>

    </div>
  );
}

export default SemesterComparison;
