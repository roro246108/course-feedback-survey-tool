
const crypto = require("crypto");
const argon2 = require("argon2");

const pool = require("../../database/db");

const authModel = require("../models/authModel");
const passwordResetModel = require("../models/passwordResetModel");
const sessionModel = require("../models/sessionModel");

const { sendEmail } = require("../../notifications/emailService");
const { hashToken } = require("./tokenService");

const RESET_TOKEN_EXPIRY_MINUTES = 30;

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,128}$/;

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

function validatePassword(password) {
  if (
    typeof password !== "string" ||
    !PASSWORD_REGEX.test(password)
  ) {
    throw new Error(
      "Password must be 8-128 characters and include uppercase, lowercase, a number and a special character, without spaces."
    );
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

// Request a password reset email
async function requestPasswordReset(email) {
  if (typeof email !== "string" || !email.trim()) {
    throw new Error("A valid email address is required.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Always return the same response to avoid revealing
  // whether an email address has an account.
  const genericResponse = {
    message:
      "If an eligible account exists, a password reset link will be sent.",
  };

  const user = await authModel.findUserByEmail(normalizedEmail);

  if (
    !user ||
    user.account_status !== "Active" ||
    !user.email_verified
  ) {
    return genericResponse;
  }

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date(
    Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Invalidate previous unused reset links.
    await passwordResetModel.invalidateUserTokens(
      user.user_id,
      client
    );

    await passwordResetModel.createResetToken(
      {
        userId: user.user_id,
        tokenHash,
        expiresAt,
      },
      client
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  try {
    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      throw new Error("FRONTEND_URL is missing.");
    }

    const resetUrl = new URL("/reset-password", frontendUrl);
    resetUrl.searchParams.set("token", rawToken);

    await sendEmail({
      to: user.email,
      subject: "Reset your Course Feedback password",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>Password Reset</h2>

          <p>Hello ${escapeHtml(user.full_name)},</p>

          <p>
            We received a request to reset your password.
          </p>

          <p>
            <a
              href="${escapeHtml(resetUrl.toString())}"
              style="
                display: inline-block;
                padding: 12px 20px;
                background-color: #2B5748;
                color: white;
                text-decoration: none;
                border-radius: 6px;
              "
            >
              Reset Password
            </a>
          </p>

          <p>
            This link expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes
            and can only be used once.
          </p>

          <p>
            If you did not request this change, ignore this email.
          </p>
        </div>
      `,
      text: `Hello ${user.full_name}, reset your password using this link: ${resetUrl.toString()}. The link expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes.`,
    });
  } catch (error) {
    // Do not leave a usable reset link if email delivery fails.
    const cleanupClient = await pool.connect();

    try {
      await cleanupClient.query("BEGIN");

      await passwordResetModel.invalidateUserTokens(
        user.user_id,
        cleanupClient
      );

      await cleanupClient.query("COMMIT");
    } catch (cleanupError) {
      await cleanupClient.query("ROLLBACK");
      console.error("Could not invalidate reset token.");
    } finally {
      cleanupClient.release();
    }

    console.error("Password reset email delivery failed.");
  }

  return genericResponse;
}

// Reset the password using a valid one-time token
async function resetPassword({
  token,
  password,
  confirmPassword,
  ipAddress,
  userAgent,
}) {
  if (
    typeof token !== "string" ||
    token.length < 40 ||
    token.length > 200
  ) {
    throw new Error("Invalid or expired password reset link.");
  }

  validatePassword(password);

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  const passwordHash = await argon2.hash(
    password,
    ARGON2_OPTIONS
  );

  const tokenHash = hashToken(token);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const resetToken =
      await passwordResetModel.findTokenForUpdate(
        tokenHash,
        client
      );

    if (
      !resetToken ||
      resetToken.used_at ||
      new Date(resetToken.expires_at) <= new Date()
    ) {
      throw new Error("Invalid or expired password reset link.");
    }

    const user = await authModel.findUserById(
      resetToken.user_id,
      client
    );

    if (
      !user ||
      user.account_status !== "Active" ||
      !user.email_verified
    ) {
      throw new Error("This account cannot reset its password.");
    }

    const tokenUsed =
      await passwordResetModel.markTokenAsUsed(
        resetToken.reset_id,
        client
      );

    if (!tokenUsed) {
      throw new Error("Invalid or expired password reset link.");
    }

    await authModel.updatePassword(
      user.user_id,
      passwordHash,
      client
    );

    // Invalidate every other unused reset link.
    await passwordResetModel.invalidateUserTokens(
      user.user_id,
      client
    );

    // Revoke all existing login sessions.
    await sessionModel.revokeAllUserSessions(
      user.user_id,
      client
    );

    await client.query(
      `
        INSERT INTO auth_audit_logs (
          user_id,
          email,
          event_type,
          success,
          ip_address,
          user_agent
        )
        VALUES ($1, $2, 'PASSWORD_RESET', TRUE, $3, $4);
      `,
      [
        user.user_id,
        user.email,
        ipAddress || null,
        userAgent || null,
      ]
    );

    await client.query("COMMIT");

    return {
      message:
        "Password reset successfully. Please log in with your new password.",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  requestPasswordReset,
  resetPassword,
};
