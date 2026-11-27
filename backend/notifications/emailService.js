
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from backend/.env
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

function sanitizeProviderMessage(message) {
  const normalizedMessage =
    typeof message === "string" && message.trim()
      ? message.trim()
      : "The provider returned no diagnostic message.";

  return normalizedMessage
    .replace(/[\r\n\t]+/g, " ")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/\bBearer\s+[^\s]+/gi, "Bearer [credential redacted]")
    .replace(/\b(?:re|rk|sk)_[A-Za-z0-9_-]{8,}\b/gi, "[credential redacted]")
    .replace(
      /\b(EMAIL_APP_PASSWORD|RESEND_API_KEY)\s*=\s*[^,;]+/gi,
      "$1=[credential redacted]"
    )
    .replace(
      /\b(api[_ -]?key|token|secret|password)\b\s*[:=]\s*[^,;]+/gi,
      "$1=[credential redacted]"
    )
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[sensitive value redacted]")
    .slice(0, 400);
}

function safeProviderCode(error) {
  const candidate =
    (error && error.name !== "Error" && error.name) ||
    (error && error.code) ||
    "";

  return typeof candidate === "string" &&
    /^[A-Za-z0-9_.-]{1,64}$/.test(candidate)
    ? candidate
    : null;
}

class EmailDeliveryError extends Error {
  constructor(error, provider = "Resend") {
    const statusCode = Number(
      error &&
        (error.statusCode ||
          error.status ||
          error.httpStatusCode ||
          error.responseCode)
    );
    const safeStatusCode =
      Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599
        ? statusCode
        : null;
    const providerCode = safeProviderCode(error);
    const safeMessage = sanitizeProviderMessage(error && error.message);
    const statusLabel = provider === "Resend" ? "HTTP" : "SMTP";
    const statusDescription = safeStatusCode
      ? ` (${statusLabel} ${safeStatusCode})`
      : "";
    const codeDescription = providerCode ? ` ${providerCode}` : "";

    super(`${provider}${codeDescription}${statusDescription}: ${safeMessage}`);

    this.name = "EmailDeliveryError";
    this.code = "EMAIL_DELIVERY_FAILED";
    this.provider = provider;
    this.providerCode = providerCode;
    this.statusCode = safeStatusCode;
    this.safeMessage = safeMessage;
  }
}

function toEmailDeliveryError(error, provider = "Resend") {
  return error instanceof EmailDeliveryError
    ? error
    : new EmailDeliveryError(error, provider);
}

/**
 * Send an email using the configured provider.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email content
 * @param {string} [options.text] - Plain text email content
 */
async function sendEmail({ to, subject, html, text }) {
  if (!to || !subject || !html) {
    throw new Error("Recipient, subject and HTML content are required.");
  }

  return sendUsingProvider({
    to,
    subject,
    html,
    text,
  });
}

async function sendEmailWithClient(client, from, { to, subject, html, text }) {
  let result;
  try {
    result = await client.emails.send({
      from,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
  } catch (error) {
    throw toEmailDeliveryError(error);
  }

  if (!result || result.error) {
    throw toEmailDeliveryError(
      result
        ? result.error
        : { message: "The provider returned an empty response." }
    );
  }

  if (!result.data) {
    throw toEmailDeliveryError({
      message: "The provider returned an empty email result.",
    });
  }

  return result.data;
}

async function sendEmailWithGmail(transporter, from, options) {
  try {
    const result = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.text ? { text: options.text } : {}),
    });

    if (
      result &&
      ((Array.isArray(result.rejected) && result.rejected.length > 0) ||
        (Array.isArray(result.accepted) && result.accepted.length === 0))
    ) {
      const error = new Error("SMTP server rejected the recipient.");
      error.code = "SMTP_RECIPIENT_REJECTED";
      error.responseCode = result.responseCode;
      throw error;
    }

    if (!result) {
      throw new Error("SMTP transport returned an empty delivery result.");
    }

    return result;
  } catch (error) {
    throw toEmailDeliveryError(error, "Gmail SMTP");
  }
}

function createEmailSender({
  provider,
  env = process.env,
  resendClient,
  smtpTransporter,
  nodemailerModule,
}) {
  const selectedProvider = String(provider || "").trim().toLowerCase();

  if (selectedProvider === "gmail") {
    if (!env.EMAIL_USER || !env.EMAIL_APP_PASSWORD) {
      throw new Error(
        "EMAIL_USER and EMAIL_APP_PASSWORD are required for Gmail SMTP."
      );
    }

    const transporter =
      smtpTransporter ||
      (nodemailerModule || require("nodemailer")).createTransport({
        service: "gmail",
        auth: {
          user: env.EMAIL_USER,
          pass: env.EMAIL_APP_PASSWORD,
        },
      });

    return (options) =>
      sendEmailWithGmail(transporter, env.EMAIL_USER, options);
  }

  if (selectedProvider === "resend") {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      throw new Error(
        "RESEND_API_KEY and EMAIL_FROM are required for the Resend provider."
      );
    }

    const client =
      resendClient ||
      new (require("resend").Resend)(env.RESEND_API_KEY);

    return (options) =>
      sendEmailWithClient(client, env.EMAIL_FROM, options);
  }

  throw new Error(
    "EMAIL_PROVIDER must be set to either 'gmail' or 'resend'."
  );
}

const selectedProvider = String(
  process.env.EMAIL_PROVIDER || "resend"
).trim().toLowerCase();
const sendUsingProvider = createEmailSender({
  provider: selectedProvider,
  env: process.env,
});

module.exports = {
  sendEmail,
  sendEmailWithClient,
  sendEmailWithGmail,
  createEmailSender,
  EmailDeliveryError,
  toEmailDeliveryError,
};
