
const pool = require("../../database/db");

const sessionModel = require("../models/sessionModel");
const authModel = require("../models/authModel");

const { hashToken } = require("./tokenService");

// Record logout-related security events.
async function recordLogoutEvent({
  userId,
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

// Revoke the current login session.
async function logout(
  refreshToken,
  { ipAddress, userAgent } = {}
) {
  if (
    typeof refreshToken !== "string" ||
    refreshToken.length < 40 ||
    refreshToken.length > 200
  ) {
    return;
  }

  const tokenHash = hashToken(refreshToken);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find and lock the session associated with the token.
    const session =
      await sessionModel.findByRefreshTokenHash(
        tokenHash,
        client
      );

    if (session) {
      // Load the associated user for audit information.
      const user = await authModel.findUserById(
        session.user_id,
        client
      );

      if (session.revoked_at) {
        // A previously revoked token was reused.
        // Revoke all active sessions in the same family.
        await sessionModel.revokeSessionFamily(
          session.family_id,
          client
        );

        await recordLogoutEvent({
          userId: session.user_id,
          email: user?.email || null,
          eventType: "LOGOUT_TOKEN_REUSE",
          success: false,
          ipAddress,
          userAgent,
          db: client,
        });
      } else {
        // Revoke only the current session.
        await sessionModel.revokeSession(
          session.session_id,
          session.user_id,
          client
        );

        await recordLogoutEvent({
          userId: session.user_id,
          email: user?.email || null,
          eventType: "LOGOUT",
          success: true,
          ipAddress,
          userAgent,
          db: client,
        });
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Logout transaction rollback failed.");
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  logout,
};
