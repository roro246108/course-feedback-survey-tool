
const argon2 = require("argon2");
const pool = require("../../database/db");

const authModel = require("../models/authModel");
const sessionModel = require("../models/sessionModel");

const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  generateSessionId,
  generateFamilyId,
  getRefreshTokenExpiry,
} = require("./tokenService");

// Record authentication events for security auditing
async function recordAuthEvent({
  userId = null,
  email = null,
  eventType,
  success,
  ipAddress = null,
  userAgent = null,
}) {
  await pool.query(
    `
      INSERT INTO auth_audit_logs (
        user_id,
        email,
        event_type,
        success,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6);
    `,
    [
      userId,
      email,
      eventType,
      success,
      ipAddress,
      userAgent,
    ]
  );
}

// Login using email and password
async function login({
  email,
  password,
  ipAddress,
  userAgent,
}) {
  // Validate login input
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    throw new Error("Invalid email or password.");
  }

  // Normalize email
  const normalizedEmail = email.trim().toLowerCase();

  // Find user by email
  const user = await authModel.findUserByEmail(
    normalizedEmail
  );

  // Avoid revealing whether an email exists
  if (!user) {
    await recordAuthEvent({
      email: normalizedEmail,
      eventType: "LOGIN",
      success: false,
      ipAddress,
      userAgent,
    });

    throw new Error("Invalid email or password.");
  }

  // Verify password using Argon2
  let passwordIsValid = false;

  try {
    passwordIsValid = await argon2.verify(
      user.password_hash,
      password
    );
  } catch {
    passwordIsValid = false;
  }

  if (!passwordIsValid) {
    await recordAuthEvent({
      userId: user.user_id,
      email: normalizedEmail,
      eventType: "LOGIN",
      success: false,
      ipAddress,
      userAgent,
    });

    throw new Error("Invalid email or password.");
  }

  // Check email verification
  if (!user.email_verified) {
    await recordAuthEvent({
      userId: user.user_id,
      email: normalizedEmail,
      eventType: "LOGIN",
      success: false,
      ipAddress,
      userAgent,
    });

    throw new Error(
      "Please verify your email before logging in."
    );
  }

  // Check account status
  if (user.account_status !== "Active") {
    await recordAuthEvent({
      userId: user.user_id,
      email: normalizedEmail,
      eventType: "LOGIN",
      success: false,
      ipAddress,
      userAgent,
    });

    throw new Error(
      user.account_status === "Inactive"
        ? "Your account has been deactivated. Contact an administrator."
        : "Your account is not active."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the user record and recheck account status
    const currentUser =
      await authModel.findUserByIdForUpdate(
        user.user_id,
        client
      );

    if (!currentUser) {
      throw new Error("Your account is not active.");
    }

    if (currentUser.account_status === "Inactive") {
      throw new Error(
        "Your account has been deactivated. Contact an administrator."
      );
    }

    if (
      currentUser.account_status !== "Active" ||
      !currentUser.email_verified
    ) {
      throw new Error("Your account is not active.");
    }

    // Generate session identifiers
    const sessionId = generateSessionId();
    const familyId = generateFamilyId();

    // Generate refresh token
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);

    // Create login session
    await sessionModel.createSession(
      {
        sessionId,
        userId: currentUser.user_id,
        familyId,
        refreshTokenHash,
        expiresAt: getRefreshTokenExpiry(),
        ipAddress,
        userAgent,
      },
      client
    );

    // Generate access token before committing
    const accessToken = generateAccessToken(
      currentUser,
      sessionId
    );

    // Record successful login
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
        VALUES ($1, $2, 'LOGIN', TRUE, $3, $4);
      `,
      [
        currentUser.user_id,
        currentUser.email,
        ipAddress || null,
        userAgent || null,
      ]
    );

    // Commit transaction
    await client.query("COMMIT");

    // Return authenticated user data and tokens
    return {
      user: {
        userId: currentUser.user_id,
        fullName: currentUser.full_name,
        email: currentUser.email,
        role: currentUser.role,
      },
      accessToken,
      refreshToken,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Login transaction rollback failed.");
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  login,
};
