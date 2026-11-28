const dotenv = require("dotenv");
const path = require("path");

const {
  sendTransactionalEmail,
} = require("../notifications/brevoEmailService");

const TEST_SUBJECT = "Course Feedback System - Brevo Integration Test";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function runBrevoIntegrationTest({
  args = process.argv.slice(2),
  env = process.env,
  sendEmail = sendTransactionalEmail,
} = {}) {
  if (args.length !== 1 || args[0] !== "--confirm-send") {
    return {
      attempted: false,
      message:
        "Not sent. Obtain explicit approval before running with --confirm-send.",
    };
  }

  if (env === process.env) {
    dotenv.config({
      path: path.resolve(__dirname, "../.env"),
    });
  }

  const recipient =
    typeof env.BREVO_TEST_RECIPIENT === "string"
      ? env.BREVO_TEST_RECIPIENT.trim()
      : "";
  if (!EMAIL_PATTERN.test(recipient)) {
    return {
      attempted: false,
      message: "Not sent. Set one valid BREVO_TEST_RECIPIENT address.",
    };
  }

  const result = await sendEmail({
    to: recipient,
    subject: TEST_SUBJECT,
    html: "<p>This is a controlled test of the Brevo email integration.</p>",
    text: "This is a controlled test of the Brevo email integration.",
  });

  return { attempted: true, result };
}

if (require.main === module) {
  runBrevoIntegrationTest()
    .then(({ attempted, message, result }) => {
      if (!attempted) {
        console.log(message);
        return;
      }

      if (!result.accepted) {
        console.error(
          `Brevo test result: ${result.status} (${result.error.code}).`
        );
        process.exitCode = 1;
        return;
      }

      console.log("Brevo accepted the controlled test email.");
      if (result.messageId) {
        console.log(`Message ID: ${result.messageId}`);
      }
    })
    .catch(() => {
      console.error("Brevo test could not be completed safely.");
      process.exitCode = 1;
    });
}

module.exports = { runBrevoIntegrationTest };
