const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_TIMEOUT_MS = 10000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function failure(status, code, message, statusCode) {
  return {
    accepted: false,
    status,
    messageId: null,
    error: {
      code,
      message,
      ...(statusCode ? { statusCode } : {}),
    },
  };
}

function createBrevoEmailService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  async function sendTransactionalEmail({
    to,
    toName,
    subject,
    html,
    text,
    tags,
  } = {}) {
    const apiKey =
      typeof env.BREVO_API_KEY === "string" ? env.BREVO_API_KEY.trim() : "";
    const senderEmail =
      typeof env.BREVO_SENDER_EMAIL === "string"
        ? env.BREVO_SENDER_EMAIL.trim()
        : "";

    if (!apiKey) {
      return failure(
        "failed",
        "BREVO_CONFIGURATION_ERROR",
        "BREVO_API_KEY is required."
      );
    }

    if (!senderEmail) {
      return failure(
        "failed",
        "BREVO_CONFIGURATION_ERROR",
        "BREVO_SENDER_EMAIL is required."
      );
    }

    if (!EMAIL_PATTERN.test(senderEmail)) {
      return failure(
        "failed",
        "BREVO_CONFIGURATION_ERROR",
        "BREVO_SENDER_EMAIL must be a valid email address."
      );
    }

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return failure(
        "failed",
        "BREVO_CONFIGURATION_ERROR",
        "The Brevo request timeout must be a positive number."
      );
    }

    if (
      typeof fetchImpl !== "function" ||
      typeof AbortController !== "function"
    ) {
      return failure(
        "failed",
        "BREVO_RUNTIME_UNSUPPORTED",
        "This Node.js runtime must provide fetch and AbortController."
      );
    }

    if (typeof to !== "string" || !EMAIL_PATTERN.test(to.trim())) {
      return failure(
        "failed",
        "BREVO_INVALID_REQUEST",
        "A valid recipient email address is required."
      );
    }

    if (typeof subject !== "string" || !subject.trim()) {
      return failure(
        "failed",
        "BREVO_INVALID_REQUEST",
        "A non-empty subject is required."
      );
    }

    if (
      (html !== undefined && typeof html !== "string") ||
      (text !== undefined && typeof text !== "string") ||
      (!html && !text)
    ) {
      return failure(
        "failed",
        "BREVO_INVALID_REQUEST",
        "HTML content or plain-text content is required."
      );
    }

    if (
      (toName !== undefined && typeof toName !== "string") ||
      (env.BREVO_SENDER_NAME !== undefined &&
        typeof env.BREVO_SENDER_NAME !== "string")
    ) {
      return failure(
        "failed",
        "BREVO_INVALID_REQUEST",
        "Recipient and sender names must be strings."
      );
    }

    if (
      tags !== undefined &&
      (!Array.isArray(tags) ||
        tags.length > 10 ||
        tags.some(
          (tag) =>
            typeof tag !== "string" || !/^[A-Za-z0-9:_-]{1,100}$/.test(tag)
        ))
    ) {
      return failure(
        "failed",
        "BREVO_INVALID_REQUEST",
        "Tags must be an array of up to 10 simple strings."
      );
    }

    const recipient = { email: to.trim() };
    if (toName && toName.trim()) {
      recipient.name = toName.trim();
    }

    const sender = { email: senderEmail };
    if (env.BREVO_SENDER_NAME && env.BREVO_SENDER_NAME.trim()) {
      sender.name = env.BREVO_SENDER_NAME.trim();
    }

    const requestBody = {
      sender,
      to: [recipient],
      subject: subject.trim(),
      ...(html ? { htmlContent: html } : {}),
      ...(text ? { textContent: text } : {}),
      ...(tags && tags.length > 0 ? { tags: [...tags] } : {}),
    };
    const controller = new AbortController();
    let timeoutId;
    let didTimeout = false;
    const request = (async () => {
      const response = await fetchImpl(BREVO_API_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (
        !response ||
        !Number.isInteger(response.status) ||
        response.status < 100 ||
        response.status > 599
      ) {
        return failure(
          "unknown",
          "BREVO_UNEXPECTED_RESPONSE",
          "Brevo returned an invalid response."
        );
      }

      if (typeof response.text !== "function") {
        return failure(
          "unknown",
          "BREVO_UNEXPECTED_RESPONSE",
          "Brevo returned a response without a readable body.",
          response.status
        );
      }

      const responseText = await response.text();

      if (response.status < 200 || response.status >= 300) {
        const definiteRejection =
          response.status >= 400 && response.status < 500;
        return failure(
          definiteRejection ? "failed" : "unknown",
          definiteRejection
            ? "BREVO_HTTP_ERROR"
            : "BREVO_UNCONFIRMED_RESPONSE",
          definiteRejection
            ? `Brevo rejected the request with HTTP ${response.status}.`
            : `Brevo did not confirm acceptance (HTTP ${response.status}).`,
          response.status
        );
      }

      let responseBody;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        return failure(
          "unknown",
          "BREVO_UNEXPECTED_RESPONSE",
          "Brevo returned an unreadable success response.",
          response.status
        );
      }

      if (
        !responseBody ||
        typeof responseBody.messageId !== "string" ||
        !responseBody.messageId.trim()
      ) {
        return failure(
          "unknown",
          "BREVO_UNEXPECTED_RESPONSE",
          "Brevo's success response did not contain a message ID.",
          response.status
        );
      }

      return {
        accepted: true,
        status: "accepted",
        messageId: responseBody.messageId.trim(),
        statusCode: response.status,
      };
    })();
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
        const error = new Error("Brevo request timed out.");
        error.code = "BREVO_REQUEST_TIMEOUT";
        reject(error);
      }, timeoutMs);
    });

    try {
      return await Promise.race([request, timeout]);
    } catch (error) {
      if (didTimeout || (error && error.name === "AbortError")) {
        return failure(
          "unknown",
          "BREVO_REQUEST_TIMEOUT",
          "The Brevo request timed out; provider acceptance is unknown."
        );
      }

      return failure(
        "unknown",
        "BREVO_NETWORK_ERROR",
        "The Brevo request failed before a provider response was received."
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { sendTransactionalEmail };
}

async function sendTransactionalEmail(options) {
  return createBrevoEmailService().sendTransactionalEmail(options);
}

module.exports = {
  createBrevoEmailService,
  sendTransactionalEmail,
};
