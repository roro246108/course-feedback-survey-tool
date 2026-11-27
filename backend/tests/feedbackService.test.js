const assert = require("node:assert/strict");
const { after, beforeEach, test } = require("node:test");

// Keep this unit test independent of local .env files and PostgreSQL.
const dotenv = require("dotenv");
const originalDotenvConfig = dotenv.config;
dotenv.config = () => ({ parsed: {} });
process.env.DATABASE_URL = "postgresql://unit-test:unit-test@127.0.0.1/unit_test";

const feedbackModel = require("../anonymous-feedback/models/feedbackModel");
const surveyManagementClient = require("../anonymous-feedback/integrations/surveyManagementClient");
const feedbackService = require("../anonymous-feedback/services/feedbackService");
const feedbackController = require("../anonymous-feedback/controllers/feedbackController");
const eventPublisher = require("../anonymous-feedback/integrations/eventPublisher");

dotenv.config = originalDotenvConfig;

const originalModel = { ...feedbackModel };
const originalEligibilityCheck = surveyManagementClient.checkStudentEligibility;
const originalService = { ...feedbackService };

let savedAnswers;
let savedIdempotencyRecord;
let participationWrites;
let surveyIsOpen;
let studentIsEligible;

beforeEach(() => {
  for (const [name, implementation] of Object.entries(originalService)) {
    feedbackService[name] = implementation;
  }

  savedAnswers = [];
  savedIdempotencyRecord = null;
  participationWrites = 0;
  surveyIsOpen = true;
  studentIsEligible = true;

  feedbackModel.withTransaction = (callback) => callback({});
  feedbackModel.getSurveyForSubmission = async () => ({ is_open: surveyIsOpen });
  feedbackModel.getSurveyQuestions = async () => [
    { question_id: 10, question_type: "Rating", is_required: true },
    { question_id: 11, question_type: "Text", is_required: true },
  ];
  feedbackModel.getIdempotencyRecord = async () =>
    savedIdempotencyRecord;
  feedbackModel.recordParticipation = async () => {
    participationWrites += 1;
    return { participation_id: 90 };
  };
  feedbackModel.createSubmission = async () => ({ submission_id: 77 });
  feedbackModel.saveAnswer = async (...args) => {
    savedAnswers.push(args);
  };
  feedbackModel.saveIdempotencyRecord = async (
    _client,
    _surveyId,
    _studentId,
    _keyHash,
    payloadHash
  ) => {
    savedIdempotencyRecord = { payload_hash: payloadHash };
  };
  surveyManagementClient.checkStudentEligibility = async () => studentIsEligible;
});

after(() => {
  for (const [name, implementation] of Object.entries(originalModel)) {
    feedbackModel[name] = implementation;
  }
  surveyManagementClient.checkStudentEligibility = originalEligibilityCheck;
  for (const [name, implementation] of Object.entries(originalService)) {
    feedbackService[name] = implementation;
  }
});

const validAnswers = [
  { question_id: 10, rating_value: 4 },
  { question_id: 11, text_answer: " Please email me at student@example.com\0 " },
];

test("submits transaction data and redacts email from stored text", async () => {
  const result = await feedbackService.submitFeedback({
    surveyId: 5,
    studentId: 20,
    answers: validAnswers,
    idempotencyKey: "idem-key-0001",
  });

  assert.equal(result.alreadyProcessed, false);
  assert.equal(participationWrites, 1);
  assert.equal(savedAnswers.length, 2);
  assert.equal(savedAnswers[1][4], "Please email me at [REDACTED_EMAIL]");
  assert.equal("submissionId" in result, false);
  assert.equal("studentId" in result, false);
});

test("replays the same key and payload without another participation write", async () => {
  const request = {
    surveyId: 5,
    studentId: 20,
    answers: validAnswers,
    idempotencyKey: "idem-key-0002",
  };

  const first = await feedbackService.submitFeedback(request);
  const replay = await feedbackService.submitFeedback(request);

  assert.equal(first.alreadyProcessed, false);
  assert.equal(replay.alreadyProcessed, true);
  assert.equal(participationWrites, 1);
});

test("replays a prior success after the survey closes or eligibility changes", async () => {
  const request = {
    surveyId: 5,
    studentId: 20,
    answers: validAnswers,
    idempotencyKey: "idem-key-closed",
  };

  await feedbackService.submitFeedback(request);
  surveyIsOpen = false;
  studentIsEligible = false;

  const replay = await feedbackService.submitFeedback(request);

  assert.equal(replay.alreadyProcessed, true);
  assert.equal(participationWrites, 1);
});

test("rejects reuse of an idempotency key with a different payload", async () => {
  const request = {
    surveyId: 5,
    studentId: 20,
    answers: validAnswers,
    idempotencyKey: "idem-key-0003",
  };

  await feedbackService.submitFeedback(request);

  await assert.rejects(
    feedbackService.submitFeedback({
      ...request,
      answers: [
        { ...validAnswers[0], rating_value: 2 },
        validAnswers[1],
      ],
    }),
    (error) => error.code === "IDEMPOTENCY_KEY_REUSED"
  );

  assert.equal(participationWrites, 1);
});

test("rejects ratings outside the supported range before persistence", async () => {
  await assert.rejects(
    feedbackService.submitFeedback({
      surveyId: 5,
      studentId: 20,
      answers: [
        { question_id: 10, rating_value: 6 },
        validAnswers[1],
      ],
      idempotencyKey: "idem-key-0004",
    }),
    (error) => error.code === "INVALID_RATING"
  );

  assert.equal(participationWrites, 0);
});

test("rejects question IDs that do not belong to the survey", async () => {
  await assert.rejects(
    feedbackService.submitFeedback({
      surveyId: 5,
      studentId: 20,
      answers: [
        { question_id: 99, rating_value: 4 },
        validAnswers[1],
      ],
      idempotencyKey: "idem-key-invalid-question",
    }),
    (error) => error.code === "INVALID_QUESTION"
  );

  assert.equal(participationWrites, 0);
});

test("rejects noncanonical question ID formats", async () => {
  await assert.rejects(
    feedbackService.submitFeedback({
      surveyId: 5,
      studentId: 20,
      answers: [
        { question_id: "1e1", rating_value: 4 },
        validAnswers[1],
      ],
      idempotencyKey: "idem-key-question-format",
    }),
    (error) => error.code === "INVALID_QUESTION"
  );
});

test("rejects rating values that are not JSON numbers", async () => {
  await assert.rejects(
    feedbackService.submitFeedback({
      surveyId: 5,
      studentId: 20,
      answers: [
        { question_id: 10, rating_value: "5" },
        validAnswers[1],
      ],
      idempotencyKey: "idem-key-rating-type",
    }),
    (error) => error.code === "INVALID_RATING"
  );
});

test("rejects a missing required question before persistence", async () => {
  await assert.rejects(
    feedbackService.submitFeedback({
      surveyId: 5,
      studentId: 20,
      answers: [validAnswers[0]],
      idempotencyKey: "idem-key-0005",
    }),
    (error) => error.code === "REQUIRED_QUESTION_MISSING"
  );

  assert.equal(participationWrites, 0);
});

test("rejects feedback when the survey is closed", async () => {
  surveyIsOpen = false;

  await assert.rejects(
    feedbackService.submitFeedback({
      surveyId: 5,
      studentId: 20,
      answers: validAnswers,
      idempotencyKey: "idem-key-0006",
    }),
    (error) => error.code === "SURVEY_NOT_OPEN"
  );

  assert.equal(participationWrites, 0);
});

test("rejects a student who is not enrolled for the survey", async () => {
  studentIsEligible = false;

  await assert.rejects(
    feedbackService.submitFeedback({
      surveyId: 5,
      studentId: 20,
      answers: validAnswers,
      idempotencyKey: "idem-key-0007",
    }),
    (error) => error.code === "STUDENT_NOT_ELIGIBLE"
  );

  assert.equal(participationWrites, 0);
});

test("transaction wrapper commits on success and releases its client", async () => {
  const operations = [];
  const client = {
    query: async (sql) => operations.push(sql),
    release: () => operations.push("RELEASE"),
  };
  const connectionPool = { connect: async () => client };

  const result = await originalModel.withTransaction(
    async () => "committed result",
    connectionPool
  );

  assert.equal(result, "committed result");
  assert.deepEqual(operations, ["BEGIN", "COMMIT", "RELEASE"]);
});

test("transaction wrapper rolls back on failure and releases its client", async () => {
  const operations = [];
  const client = {
    query: async (sql) => operations.push(sql),
    release: () => operations.push("RELEASE"),
  };
  const connectionPool = { connect: async () => client };

  await assert.rejects(
    originalModel.withTransaction(
      async () => {
        throw new Error("simulated write failure");
      },
      connectionPool
    ),
    /simulated write failure/
  );

  assert.deepEqual(operations, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("answer insertion failure rolls back participation and response writes before idempotency is recorded", async () => {
  const operations = [];
  const client = {
    query: async (sql) => operations.push(sql),
    release: () => operations.push("RELEASE"),
  };
  feedbackModel.withTransaction = (callback) =>
    originalModel.withTransaction(callback, { connect: async () => client });
  feedbackModel.saveAnswer = async () => {
    throw new Error("simulated answer insert failure");
  };

  await assert.rejects(
    feedbackService.submitFeedback({
      surveyId: 5,
      studentId: 20,
      answers: validAnswers,
      idempotencyKey: "idem-key-answer-failure",
    }),
    /simulated answer insert failure/
  );

  assert.deepEqual(operations, ["BEGIN", "ROLLBACK", "RELEASE"]);
  assert.equal(participationWrites, 1);
  assert.equal(savedIdempotencyRecord, null);
});

test("maps only the participation unique constraint to duplicate submission", async () => {
  feedbackModel.recordParticipation = async () => {
    const error = new Error("duplicate participation");
    error.code = "23505";
    error.constraint = "participation_survey_id_student_id_key";
    throw error;
  };

  await assert.rejects(
    feedbackService.submitFeedback({
      surveyId: 5,
      studentId: 20,
      answers: validAnswers,
      idempotencyKey: "idem-key-duplicate",
    }),
    (error) => error.code === "ALREADY_SUBMITTED" && error.statusCode === 409
  );
});

test("submission response does not include student identity", async () => {
  feedbackService.submitFeedback = async () => ({
    surveyId: 5,
    alreadyProcessed: false,
    message: "Feedback submitted successfully.",
  });

  const response = createResponse();
  await feedbackController.submitFeedback(
    {
      user: { user_id: 24 },
      params: { surveyId: "5" },
      body: { answers: validAnswers },
      get: () => "idem-key-controller",
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal("studentId" in response.body.data, false);
  assert.equal("student_id" in response.body.data, false);
});

test("submission metadata is scoped to JWT identity and response allowlist excludes answer content", async () => {
  const originalMetadataService = feedbackService.getStudentSubmissionMetadata;
  let receivedStudentId;
  feedbackService.getStudentSubmissionMetadata = async (studentId) => {
    receivedStudentId = studentId;
    return [{
      id: 90,
      survey_id: 5,
      survey_title: "Course survey",
      course_name: "Computer Science",
      course_code: "CS101",
      semester_name: "Fall",
      academic_year: "2026/2027",
      submitted_at: "2026-11-01T10:00:00Z",
      status: "Submitted",
      student_id: 999,
      answers: [{ text_answer: "private response" }],
    }];
  };

  const response = createResponse();
  try {
    await feedbackController.getStudentSubmissionMetadata({
      user: { user_id: 24 },
      query: { student_id: "999" },
      body: { student_id: 999 },
    }, response);
  } finally {
    feedbackService.getStudentSubmissionMetadata = originalMetadataService;
  }

  assert.equal(receivedStudentId, 24);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data[0], {
    id: 90,
    survey_id: 5,
    survey_title: "Course survey",
    course_name: "Computer Science",
    course_code: "CS101",
    semester_name: "Fall",
    academic_year: "2026/2027",
    submitted_at: "2026-11-01T10:00:00Z",
    status: "Submitted",
  });
});

test("submission metadata controller rejects unauthenticated requests", async () => {
  const originalMetadataService = feedbackService.getStudentSubmissionMetadata;
  let called = false;
  feedbackService.getStudentSubmissionMetadata = async () => {
    called = true;
    return [];
  };

  const response = createResponse();
  try {
    await feedbackController.getStudentSubmissionMetadata({}, response);
  } finally {
    feedbackService.getStudentSubmissionMetadata = originalMetadataService;
  }

  assert.equal(response.statusCode, 401);
  assert.equal(called, false);
});

test("canonical submit endpoint takes survey ID from body and student ID from JWT", async () => {
  let input;
  feedbackService.submitFeedback = async (value) => {
    input = value;
    return { surveyId: 5, alreadyProcessed: false, message: "ok" };
  };
  const response = createResponse();
  await feedbackController.submitFeedback(
    {
      user: { user_id: 24 },
      params: {},
      body: { survey_id: 5, student_id: 999, answers: validAnswers },
      get: () => "idem-key-canonical",
    },
    response
  );
  assert.equal(input.studentId, 24);
  assert.equal(input.surveyId, 5);
  assert.equal(response.statusCode, 201);
});

test("rejects noncanonical survey ID paths before calling the service", async () => {
  let serviceCalled = false;
  feedbackService.submitFeedback = async () => {
    serviceCalled = true;
    return { surveyId: 1, alreadyProcessed: false, message: "ok" };
  };

  const response = createResponse();
  await feedbackController.submitFeedback(
    {
      user: { user_id: 24 },
      params: { surveyId: "1.0" },
      body: { answers: validAnswers },
      get: () => "idem-key-invalid-survey",
    },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.code, "INVALID_SURVEY_ID");
  assert.equal(serviceCalled, false);
});

test("does not expose PostgreSQL codes or messages in submission errors", async () => {
  feedbackService.submitFeedback = async () => {
    const error = new Error("database detail must remain private");
    error.code = "23505";
    throw error;
  };

  const originalConsoleError = console.error;
  console.error = () => {};
  const response = createResponse();
  try {
    await feedbackController.submitFeedback(
      {
        user: { user_id: 24 },
        params: { surveyId: "5" },
        body: { answers: validAnswers },
        get: () => "idem-key-db-error",
      },
      response
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.code, "INTERNAL_SERVER_ERROR");
  assert.doesNotMatch(JSON.stringify(response.body), /23505|database detail/);
});

test("rule-based comment analysis flags abuse without publishing comment text", async () => {
  let event;
  const unsubscribe = eventPublisher.subscribeToFeedbackSubmitted((value) => {
    event = value;
  });

  await feedbackService.submitFeedback({
    surveyId: 5,
    studentId: 20,
    answers: [
      { question_id: 10, rating_value: 4 },
      { question_id: 11, text_answer: "Great course, idiot." },
    ],
    idempotencyKey: "idem-key-comment",
  });
  unsubscribe();

  assert.equal(event.sentimentSummary.Positive, 1);
  assert.equal(event.flaggedCommentCount, 1);
  assert.equal("rawComment" in event, false);
  assert.equal("submissionId" in event, false);
});

test("redacts English email, Egyptian phone and 14-digit ID patterns while preserving feedback", async () => {
  const comment =
    "Clear lecture; email me at learner@example.com or call 01012345678. My ID is 29001012345678 and my score was 5/5.";

  await feedbackService.submitFeedback({
    surveyId: 5,
    studentId: 20,
    answers: [validAnswers[0], { question_id: 11, text_answer: comment }],
    idempotencyKey: "idem-key-english-pii",
  });

  assert.equal(
    savedAnswers[1][4],
    "Clear lecture; email me at [REDACTED_EMAIL] or call [REDACTED_PHONE]. My ID is [REDACTED_ID] and my score was 5/5."
  );
});

test("recognizes correctly encoded Arabic sentiment and Arabic-Indic PII digits", async () => {
  let event;
  const unsubscribe = eventPublisher.subscribeToFeedbackSubmitted((value) => {
    event = value;
  });

  await feedbackService.submitFeedback({
    surveyId: 5,
    studentId: 20,
    answers: [
      validAnswers[0],
      {
        question_id: 11,
        text_answer:
          "المحاضرة ممتازة ومفيدة، رقمي ٠١٠١٢٣٤٥٦٧٨ ورقمي القومي ٢٩٠٠١٠١٢٣٤٥٦٧٨، ودرجتي ٥/٥.",
      },
    ],
    idempotencyKey: "idem-key-arabic-pii",
  });
  unsubscribe();

  assert.equal(
    savedAnswers[1][4],
    "المحاضرة ممتازة ومفيدة، رقمي [REDACTED_PHONE] ورقمي القومي [REDACTED_ID]، ودرجتي ٥/٥."
  );
  assert.equal(event.sentimentSummary.Positive, 1);
  assert.equal(event.flaggedCommentCount, 0);
});

test("detects Arabic negative and abuse keywords without stripping legitimate text", async () => {
  let event;
  const unsubscribe = eventPublisher.subscribeToFeedbackSubmitted((value) => {
    event = value;
  });

  await feedbackService.submitFeedback({
    surveyId: 5,
    studentId: 20,
    answers: [
      validAnswers[0],
      { question_id: 11, text_answer: "الشرح صعب، والأمثلة مرتبة. يا غبي." },
    ],
    idempotencyKey: "idem-key-arabic-abuse",
  });
  unsubscribe();

  assert.equal(
    savedAnswers[1][4],
    "الشرح صعب، والأمثلة مرتبة. يا غبي."
  );
  assert.equal(event.sentimentSummary.Negative, 1);
  assert.equal(event.flaggedCommentCount, 1);
});

test("local eligibility adapter does not cache enrollment decisions", async () => {
  const connection = {};
  let checks = 0;
  const originalCheck = feedbackModel.checkStudentEligibility;
  feedbackModel.checkStudentEligibility = async (_surveyId, _studentId, db) => {
    checks += 1;
    assert.equal(db, connection);
    return true;
  };

  try {
    assert.equal(await originalEligibilityCheck(5, 20, connection), true);
    assert.equal(await originalEligibilityCheck(5, 20, connection), true);
    assert.equal(checks, 2);
  } finally {
    feedbackModel.checkStudentEligibility = originalCheck;
  }
});

test("local eligibility adapter maps dependency errors to a safe 503", async () => {
  const originalCheck = feedbackModel.checkStudentEligibility;
  feedbackModel.checkStudentEligibility = async () => {
    throw new Error("database diagnostic must not reach the response");
  };

  try {
    await assert.rejects(
      originalEligibilityCheck(5, 20, {}),
      (error) =>
        error.code === "ELIGIBILITY_CHECK_UNAVAILABLE" &&
        error.statusCode === 503 &&
        !error.message.includes("database diagnostic")
    );
  } finally {
    feedbackModel.checkStudentEligibility = originalCheck;
  }
});

function createResponse() {
  return {
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
}
