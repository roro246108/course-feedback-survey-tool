
const path = require("path");
const dotenv = require("dotenv");

// Load backend environment variables first.
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const pool = require("../database/db");
const emailVerificationService = require(
  "../authentication/services/emailVerificationService"
);

async function main() {
  try {
    // Confirm that the target account is the expected Admin.
    const result = await pool.query(
      `
        SELECT user_id, email, role, account_status, email_verified
        FROM users
        WHERE user_id = $1;
      `,
      [1]
    );

    const admin = result.rows[0];

    if (!admin || admin.role !== "Admin") {
      throw new Error("The expected Admin account was not found.");
    }

    if (admin.account_status !== "Pending" || admin.email_verified) {
      throw new Error(
        "The Admin account is not waiting for email verification."
      );
    }

    if (admin.email.endsWith("@example.com")) {
      throw new Error("Replace the demo email before sending verification.");
    }

    console.log("Sending verification email to the Admin account...");

    await emailVerificationService.sendVerificationEmail(admin.user_id);

    console.log("Verification email sent successfully.");
    console.log("Check the Admin email inbox.");
  } catch (error) {
    console.error("Failed to send verification email:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
