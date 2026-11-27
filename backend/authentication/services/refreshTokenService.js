
const pool = require("../../database/db");

const authModel = require("../models/authModel");
const sessionModel = require("../models/sessionModel");

const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  generateSessionId,
  getRefreshTokenExpiry,
} = require("./tokenService");

// Record refresh-token security events inside the transaction.
async function recordRefreshEvent({
  userId = null,
  email = null,
  eventType,
  success,
  ipAddress = null,
  userAgent = null,
  db,
}) {
  await db.query(
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

// Rotate a refresh token and issue a new access token.
async function refreshAccessToken({
  refreshToken,
  ipAddress,
  userAgent,
}) {
  if (
    typeof refreshToken !== "string" ||
    refreshToken.length < 40 ||
    refreshToken.length > 200
  ) {
    throw new Error("Invalid or expired refresh token.");
  }

  const tokenHash = hashToken(refreshToken);
  const client = await pool.connect();

  let outcome;
  let newRefreshToken;
  let accessToken;
  let currentUser;

  try {
    await client.query("BEGIN");

    // Lock the old session to prevent concurrent token rotation.
    const oldSession =
      await sessionModel.findByRefreshTokenHash(
        tokenHash,
        client
      );

    if (!oldSession) {
      outcome = "INVALID";
    } else if (oldSession.revoked_at) {
      // A previously revoked refresh token was reused.
      // Revoke all active sessions in the same token family.
      await sessionModel.revokeSessionFamily(
        oldSession.family_id,
        client
      );

      await recordRefreshEvent({
        userId: oldSession.user_id,
        eventType: "REFRESH_TOKEN_REUSE",
        success: false,
        ipAddress,
        userAgent,
        db: client,
      });

      outcome = "REUSED";
    } else if (
      new Date(oldSession.expires_at).getTime() <= Date.now()
    ) {
      await sessionModel.revokeSession(
        oldSession.session_id,
        oldSession.user_id,
        client
      );

      await recordRefreshEvent({
        userId: oldSession.user_id,
        eventType: "REFRESH_TOKEN_EXPIRED",
        success: false,
        ipAddress,
        userAgent,
        db: client,
      });

      outcome = "EXPIRED";
    } else {
      // Lock the user row and check the latest account status.
      currentUser = await authModel.findUserByIdForUpdate(
        oldSession.user_id,
        client
      );

      if (
        !currentUser ||
        currentUser.account_status !== "Active" ||
        !currentUser.email_verified
      ) {
        await sessionModel.revokeSession(
          oldSession.session_id,
          oldSession.user_id,
          client
        );

        await recordRefreshEvent({
          userId: oldSession.user_id,
          email: currentUser?.email || null,
          eventType: "REFRESH_TOKEN_INACTIVE_ACCOUNT",
          success: false,
          ipAddress,
          userAgent,
          db: client,
        });

        outcome = "INACTIVE";
      } else {
        // Generate a new refresh token and session ID.
        newRefreshToken = generateRefreshToken();

        const newSessionId = generateSessionId();
        const newTokenHash = hashToken(newRefreshToken);

        // Create the replacement session in the same family.
        await sessionModel.createSession(
          {
            sessionId: newSessionId,
            userId: currentUser.user_id,
            familyId: oldSession.family_id,
            refreshTokenHash: newTokenHash,
            expiresAt: getRefreshTokenExpiry(),
            ipAddress,
            userAgent,
          },
          client
        );

        // Revoke the old session and link it to the new one.
        const rotated =
          await sessionModel.markSessionRotated(
            oldSession.session_id,
            newSessionId,
            client
          );

        if (!rotated) {
          throw new Error("Session rotation failed.");
        }

        // Generate the access token before committing.
        accessToken = generateAccessToken(
          currentUser,
          newSessionId
        );

        // Record successful token refresh.
        await recordRefreshEvent({
          userId: currentUser.user_id,
          email: currentUser.email,
          eventType: "TOKEN_REFRESH",
          success: true,
          ipAddress,
          userAgent,
          db: client,
        });

        outcome = "SUCCESS";
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Refresh transaction rollback failed.");
    }

    throw error;
  } finally {
    client.release();
  }

  // Return a generic error after committing security-related revocations.
  if (outcome !== "SUCCESS") {
    throw new Error("Invalid or expired refresh token.");
  }

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      userId: currentUser.user_id,
      fullName: currentUser.full_name,
      email: currentUser.email,
      role: currentUser.role,
    },
  };
}

module.exports = {
  refreshAccessToken,
};
