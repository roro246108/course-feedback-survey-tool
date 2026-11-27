const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

// Keep model imports from loading backend/.env or opening a database connection.
const dotenv = require("dotenv");
const originalDotenvConfig = dotenv.config;
dotenv.config = () => ({ parsed: {} });
process.env.DATABASE_URL = "postgresql://unit-test:unit-test@127.0.0.1/unit_test";

const availableSurveysModel = require("../anonymous-feedback/models/availableSurveysModel");
const availableSurveysService = require("../anonymous-feedback/services/availableSurveysService");
const dashboardModel = require("../anonymous-feedback/models/dashboardModel");
const dashboardService = require("../anonymous-feedback/services/dashboardService");
const feedbackModel = { ...require("../anonymous-feedback/models/feedbackModel") };

dotenv.config = originalDotenvConfig;

test("available survey query filters enrollment, published/open dates, and prior participation", async () => {
  let capturedQuery;
  let capturedParams;
  const db = {
    query: async (query, params) => {
      capturedQuery = query;
      capturedParams = params;
      return { rows: [{ survey_id: 31 }] };
    },
  };

  const rows = await availableSurveysModel.getAvailableSurveys(17, db);

  assert.deepEqual(rows, [{ survey_id: 31 }]);
  assert.deepEqual(capturedParams, [17]);
  assert.match(capturedQuery, /s\.status = 'Published'/);
  assert.match(capturedQuery, /s\.opening_date <= CURRENT_TIMESTAMP/);
  assert.match(capturedQuery, /s\.closing_date > CURRENT_TIMESTAMP/);
  assert.match(capturedQuery, /e\.student_id = \$1/);
  assert.match(capturedQuery, /e\.course_id = ci\.course_id/);
  assert.match(capturedQuery, /e\.semester_id = ci\.semester_id/);
  assert.match(capturedQuery, /NOT EXISTS \([\s\S]*FROM participation/);
});

test("enrolled course query is scoped to the authenticated student and counts eligible open surveys", async () => {
  let capturedQuery;
  let capturedParams;
  const db = {
    query: async (query, params) => {
      capturedQuery = query;
      capturedParams = params;
      return { rows: [{ course_id: 9, course_name: "TEST DATA: Networks", available_survey_count: "2" }] };
    },
  };

  const courses = await availableSurveysModel.getEnrolledCourses(17, db);

  assert.equal(courses[0].course_name, "TEST DATA: Networks");
  assert.deepEqual(capturedParams, [17]);
  assert.match(capturedQuery, /FROM enrollments e/);
  assert.match(capturedQuery, /WHERE e\.student_id = \$1/);
  assert.match(capturedQuery, /JOIN courses c/);
  assert.match(capturedQuery, /LEFT JOIN course_instructors ci/);
  assert.match(capturedQuery, /LEFT JOIN users u/);
  assert.match(capturedQuery, /COUNT\(DISTINCT s\.survey_id\) FILTER/);
  assert.match(capturedQuery, /NOT EXISTS \([\s\S]*FROM participation/);
});

test("survey detail query returns only survey/course/instructor display fields and ordered questions", async () => {
  const queries = [];
  const db = {
    query: async (query, params) => {
      queries.push({ query, params });
      if (queries.length === 1) {
        return {
          rows: [{
            survey_id: 31,
            title: "Course survey",
            instructor_name: "Course Instructor",
          }],
        };
      }
      return { rows: [{ question_id: 8, question_type: "Rating" }] };
    },
  };

  const survey = await availableSurveysModel.getSurveyById(31, 17, db);

  assert.equal(survey.survey_id, 31);
  assert.deepEqual(survey.questions, [{ question_id: 8, question_type: "Rating" }]);
  assert.deepEqual(queries[0].params, [31, 17]);
  assert.doesNotMatch(queries[0].query.split("FROM surveys")[0], /student_id|email/);
  assert.match(queries[0].query, /NOT EXISTS \([\s\S]*FROM participation/);
  assert.match(queries[1].query, /ORDER BY display_order ASC/);
});

test("survey details stop at the access query when no eligible open survey is found", async () => {
  let queryCount = 0;
  const db = {
    query: async () => {
      queryCount += 1;
      return { rows: [] };
    },
  };

  assert.equal(await availableSurveysModel.getSurveyById(404, 17, db), null);
  assert.equal(queryCount, 1);
});

test("submission status reports a prior submission and disallows another response", async () => {
  const db = {
    query: async (_query, params) => {
      assert.deepEqual(params, [31, 17]);
      return {
        rows: [{
          survey_id: 31,
          status: "Published",
          is_eligible: true,
          already_submitted: true,
          is_open: true,
        }],
      };
    },
  };

  const status = await availableSurveysModel.getSurveySubmissionStatus(31, 17, db);

  assert.equal(status.already_submitted, true);
  assert.equal(status.can_submit, false);
  assert.equal(status.reason, "ALREADY_SUBMITTED");
});

test("service rejects invalid survey and student IDs before database access", async () => {
  await assert.rejects(
    availableSurveysService.getSurveyById(0, 17),
    /Invalid survey ID/
  );
  await assert.rejects(
    availableSurveysService.getSurveySubmissionStatus(1, "not-a-student"),
    /Invalid student ID/
  );
});

test("submission locks the survey row in its transaction without the migration function", async () => {
  const queries = [];
  const client = {
    query: async (sql, values) => {
      queries.push({ sql, values });
      return /FROM surveys/i.test(sql)
        ? { rows: [{ survey_id: 31, is_open: true }] }
        : { rows: [] };
    },
  };
  const survey = await feedbackModel.getSurveyForSubmission(client, 31);
  assert.equal(survey.is_open, true);
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].values, [31]);
  assert.match(queries[0].sql, /FROM surveys[\s\S]*FOR UPDATE/i);
  assert.doesNotMatch(queries[0].sql, /feedback_ownership_mapping|lock_survey_for_feedback/);
});

test("student submission metadata query uses only JWT-scoped participation and catalog tables", async () => {
  let query;
  let params;
  const db = {
    query: async (sql, values) => {
      query = sql;
      params = values;
      return { rows: [{ id: 90, survey_title: "Course survey", status: "Submitted" }] };
    },
  };

  const rows = await feedbackModel.getStudentSubmissionMetadata(24, db);
  assert.deepEqual(params, [24]);
  assert.equal(rows[0].survey_title, "Course survey");
  assert.match(query, /FROM participation p/);
  assert.match(query, /WHERE p\.student_id = \$1/);
  assert.match(query, /JOIN surveys s/);
  assert.match(query, /JOIN course_instructors ci/);
  assert.match(query, /JOIN courses c/);
  assert.match(query, /JOIN semesters sem/);
  assert.match(query, /to_jsonb\(p\)->>'status'/);
  assert.doesNotMatch(query, /feedback_submissions|feedback_answers|text_answer|rating_value|student_id\s*,/i);
});

test("metadata service validates student identity before querying", async () => {
  const feedbackService = require("../anonymous-feedback/services/feedbackService");
  await assert.rejects(
    feedbackService.getStudentSubmissionMetadata("not-a-student"),
    (error) => error.code === "STUDENT_ID_REQUIRED" && error.statusCode === 401
  );
});

test("legacy ownership migration remains separate from active submission code", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "../database/migrations/001_feedback_ownership_mapping.sql"),
    "utf8"
  );
  const ownershipTable = migration.match(/CREATE TABLE public\.feedback_ownership_mapping \(([\s\S]*?)\n\);/i)?.[1] || "";
  assert.match(migration, /ALTER TABLE public\.participation[\s\S]*ADD COLUMN status character varying\(20\) NOT NULL DEFAULT 'Submitted'/i);
  assert.match(migration, /ALTER TABLE public\.participation[\s\S]*ADD CONSTRAINT participation_status_check[\s\S]*CHECK \(status IN \('Submitted', 'Withdrawn'\)\)/i);
  assert.doesNotMatch(migration, /ALTER TABLE feedback_submissions\s+ADD\s+(?:COLUMN\s+(?:status|updated_at|withdrawn_at)|CONSTRAINT\s+feedback_submissions_(?:status|withdrawn_at))/i);
  assert.match(migration, /UNIQUE \(submission_id, survey_id\)/i);
  assert.match(ownershipTable, /owner_key character varying\(64\)/i);
  assert.match(ownershipTable, /submission_id integer NOT NULL UNIQUE/i);
  assert.match(ownershipTable, /FOREIGN KEY \(submission_id, survey_id\)[\s\S]*REFERENCES public\.feedback_submissions \(submission_id, survey_id\)/i);
  assert.match(ownershipTable, /ON DELETE CASCADE/i);
  assert.doesNotMatch(ownershipTable, /student_id/i);
  assert.match(migration, /status IN \('Submitted', 'Withdrawn'\)/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.feedback_ownership_mapping FROM PUBLIC/i);
  assert.match(migration, /Historical ownership mappings are intentionally not backfilled/i);
  const serviceSource = fs.readFileSync(
    path.join(__dirname, "../anonymous-feedback/services/feedbackService.js"),
    "utf8"
  );
  assert.doesNotMatch(serviceSource, /feedback_ownership_mapping|FEEDBACK_OWNERSHIP_HMAC_SECRET/);
});

test("student home seed is additive, marked as test data, and uses existing relationship IDs", () => {
  const seed = fs.readFileSync(
    path.join(__dirname, "../database/seeds/student_dashboard_test_data.sql"),
    "utf8"
  );

  assert.match(seed, /REPLACE_WITH_EXISTING_TEST_STUDENT_EMAIL/);
  assert.match(seed, /REPLACE_WITH_EXISTING_ACTIVE_INSTRUCTOR_EMAIL/);
  assert.match(seed, /current_setting\('app\.seed_student_email'\)/);
  assert.match(seed, /'TEST DATA:/);
  assert.match(seed, /ON CONFLICT \(course_code\) DO NOTHING/);
  assert.match(seed, /ON CONFLICT \(course_id, semester_id, instructor_id\) DO NOTHING/);
  assert.match(seed, /ON CONFLICT \(student_id, course_id, semester_id\) DO NOTHING/);
  assert.match(seed, /NOT EXISTS/);
  assert.doesNotMatch(seed, /\b(?:UPDATE|DELETE)\s+public\./i);
});

test("dashboard statistics are student-scoped and use the open-survey window", async () => {
  let capturedQuery;
  const db = {
    query: async (query, params) => {
      capturedQuery = query;
      assert.deepEqual(params, [17]);
      return {
        rows: [{ completed_surveys: "2", available_surveys: "3", enrolled_courses: "4" }],
      };
    },
  };

  const row = await dashboardModel.getDashboardStats(17, db);
  const originalGetStats = dashboardModel.getDashboardStats;
  dashboardModel.getDashboardStats = async () => row;
  try {
    const stats = await dashboardService.getDashboardStats(17);
    assert.deepEqual(stats, {
      completedSurveys: 2,
      availableSurveys: 3,
      enrolledCourses: 4,
    });
  } finally {
    dashboardModel.getDashboardStats = originalGetStats;
  }

  assert.match(capturedQuery, /WHERE e\.student_id = \$1/);
  assert.match(capturedQuery, /p\.student_id = \$1/);
  assert.match(capturedQuery, /COALESCE\(to_jsonb\(p\)->>'status', 'Submitted'\) = 'Submitted'/);
  assert.doesNotMatch(capturedQuery, /p\.status/);
  assert.match(capturedQuery, /s\.opening_date <= CURRENT_TIMESTAMP/);
  assert.match(capturedQuery, /s\.closing_date > CURRENT_TIMESTAMP/);
});
