
const pool = require("../../database/db");

// Create a new login session
async function createSession(
  {
    sessionId,
    userId,
    familyId,
    refreshTokenHash,
    expiresAt,
    ipAddress,
    userAgent,
  },
  db = pool
) {
  const query = `
    INSERT INTO user_sessions (
      session_id,
      user_id,
      family_id,
      refresh_token_hash,
      expires_at,
      ip_address,
      user_agent
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      session_id,
      user_id,
      family_id,
      expires_at,
      created_at;
  `;

  const result = await db.query(query, [
    sessionId,
    userId,
    familyId,
    refreshTokenHash,
    expiresAt,
    ipAddress || null,
    userAgent || null,
  ]);

  return result.rows[0];
}

// Find a session by its refresh token hash.
// The caller should pass a transaction client when using for rotation.

async function findByRefreshTokenHash(tokenHash, db = pool) {
  const query = `
    SELECT
      session_id,
      user_id,
      family_id,
      refresh_token_hash,
      expires_at,
      revoked_at,
      replaced_by_session_id
    FROM user_sessions
    WHERE refresh_token_hash = $1
    FOR UPDATE;
  `;

  const result = await db.query(query, [tokenHash]);

  return result.rows[0] || null;
}


// Update the old session after a new refresh token is issued.
async function markSessionRotated(
  oldSessionId,
  newSessionId,
  db = pool
) {
  const query = `
    UPDATE user_sessions
    SET
      revoked_at = CURRENT_TIMESTAMP,
      replaced_by_session_id = $2,
      last_used_at = CURRENT_TIMESTAMP
    WHERE session_id = $1
      AND revoked_at IS NULL
    RETURNING session_id;
  `;

  const result = await db.query(query, [
    oldSessionId,
    newSessionId,
  ]);

  return result.rowCount === 1;
}

// Update the last-used timestamp
async function updateLastUsed(sessionId, db = pool) {
  const query = `
    UPDATE user_sessions
    SET last_used_at = CURRENT_TIMESTAMP
    WHERE session_id = $1
      AND revoked_at IS NULL;
  `;

  const result = await db.query(query, [sessionId]);

  return result.rowCount === 1;
}

// Revoke one session belonging to a specific user
async function revokeSession(sessionId, userId, db = pool) {
  const query = `
    UPDATE user_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE session_id = $1
      AND user_id = $2
      AND revoked_at IS NULL
    RETURNING session_id;
  `;

  const result = await db.query(query, [
    sessionId,
    userId,
  ]);

  return result.rowCount === 1;
}

// Revoke all active sessions belonging to a user
async function revokeAllUserSessions(userId, db = pool) {
  const query = `
    UPDATE user_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
      AND revoked_at IS NULL
    RETURNING session_id;
  `;

  const result = await db.query(query, [userId]);

  return result.rowCount;
}

// Revoke every active session in a token family.
// Used when refresh token reuse is detected.
async function revokeSessionFamily(familyId, db = pool) {
  const query = `
    UPDATE user_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE family_id = $1
      AND revoked_at IS NULL
    RETURNING session_id;
  `;

  const result = await db.query(query, [familyId]);

  return result.rowCount;
}


// Find an active session by its ID and user ID
async function findActiveSession(sessionId, userId, db = pool) {
  const query = `
    SELECT
      session_id,
      user_id,
      expires_at
    FROM user_sessions
    WHERE session_id = $1
      AND user_id = $2
      AND revoked_at IS NULL
      AND expires_at > CURRENT_TIMESTAMP
    LIMIT 1;
  `;

  const result = await db.query(query, [sessionId, userId]);

  return result.rows[0] || null;
}


module.exports = {
  createSession,
  findByRefreshTokenHash,
  markSessionRotated,
  updateLastUsed,
  revokeSession,
  revokeAllUserSessions,
  revokeSessionFamily,
  findActiveSession,
};