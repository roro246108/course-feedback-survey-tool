
const crypto = require("crypto");
const pool = require("../../database/db");

const authModel = require("../models/authModel");
const emailVerificationModel = require("../models/emailVerificationModel");

const {
  generateRefreshToken,
  hashToken,
} = require("./tokenService");

const { sendEmail } = require("../../notifications/emailService");

const TOKEN_EXPIRY_MINUTES = 30;

// Escape user-provided values before placing them in HTML.
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

// Send an email verification link
async function sendVerificationEmail(userId) {
  const user = await authModel.findUserById(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.email_verified || user.account_status === "Active") {
    throw new Error("This account is already verified.");
  }

  if (user.account_status !== "Pending") {
    throw new Error("This account cannot be verified.");
  }

  const rawToken = generateRefreshToken();
  const tokenHash = hashToken(rawToken);

  const expiresAt = new Date(
    Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Invalidate previous unused verification links.
    await emailVerificationModel.invalidateUserTokens(
      userId,
      client
    );

    // Store only the token hash.
    await emailVerificationModel.createVerificationToken(
      {
        userId,
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

  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    throw new Error("FRONTEND_URL is missing from backend/.env");
  }

  const verificationUrl = new URL(
    "/verify-email",
    frontendUrl
  );

  verificationUrl.searchParams.set("token", rawToken);

  const safeName = escapeHtml(user.full_name);

  await sendEmail({
    to: user.email,
    subject: "Verify your Course Feedback account",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px;">
        <h2>Welcome to Course Feedback!</h2>

        <p>Hello ${safeName},</p>

        <p>
          Please verify your email address by clicking
          the button below.
        </p>

        <p>
          <a
            href="${escapeHtml(verificationUrl.toString())}"
            style="
              display: inline-block;
              padding: 12px 20px;
              background-color: #2B5748;
              color: white;
              text-decoration: none;
              border-radius: 6px;
            "
          >
            Verify Email
          </a>
        </p>

        <p>
          This link expires in ${TOKEN_EXPIRY_MINUTES} minutes
          and can only be used once.
        </p>

        <p>
          If you did not expect this email, you can ignore it.
        </p>
      </div>
    `,
    text: `Hello ${user.full_name}, verify your email using this link: ${verificationUrl.toString()}. The link expires in ${TOKEN_EXPIRY_MINUTES} minutes.`,
  });
}

async function resendVerificationEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await authModel.findUserByEmail(normalizedEmail);

  if (
    user &&
    user.account_status === "Pending" &&
    !user.email_verified
  ) {
    try {
      await sendVerificationEmail(user.user_id);
    } catch (error) {
      console.error("Email verification resend failed:", error);
      throw new Error("Unable to send a verification email right now.");
    }
  }

  return {
    message: "If an eligible account exists, a verification email has been sent.",
  };
}

// Verify the token and activate the account
async function verifyEmail(rawToken) {
  if (
    typeof rawToken !== "string" ||
    rawToken.length < 40 ||
    rawToken.length > 200
  ) {
    throw new Error("Invalid or expired verification link.");
  }

  const tokenHash = hashToken(rawToken);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const token =
      await emailVerificationModel.findTokenForUpdate(
        tokenHash,
        client
      );

    if (
      !token ||
      token.used_at ||
      new Date(token.expires_at) <= new Date()
    ) {
      throw new Error("Invalid or expired verification link.");
    }

    const user = await authModel.findUserById(
      token.user_id,
      client
    );

    if (!user || user.account_status !== "Pending") {
      throw new Error("This account cannot be verified.");
    }

    const tokenUsed =
      await emailVerificationModel.markTokenAsUsed(
        token.verification_id,
        client
      );

    if (!tokenUsed) {
      throw new Error("Invalid or expired verification link.");
    }

    const activated = await authModel.activateVerifiedUser(
      token.user_id,
      client
    );

    if (!activated) {
      throw new Error("Account activation failed.");
    }

    await emailVerificationModel.invalidateUserTokens(
      token.user_id,
      client
    );

    await client.query(
      `
        INSERT INTO auth_audit_logs (
          user_id,
          email,
          event_type,
          success
        )
        VALUES ($1, $2, 'EMAIL_VERIFIED', TRUE);
      `,
      [user.user_id, user.email]
    );

    await client.query("COMMIT");

    return {
      message: "Email verified successfully. Your account is now active.",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  sendVerificationEmail,
  resendVerificationEmail,
  verifyEmail,
};
