
const { Resend } = require("resend");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from backend/.env
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is missing from backend/.env");
}

if (!process.env.EMAIL_FROM) {
  throw new Error("EMAIL_FROM is missing from backend/.env");
}

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send an email using Resend.
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

  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  });

  if (result.error) {
    throw new Error(result.error.message || "Email delivery failed.");
  }

  return result.data;
}

module.exports = {
  sendEmail,
};
