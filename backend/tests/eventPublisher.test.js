const assert = require("node:assert/strict");
const { test } = require("node:test");

const eventPublisher = require("../anonymous-feedback/integrations/eventPublisher");

test("publishes the privacy-minimized FeedbackSubmitted contract", () => {
  let receivedEvent;
  const unsubscribe = eventPublisher.subscribeToFeedbackSubmitted((event) => {
    receivedEvent = event;
  });

  const result = eventPublisher.publishFeedbackSubmitted({
    surveyId: 5,
    answerCount: 2,
    sentimentSummary: { Positive: 1, Negative: 0, Neutral: 1 },
    flaggedCommentCount: 0,
    studentId: 20,
    submissionId: 77,
    email: "student@example.com",
    rawComment: "private comment",
  });
  unsubscribe();

  assert.equal(result.published, true);
  assert.equal(receivedEvent.eventType, "FeedbackSubmitted");
  assert.equal(receivedEvent.surveyId, 5);
  assert.equal(receivedEvent.answerCount, 2);
  assert.equal("studentId" in receivedEvent, false);
  assert.equal("submissionId" in receivedEvent, false);
  assert.equal("email" in receivedEvent, false);
  assert.equal("rawComment" in receivedEvent, false);
});
