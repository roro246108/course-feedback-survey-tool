
const crypto = require("crypto");

const feedbackModel = require("../models/feedbackModel");
const surveyManagementClient = require("../integrations/surveyManagementClient");
const eventPublisher = require("../integrations/eventPublisher");

// ======================================
// Errors and Helpers
// ======================================

function createError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function hashValue(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

// The payload fingerprint is keyed with the original idempotency key.
// The raw key is never stored in the database.
function createPayloadHash(payload, idempotencyKey) {
  return crypto
    .createHmac("sha256", idempotencyKey)
    .update(JSON.stringify(payload))
    .digest("hex");
}

// ======================================
// PII Redaction
// ======================================

// These are rule-based patterns, not a complete PII detector.
// Names and other context-dependent personal details may not be detected.
function redactPersonalInformation(value) {
  if (typeof value !== "string") {
    return value;
  }

  // Redact recognized patterns only; preserve surrounding feedback verbatim.
  let redacted = value.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[REDACTED_EMAIL]"
  );

  // Normalize Arabic-Indic and Eastern Arabic-Indic numerals only in a
  // temporary matching copy. Their code points are one UTF-16 unit each, so
  // match offsets still address the original feedback correctly.
  const normalizeDigits = (text) => text.replace(/[٠-٩۰-۹]/g, (digit) => {
    const codePoint = digit.codePointAt(0);
    const start = codePoint >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(codePoint - start);
  });
  let normalizedDigits = normalizeDigits(redacted);

  const redactMatches = (source, normalized, pattern, replacement) => {
    const matches = [...normalized.matchAll(pattern)];

    for (const match of matches.reverse()) {
      source =
        source.slice(0, match.index) +
        replacement +
        source.slice(match.index + match[0].length);
    }

    return source;
  };

  // Egyptian mobile formats, including optional international/local prefixes.
  redacted = redactMatches(
    redacted,
    normalizedDigits,
    /(?<!\d)(?:\+?20|0020|0)?1[0125]\d{8}(?!\d)/g,
    "[REDACTED_PHONE]"
  );
  normalizedDigits = normalizeDigits(redacted);

  // A 14-digit Egyptian national-ID-shaped value. This is a pattern match,
  // not verification that the value is a valid issued national ID.
  redacted = redactMatches(
    redacted,
    normalizedDigits,
    /(?<!\d)\d{14}(?!\d)/g,
    "[REDACTED_ID]"
  );

  return redacted;
}

// ======================================
// Comment Processing
// ======================================

const POSITIVE_WORDS = [
  "good",
  "great",
  "excellent",
  "helpful",
  "amazing",
  "clear",
  "ممتاز",
  "ممتازة",
  "كويس",
  "جيد",
  "رائع",
  "مفيد",
  "مفيدة",
  "واضح",
  "حلو",
];

const NEGATIVE_WORDS = [
  "bad",
  "poor",
  "terrible",
  "awful",
  "confusing",
  "unhelpful",
  "مش كويس",
  "سيء",
  "وحش",
  "صعب",
  "غير مفيد",
  "مش واضح",
  "سيئ",
];

const ABUSIVE_WORDS = [
  "idiot",
  "stupid",
  "damn",
  "غبي",
  "حمار",
  "قذر",
];

function containsKeyword(text, keywords) {
  const normalizedText = text.toLowerCase();

  return keywords.some((word) => {
    const escapedWord = word.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapedWord}($|[^\\p{L}\\p{N}])`,
      "iu"
    );

    return pattern.test(normalizedText);
  });
}

function analyzeSentiment(text) {
  const positive = containsKeyword(text, POSITIVE_WORDS);
  const negative = containsKeyword(text, NEGATIVE_WORDS);

  if (positive && !negative) {
    return "Positive";
  }

  if (negative && !positive) {
    return "Negative";
  }

  return "Neutral";
}

function processComment(value) {
  const redactedText = redactPersonalInformation(value);

  return {
    text: redactedText,
    sentiment: analyzeSentiment(redactedText),
    isAbusive: containsKeyword(redactedText, ABUSIVE_WORDS),
  };
}

// ======================================
// Text Sanitization
// ======================================

function sanitizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw createError(
      "Text answer must be a string.",
      400,
      "INVALID_ANSWER_TYPE"
    );
  }

  const sanitized = value
    .replace(/\0/g, "")
    .trim();

  if (sanitized.length > 2000) {
    throw createError(
      "Text answer cannot exceed 2000 characters.",
      400,
      "TEXT_ANSWER_TOO_LONG"
    );
  }

  return sanitized;
}

// ======================================
// Normalize Answers
// ======================================

function normalizeAnswers(answers) {
  if (!Array.isArray(answers) || answers.length === 0) {
    throw createError(
      "Answers must be a non-empty array.",
      400,
      "INVALID_ANSWERS"
    );
  }

  return answers.map((answer) => {
    if (
      !answer ||
      typeof answer !== "object" ||
      Array.isArray(answer)
    ) {
      throw createError(
        "Each answer must be a valid object.",
        400,
        "INVALID_ANSWERS"
      );
    }

    const rawQuestionId = answer.question_id;
    const validQuestionId =
      (typeof rawQuestionId === "number" &&
        Number.isSafeInteger(rawQuestionId) &&
        rawQuestionId > 0) ||
      (typeof rawQuestionId === "string" &&
        /^[1-9]\d*$/.test(rawQuestionId) &&
        Number.isSafeInteger(Number(rawQuestionId)));
    const questionId = Number(rawQuestionId);

    if (
      !validQuestionId
    ) {
      throw createError(
        "Invalid question ID.",
        400,
        "INVALID_QUESTION"
      );
    }

    let ratingValue = null;

    if (
      answer.rating_value !== undefined &&
      answer.rating_value !== null &&
      answer.rating_value !== ""
    ) {
      ratingValue =
        typeof answer.rating_value === "number"
          ? answer.rating_value
          : Number.NaN;
    }

    const textAnswer = sanitizeText(answer.text_answer);

    return {
      question_id: questionId,
      rating_value: ratingValue,
      text_answer: textAnswer,
    };
  });
}

// ======================================
// Validate Answers
// ======================================

function validateAnswers(answers, questions) {
  const questionMap = new Map(
    questions.map((question) => [
      Number(question.question_id),
      question,
    ])
  );

  const submittedQuestionIds = new Set();

  for (const answer of answers) {
    if (!questionMap.has(answer.question_id)) {
      throw createError(
        "One or more questions do not belong to this survey.",
        400,
        "INVALID_QUESTION"
      );
    }

    if (submittedQuestionIds.has(answer.question_id)) {
      throw createError(
        "Duplicate question answers are not allowed.",
        400,
        "DUPLICATE_QUESTION"
      );
    }

    submittedQuestionIds.add(answer.question_id);

    const question = questionMap.get(answer.question_id);

    if (question.question_type === "Rating") {
      if (
        !Number.isInteger(answer.rating_value) ||
        answer.rating_value < 1 ||
        answer.rating_value > 5
      ) {
        throw createError(
          "Rating must be an integer between 1 and 5.",
          400,
          "INVALID_RATING"
        );
      }

      if (answer.text_answer !== null) {
        throw createError(
          "Rating questions cannot contain a text answer.",
          400,
          "INVALID_ANSWER_TYPE"
        );
      }
    } else if (question.question_type === "Text") {
      if (
        answer.rating_value !== null ||
        typeof answer.text_answer !== "string" ||
        answer.text_answer.length === 0
      ) {
        throw createError(
          "A valid text answer is required.",
          400,
          "INVALID_ANSWER_TYPE"
        );
      }
    } else {
      throw createError(
        "Unsupported question type.",
        400,
        "UNSUPPORTED_QUESTION_TYPE"
      );
    }
  }

  for (const question of questions) {
    if (
      question.is_required &&
      !submittedQuestionIds.has(Number(question.question_id))
    ) {
      throw createError(
        "All required questions must be answered.",
        400,
        "REQUIRED_QUESTION_MISSING"
      );
    }
  }
}

// ======================================
// Process Answers Before Storage
// ======================================

function processAnswers(answers, questions) {
  const questionMap = new Map(
    questions.map((question) => [
      Number(question.question_id),
      question,
    ])
  );

  const sentimentSummary = {
    Positive: 0,
    Negative: 0,
    Neutral: 0,
  };

  let flaggedCommentCount = 0;

  const processedAnswers = answers.map((answer) => {
    const question = questionMap.get(answer.question_id);

    if (question.question_type !== "Text") {
      return answer;
    }

    const processedComment = processComment(answer.text_answer);

    sentimentSummary[processedComment.sentiment] += 1;

    if (processedComment.isAbusive) {
      flaggedCommentCount += 1;
    }

    return {
      ...answer,
      text_answer: processedComment.text,
    };
  });

  return {
    answers: processedAnswers,
    sentimentSummary,
    flaggedCommentCount,
  };
}

// ======================================
// Submit Feedback
// ======================================

async function submitFeedback({
  surveyId,
  studentId,
  answers,
  idempotencyKey,
}) {
  // 1. Validate IDs
  const parsedSurveyId = Number(surveyId);
  const parsedStudentId = Number(studentId);

  if (
    !Number.isSafeInteger(parsedSurveyId) ||
    parsedSurveyId <= 0
  ) {
    throw createError(
      "Invalid survey ID.",
      400,
      "INVALID_SURVEY_ID"
    );
  }

  if (
    !Number.isSafeInteger(parsedStudentId) ||
    parsedStudentId <= 0
  ) {
    throw createError(
      "Student authentication is required.",
      401,
      "STUDENT_ID_REQUIRED"
    );
  }

  // 2. Validate Idempotency Key
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length < 8 ||
    idempotencyKey.trim().length > 255
  ) {
    throw createError(
      "A valid Idempotency-Key header is required.",
      400,
      "IDEMPOTENCY_KEY_REQUIRED"
    );
  }

  const normalizedIdempotencyKey = idempotencyKey.trim();

  // 3. Normalize answers
  const normalizedAnswers = normalizeAnswers(answers);

  // 4. Hash the idempotency key
  const idempotencyKeyHash = hashValue(
    normalizedIdempotencyKey
  );
  const payloadHash = createPayloadHash(
    normalizedAnswers,
    normalizedIdempotencyKey
  );

  try {
    // Run the full submission decision and writes in one transaction.
    const transactionResult =
      await feedbackModel.withTransaction(async (client) => {
        // Lock the survey so concurrent submissions are serialized.
        const survey =
          await feedbackModel.getSurveyForSubmission(
            client,
            parsedSurveyId
          );

        if (!survey) {
          throw createError(
            "Survey not found.",
            404,
            "SURVEY_NOT_FOUND"
          );
        }

        // Resolve idempotent retries before current eligibility/open checks.
        // A successful submission must remain safely replayable after closure.
        const existingIdempotencyRecord =
          await feedbackModel.getIdempotencyRecord(
            client,
            parsedSurveyId,
            parsedStudentId,
            idempotencyKeyHash
          );

        if (existingIdempotencyRecord) {
          if (
            existingIdempotencyRecord.payload_hash !== payloadHash
          ) {
            throw createError(
              "This Idempotency-Key was already used with a different request.",
              409,
              "IDEMPOTENCY_KEY_REUSED"
            );
          }

          return {
            alreadyProcessed: true,
            surveyId: parsedSurveyId,
            message: "This feedback request was already processed.",
          };
        }

        // Use the transaction connection so enrollment is checked without a
        // process-local cache that could retain stale eligibility.
        const isEligible =
          await surveyManagementClient.checkStudentEligibility(
            parsedSurveyId,
            parsedStudentId,
            client
          );

        if (!isEligible) {
          throw createError(
            "You are not eligible to submit feedback for this survey.",
            403,
            "STUDENT_NOT_ELIGIBLE"
          );
        }

        if (!survey.is_open) {
          throw createError(
            "This survey is not currently open.",
            403,
            "SURVEY_NOT_OPEN"
          );
        }

        // Get survey questions only for a new submission.
        const questions =
          await feedbackModel.getSurveyQuestions(
            client,
            parsedSurveyId
          );

        if (!questions || questions.length === 0) {
          throw createError(
            "This survey has no questions.",
            400,
            "SURVEY_HAS_NO_QUESTIONS"
          );
        }

        // Validate answers against the actual survey questions.
        validateAnswers(normalizedAnswers, questions);

        // Process and redact text before storing it.
        const processingResult = processAnswers(
          normalizedAnswers,
          questions
        );

        // Record participation separately from anonymous answers.
        const participation = await feedbackModel.recordParticipation(
          client,
          parsedSurveyId,
          parsedStudentId
        );

        if (!participation?.participation_id) {
          throw createError(
            "Failed to record participation.",
            500,
            "PARTICIPATION_CREATION_FAILED"
          );
        }

        // Create anonymous submission.
        const submission =
          await feedbackModel.createSubmission(
            client,
            parsedSurveyId
          );

        // Supports either an object or scalar return value
        // from the model while keeping the database ID unchanged.
        const submissionId =
          typeof submission === "object" && submission !== null
            ? submission.submission_id
            : submission;

        if (!submissionId) {
          throw createError(
            "Failed to create feedback submission.",
            500,
            "SUBMISSION_CREATION_FAILED"
          );
        }

        // Save processed answers.
        for (const answer of processingResult.answers) {
          await feedbackModel.saveAnswer(
            client,
            submissionId,
            answer.question_id,
            answer.rating_value,
            answer.text_answer
          );
        }

        // Save idempotency record.
        // It does not contain submission_id.
        await feedbackModel.saveIdempotencyRecord(
          client,
          parsedSurveyId,
          parsedStudentId,
          idempotencyKeyHash,
          payloadHash
        );

        return {
          alreadyProcessed: false,
          surveyId: parsedSurveyId,
          submissionId,
          answerCount: processingResult.answers.length,
          sentimentSummary: processingResult.sentimentSummary,
          flaggedCommentCount: processingResult.flaggedCommentCount,
          message: "Feedback submitted successfully.",
        };
      });

    // 7. Publish the local event only after the transaction commits.
    if (!transactionResult.alreadyProcessed) {
      try {
        eventPublisher.publishFeedbackSubmitted({
          surveyId: transactionResult.surveyId,
          answerCount: transactionResult.answerCount,
          sentimentSummary: transactionResult.sentimentSummary,
          flaggedCommentCount: transactionResult.flaggedCommentCount,
        });
      } catch (eventError) {
        // The database transaction has already committed.
        // Do not tell the student that submission failed.
        // Event delivery will need a durable outbox/SQS integration
        // when the team integrates the deployed services.
      }
    }

    return {
      surveyId: transactionResult.surveyId,
      alreadyProcessed: transactionResult.alreadyProcessed,
      message: transactionResult.message,
    };
  } catch (error) {
    // Handle duplicate participation.
    if (
      error.code === "23505" &&
      error.constraint === "participation_survey_id_student_id_key"
    ) {
      throw createError(
        "You have already submitted this survey.",
        409,
        "ALREADY_SUBMITTED"
      );
    }

    throw error;
  }
}

async function getStudentSubmissionMetadata(studentId) {
  const parsedStudentId = Number(studentId);
  if (!Number.isSafeInteger(parsedStudentId) || parsedStudentId <= 0) {
    throw createError("Authentication is required.", 401, "STUDENT_ID_REQUIRED");
  }

  return feedbackModel.getStudentSubmissionMetadata(parsedStudentId);
}

// ======================================
// Exports
// ======================================

module.exports = {
  submitFeedback,
  getStudentSubmissionMetadata,
};
