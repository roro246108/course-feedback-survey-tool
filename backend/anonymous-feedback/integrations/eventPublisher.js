
const EventEmitter = require("events");

const localEventBus = new EventEmitter();

function publishFeedbackSubmitted(eventData) {
  if (!eventData || typeof eventData !== "object") {
    throw new Error("Invalid feedback event data.");
  }

  const event = {
    eventType: "FeedbackSubmitted",
    occurredAt: new Date().toISOString(),
    surveyId: eventData.surveyId,
    answerCount: eventData.answerCount,
    sentimentSummary: eventData.sentimentSummary,
    flaggedCommentCount: eventData.flaggedCommentCount,
  };

  // No student or submission identifier and no raw comments are published.
  localEventBus.emit("FeedbackSubmitted", event);

  return {
    published: true,
    eventType: event.eventType,
  };
}

function subscribeToFeedbackSubmitted(listener) {
  if (typeof listener !== "function") {
    throw new Error("Event listener must be a function.");
  }

  localEventBus.on("FeedbackSubmitted", listener);

  return () => {
    localEventBus.off("FeedbackSubmitted", listener);
  };
}

module.exports = {
  publishFeedbackSubmitted,
  subscribeToFeedbackSubmitted,
};
