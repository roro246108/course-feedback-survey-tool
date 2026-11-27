const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const pg = require("pg");

test("Anonymous Feedback uses the shared pool and keeps transactions on one client", async () => {
  const sharedPoolPath = require.resolve("../database/db");
  const dotenv = require("dotenv");
  const originalDotenvConfig = dotenv.config;
  const originalPoolDescriptor = Object.getOwnPropertyDescriptor(pg, "Pool");
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const poolInstances = [];
  const configuredUrl = "postgresql://unit-test:unit-test@127.0.0.1/unit_test";
  const modelPaths = [
    require.resolve("../anonymous-feedback/models/availableSurveysModel"),
    require.resolve("../anonymous-feedback/models/dashboardModel"),
    require.resolve("../anonymous-feedback/models/feedbackModel"),
  ];

  class FakePool {
    constructor(options) {
      this.options = options;
      this.poolQueries = [];
      this.connectionCount = 0;
      poolInstances.push(this);
    }

    async query(sql, params) {
      this.poolQueries.push({ sql, params });
      if (/AS eligible/i.test(sql)) return { rows: [{ eligible: true }] };
      if (/completed_surveys/i.test(sql)) {
        return { rows: [{ completed_surveys: "0", available_surveys: "0", enrolled_courses: "0" }] };
      }
      return { rows: [] };
    }

    async connect() {
      this.connectionCount += 1;
      return this.client;
    }
  }

  try {
    // Prevent tests from reading backend/.env or opening a real database pool.
    dotenv.config = () => ({ parsed: {} });
    process.env.DATABASE_URL = configuredUrl;
    Object.defineProperty(pg, "Pool", {
      ...originalPoolDescriptor,
      value: FakePool,
    });
    delete require.cache[sharedPoolPath];
    for (const modelPath of modelPaths) delete require.cache[modelPath];

    const pool = require(sharedPoolPath);
    assert.equal(poolInstances.length, 1);
    assert.equal(poolInstances[0].options.connectionString, configuredUrl);

    const availableSurveysModel = require("../anonymous-feedback/models/availableSurveysModel");
    const dashboardModel = require("../anonymous-feedback/models/dashboardModel");
    const feedbackModel = require("../anonymous-feedback/models/feedbackModel");

    await availableSurveysModel.getAvailableSurveys(19);
    await dashboardModel.getDashboardStats(19);
    assert.equal(await feedbackModel.checkStudentEligibility(7, 19), true);
    assert.equal(poolInstances[0].poolQueries.length, 3, "all three models use the shared pool");

    for (const modelPath of modelPaths.slice(0, 3)) {
      const source = require("node:fs").readFileSync(modelPath, "utf8");
      assert.match(source, /require\("\.\.\/\.\.\/database\/db"\)/);
      assert.doesNotMatch(source, /ANONYMOUS_FEEDBACK_DATABASE_URL/);
    }

    const clientQueries = [];
    const client = {
      query: async (sql, params) => {
        clientQueries.push({ sql, params });
        if (/FROM questions/i.test(sql)) return { rows: [] };
        if (/FROM surveys\s+WHERE survey_id/i.test(sql)) {
          return { rows: [{ survey_id: 7, status: "Published", is_open: true }] };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => clientQueries.push({ released: true }),
    };
    poolInstances[0].client = client;

    let transactionClient;
    await feedbackModel.withTransaction(async (tx) => {
      transactionClient = tx;
      await feedbackModel.getSurveyQuestions(tx, 7);
      await feedbackModel.getSurveyForSubmission(tx, 7);
    });

    assert.equal(transactionClient, client);
    assert.equal(poolInstances[0].connectionCount, 1);
    assert.equal(clientQueries[0].sql, "BEGIN");
    assert.equal(clientQueries.at(-2).sql, "COMMIT");
    assert.deepEqual(clientQueries.at(-1), { released: true });
    assert.equal(poolInstances[0].poolQueries.length, 3, "transaction queries must use the checked-out shared-pool client");

    const directSurveyRead = clientQueries.find(({ sql }) => /FROM surveys\s+WHERE survey_id/i.test(sql));
    assert.match(directSurveyRead.sql, /FOR UPDATE/i);
    assert.doesNotMatch(clientQueries.map(({ sql }) => sql).join("\n"), /feedback_ownership_mapping|lock_survey_for_feedback/i);
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    dotenv.config = originalDotenvConfig;
    delete require.cache[sharedPoolPath];
    for (const modelPath of modelPaths) delete require.cache[modelPath];
    Object.defineProperty(pg, "Pool", originalPoolDescriptor);
  }
});

test("submission application code no longer depends on ownership migration objects", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "../database/migrations/001_feedback_ownership_mapping.sql"),
    "utf8"
  );
  const feedbackModelSource = fs.readFileSync(
    path.join(__dirname, "../anonymous-feedback/models/feedbackModel.js"),
    "utf8"
  );
  const ownershipModelPath = path.join(__dirname, "../anonymous-feedback/models/feedbackOwnershipModel.js");

  assert.match(migration, /feedback_ownership_mapping/);
  assert.match(migration, /lock_survey_for_feedback/);
  assert.doesNotMatch(feedbackModelSource, /feedback_ownership_mapping|lock_survey_for_feedback/);
  assert.equal(fs.existsSync(ownershipModelPath), false);
  assert.doesNotMatch(migration, /CREATE ROLE|GRANT .* TO /i);
});

test("read-only student metadata route is protected; no individual response management routes exist", () => {
  const studentRoutes = fs.readFileSync(
    path.join(__dirname, "../anonymous-feedback/routes/studentSurveyRoutes.js"),
    "utf8"
  );
  const feedbackRoutes = fs.readFileSync(
    path.join(__dirname, "../anonymous-feedback/routes/feedbackRoutes.js"),
    "utf8"
  );
  const appSource = fs.readFileSync(
    path.join(__dirname, "../../frontend/src/App.jsx"),
    "utf8"
  );
  const navbarSource = fs.readFileSync(
    path.join(__dirname, "../../frontend/src/components/student/StudentNavbar.jsx"),
    "utf8"
  );
  const pageSource = fs.readFileSync(
    path.join(__dirname, "../../frontend/src/pages/student/MySubmissions.jsx"),
    "utf8"
  );

  assert.match(studentRoutes, /router\.get\(["']\/submissions["'],\s*requireStudent,\s*feedbackController\.getStudentSubmissionMetadata\)/);
  assert.doesNotMatch(studentRoutes, /\.(?:get|put|delete)\(["']\/submissions\//);
  assert.doesNotMatch(feedbackRoutes, /\.(?:get|put|delete)\(["']\/feedback\/submissions/);
  assert.match(appSource, /path="\/my-submissions"[\s\S]*<MySubmissions\s*\/>/);
  assert.match(navbarSource, /label: "My Submissions"[\s\S]*to: "\/my-submissions"/);
  assert.doesNotMatch(pageSource, /View submission|Edit submission|Withdraw submission|Delete submission/i);
  assert.doesNotMatch(pageSource, /rating_value|text_answer|feedback_answers|feedback_submissions/i);
});
