const {
  calculateReminderSchedule,
  formatCairoDate,
  isReminderDue,
} = require("../dateUtils");
const { createSurveyReminderTemplate } = require("../../notifications/templates/surveyReminderTemplate");
const brevoEmailService = require("../../notifications/brevoEmailService");
const reminderModel = require("../models/reminderModel");
const { buildReminderTag } = require("./brevoReminderLedger");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IN_MEMORY_ATTEMPTS = 10000;

function createConfigurationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getFrontendBaseUrl(frontendUrl) {
  if (typeof frontendUrl !== "string" || !frontendUrl.trim()) {
    throw createConfigurationError(
      "FRONTEND_URL_REQUIRED",
      "FRONTEND_URL is required for survey reminders."
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(frontendUrl);
  } catch {
    throw createConfigurationError(
      "FRONTEND_URL_INVALID",
      "FRONTEND_URL must be a valid HTTP(S) URL."
    );
  }

  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw createConfigurationError(
      "FRONTEND_URL_INVALID",
      "FRONTEND_URL must be a valid HTTP(S) base URL."
    );
  }

  return parsedUrl.origin;
}

function buildSurveyUrl(frontendBaseUrl, surveyId) {
  const parsedId = Number(surveyId);
  if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
    throw new TypeError("A valid survey ID is required to build the survey URL.");
  }

  return new URL(`/surveys/${parsedId}`, frontendBaseUrl).href;
}

function isCandidateEligible(candidate) {
  return Boolean(
    candidate &&
      candidate.survey_status === "Published" &&
      candidate.student_role === "Student" &&
      candidate.account_status === "Active" &&
      candidate.email_verified === true &&
      Number(candidate.course_id) === Number(candidate.enrolled_course_id) &&
      Number(candidate.semester_id) === Number(candidate.enrolled_semester_id)
  );
}

function getAttemptKey(candidate) {
  return `${candidate.survey_id}:${candidate.student_id}`;
}

function createSurveyReminderService({
  model = reminderModel,
  emailService = brevoEmailService,
  template = createSurveyReminderTemplate,
  env = process.env,
  logger = console,
  now = () => new Date(),
  attemptStates = new Map(),
  // Optional durable duplicate check (see brevoReminderLedger.js).
  deliveryLedger = null,
} = {}) {
  function trimAttemptStates() {
    while (attemptStates.size > MAX_IN_MEMORY_ATTEMPTS) {
      const evictableKey = [...attemptStates.entries()].find(
        ([, state]) => state !== "in_progress"
      )?.[0];
      if (!evictableKey) {
        return;
      }
      attemptStates.delete(evictableKey);
    }
  }

  function reserveAttempt(key) {
    if (attemptStates.has(key)) {
      return false;
    }

    attemptStates.set(key, "in_progress");
    trimAttemptStates();
    return true;
  }

  function setAttemptState(key, state) {
    attemptStates.set(key, state);
    trimAttemptStates();
  }

  function addSkipped(summary, reason, surveyId) {
    summary.skipped += 1;
    summary.skippedReasons[reason] =
      (summary.skippedReasons[reason] || 0) + 1;
    logger.warn?.("[survey-reminders] candidate skipped", {
      surveyId,
      reason,
    });
  }

  async function runDueReminders() {
    const frontendBaseUrl = getFrontendBaseUrl(env.FRONTEND_URL);
    const candidates = await model.getDueReminderCandidates();
    const summary = {
      candidates: candidates.length,
      accepted: 0,
      failed: 0,
      unknown: 0,
      skipped: 0,
      skippedReasons: {},
    };

    for (const candidate of candidates) {
      const schedule = calculateReminderSchedule(
        candidate.opening_date,
        candidate.closing_date
      );

      if (!schedule.valid) {
        addSkipped(summary, schedule.reason, candidate.survey_id);
        continue;
      }

      if (!isCandidateEligible(candidate)) {
        addSkipped(summary, "CANDIDATE_NO_LONGER_ELIGIBLE", candidate.survey_id);
        continue;
      }

      if (!isReminderDue(schedule, now())) {
        addSkipped(summary, "NOT_DUE_OR_SURVEY_CLOSED", candidate.survey_id);
        continue;
      }

      const recipient =
        typeof candidate.student_email === "string"
          ? candidate.student_email.trim()
          : "";
      if (!EMAIL_PATTERN.test(recipient)) {
        addSkipped(summary, "INVALID_RECIPIENT_EMAIL", candidate.survey_id);
        continue;
      }

      if (
        typeof candidate.survey_title !== "string" ||
        !candidate.survey_title.trim() ||
        typeof candidate.course_name !== "string" ||
        !candidate.course_name.trim()
      ) {
        addSkipped(summary, "INVALID_SURVEY_OR_COURSE_DATA", candidate.survey_id);
        continue;
      }

      if (
        !Number.isSafeInteger(Number(candidate.survey_id)) ||
        Number(candidate.survey_id) <= 0
      ) {
        addSkipped(summary, "INVALID_SURVEY_URL", candidate.survey_id);
        continue;
      }

      const attemptKey = getAttemptKey(candidate);
      if (!reserveAttempt(attemptKey)) {
        addSkipped(summary, "ALREADY_ATTEMPTED_IN_THIS_PROCESS", candidate.survey_id);
        continue;
      }

      let currentCandidate;
      try {
        currentCandidate = await model.getCandidateIfStillEligible(
          candidate.survey_id,
          candidate.student_id
        );
      } catch {
        attemptStates.delete(attemptKey);
        summary.failed += 1;
        logger.error?.("[survey-reminders] eligibility recheck failed", {
          surveyId: candidate.survey_id,
          code: "ELIGIBILITY_RECHECK_FAILED",
        });
        continue;
      }

      if (!currentCandidate) {
        attemptStates.delete(attemptKey);
        addSkipped(summary, "NO_LONGER_ELIGIBLE", candidate.survey_id);
        continue;
      }

      const currentSchedule = calculateReminderSchedule(
        currentCandidate.opening_date,
        currentCandidate.closing_date
      );
      if (
        !currentSchedule.valid ||
        !isCandidateEligible(currentCandidate) ||
        !isReminderDue(currentSchedule, now())
      ) {
        attemptStates.delete(attemptKey);
        addSkipped(summary, "NO_LONGER_ELIGIBLE_OR_OPEN", candidate.survey_id);
        continue;
      }

      const currentRecipient =
        typeof currentCandidate.student_email === "string"
          ? currentCandidate.student_email.trim()
          : "";
      if (!EMAIL_PATTERN.test(currentRecipient)) {
        attemptStates.delete(attemptKey);
        addSkipped(summary, "INVALID_RECIPIENT_EMAIL", candidate.survey_id);
        continue;
      }

      let currentSurveyUrl;
      let message;
      try {
        currentSurveyUrl = buildSurveyUrl(
          frontendBaseUrl,
          currentCandidate.survey_id
        );
        if (
          typeof currentCandidate.survey_title !== "string" ||
          !currentCandidate.survey_title.trim() ||
          typeof currentCandidate.course_name !== "string" ||
          !currentCandidate.course_name.trim()
        ) {
          throw new TypeError("Survey and course names are required.");
        }
        message = template({
          studentName: currentCandidate.student_name,
          surveyTitle: currentCandidate.survey_title,
          courseName: currentCandidate.course_name,
          closingDate: formatCairoDate(currentSchedule.closingDate),
          surveyUrl: currentSurveyUrl,
        });
        if (
          !message ||
          typeof message.html !== "string" ||
          typeof message.text !== "string"
        ) {
          throw new TypeError("The reminder template returned invalid content.");
        }
      } catch {
        attemptStates.delete(attemptKey);
        addSkipped(summary, "INVALID_REMINDER_CONTENT", candidate.survey_id);
        continue;
      }

      if (deliveryLedger) {
        let ledgerResult;
        try {
          ledgerResult = await deliveryLedger.hasReminderBeenSent({
            email: currentRecipient,
            surveyId: currentCandidate.survey_id,
          });
        } catch {
          ledgerResult = { known: false, code: "LEDGER_ERROR" };
        }

        if (!ledgerResult || ledgerResult.known !== true) {
          // Fail closed: skip now, retry on the next run while still open.
          attemptStates.delete(attemptKey);
          addSkipped(summary, "DELIVERY_LEDGER_UNAVAILABLE", candidate.survey_id);
          continue;
        }

        if (ledgerResult.sent === true) {
          setAttemptState(attemptKey, "accepted");
          addSkipped(summary, "ALREADY_SENT_PER_PROVIDER_LOG", candidate.survey_id);
          continue;
        }
      }

      let result;
      try {
        result = await emailService.sendTransactionalEmail({
          to: currentRecipient,
          toName:
            typeof currentCandidate.student_name === "string"
              ? currentCandidate.student_name
              : undefined,
          subject: `Course feedback reminder: ${currentCandidate.survey_title
            .replace(/[\r\n]+/g, " ")
            .trim()}`,
          html: message.html,
          text: message.text,
          ...(deliveryLedger
            ? { tags: [buildReminderTag(currentCandidate.survey_id)] }
            : {}),
        });
      } catch {
        setAttemptState(attemptKey, "unknown");
        summary.unknown += 1;
        logger.error?.("[survey-reminders] provider outcome is unknown", {
          surveyId: candidate.survey_id,
          code: "BREVO_ADAPTER_ERROR",
        });
        continue;
      }

      if (result?.accepted === true && result.status === "accepted") {
        setAttemptState(attemptKey, "accepted");
        summary.accepted += 1;
        continue;
      }

      if (result?.accepted === false && result.status === "failed") {
        attemptStates.delete(attemptKey);
        summary.failed += 1;
        logger.error?.("[survey-reminders] provider rejected reminder", {
          surveyId: candidate.survey_id,
          code: result.error?.code || "BREVO_REJECTION",
        });
        continue;
      }

      setAttemptState(attemptKey, "unknown");
      summary.unknown += 1;
      logger.error?.("[survey-reminders] provider outcome is unknown", {
        surveyId: candidate.survey_id,
        code: result?.error?.code || "BREVO_OUTCOME_UNKNOWN",
      });
    }

    logger.info?.("[survey-reminders] run completed", {
      candidates: summary.candidates,
      accepted: summary.accepted,
      failed: summary.failed,
      unknown: summary.unknown,
      skipped: summary.skipped,
    });
    return summary;
  }

  return { runDueReminders };
}

const defaultService = createSurveyReminderService();

module.exports = {
  buildSurveyUrl,
  createSurveyReminderService,
  getFrontendBaseUrl,
  isCandidateEligible,
  runDueReminders: defaultService.runDueReminders,
};
