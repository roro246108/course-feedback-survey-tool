const assert = require("node:assert/strict");
const { test } = require("node:test");

// Keep this unit test independent of backend/.env and a database connection.
const dotenv = require("dotenv");
const originalDotenvConfig = dotenv.config;
const originalDatabaseUrl = process.env.DATABASE_URL;
dotenv.config = () => ({ parsed: {} });
process.env.DATABASE_URL = "postgresql://unit-test:unit-test@127.0.0.1/unit_test";

const analyticsService = require("../analytics-reporting/services/analyticsService");
const originalGetOverview = analyticsService.getOverview;
const originalGetCoursePerformance = analyticsService.getCoursePerformance;
let receivedFilters;
let receivedCourseFilters;
analyticsService.getOverview = async (filters) => {
  receivedFilters = filters;
  return {
    totalSubmissions: 0,
    totalCourses: 0,
    totalInstructors: 0,
  };
};
analyticsService.getCoursePerformance = async (filters) => {
  receivedCourseFilters = filters;
  return [{
    course_id: 8,
    course_code: "TEST-101",
    course_name: "Test Course",
  }];
};
const analyticsController = require("../analytics-reporting/controllers/analyticsController");
analyticsService.getOverview = originalGetOverview;
analyticsService.getCoursePerformance = originalGetCoursePerformance;

dotenv.config = originalDotenvConfig;
if (originalDatabaseUrl === undefined) {
  delete process.env.DATABASE_URL;
} else {
  process.env.DATABASE_URL = originalDatabaseUrl;
}

test("instructor overview ignores requested instructor IDs and scopes to the authenticated user", async () => {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await analyticsController.getOverview(
    {
      user: { role: "Instructor", userId: 37 },
      query: { instructorId: "999" },
    },
    response
  );

  assert.deepEqual(receivedFilters, { instructorId: 37 });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.totalCourses, 0);
});

test("instructor course API uses authenticated user ID and retains semester filter", async () => {
  const originalEntityExists = analyticsService.entityExists;
  analyticsService.entityExists = async () => true;
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  try {
    await analyticsController.getCoursePerformance(
      {
        user: { role: "Instructor", userId: 37 },
        query: { instructorId: "999", semesterId: "4" },
      },
      response
    );

    assert.deepEqual(receivedCourseFilters, {
      semesterId: 4,
      instructorId: 37,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data[0].course_id, 8);
  } finally {
    analyticsService.entityExists = originalEntityExists;
  }
});

test("course performance SQL filters both the instructor and selected semester", async () => {
  const pool = require("../shared/config/db");
  const analyticsModel = require("../analytics-reporting/models/analyticsModel");
  const originalQuery = pool.query;
  let capturedQuery;
  let capturedParams;
  pool.query = async (query, params) => {
    capturedQuery = query;
    capturedParams = params;
    return { rows: [] };
  };

  try {
    await analyticsModel.getCoursePerformance({
      instructorId: 37,
      semesterId: 4,
    });

    assert.deepEqual(capturedParams, [4, 37]);
    assert.match(capturedQuery, /ci\.semester_id = \$1/);
    assert.match(capturedQuery, /ci\.instructor_id = \$2/);
  } finally {
    pool.query = originalQuery;
  }
});
