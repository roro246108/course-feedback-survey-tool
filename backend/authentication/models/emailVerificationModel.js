
const pool = require("../../database/db");

// Create a new email verification token
async function createVerificationToken(
  { userId, tokenHash, expiresAt },
  db = pool
) {
  const query = `
    INSERT INTO email_verification_tokens (
      user_id,
      token_hash,
      expires_at
    )
    VALUES ($1, $2, $3)
    RETURNING verification_id, expires_at;
  `;

  const result = await db.query(query, [
    userId,
    tokenHash,
    expiresAt,
  ]);

  return result.rows[0];
}

// Find a verification token and lock it during a transaction
async function findTokenForUpdate(tokenHash, db = pool) {
  const query = `
    SELECT
      verification_id,
      user_id,
      token_hash,
      expires_at,
      used_at
    FROM email_verification_tokens
    WHERE token_hash = $1
    FOR UPDATE;
  `;

  const result = await db.query(query, [tokenHash]);

  return result.rows[0] || null;
}

// Mark a verification token as used
async function markTokenAsUsed(verificationId, db = pool) {
  const query = `
    UPDATE email_verification_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE verification_id = $1
      AND used_at IS NULL
    RETURNING verification_id;
  `;

  const result = await db.query(query, [verificationId]);

  return result.rowCount === 1;
}

// Invalidate all unused verification tokens for a user
async function invalidateUserTokens(userId, db = pool) {
  const query = `
    UPDATE email_verification_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
      AND used_at IS NULL;
  `;

  const result = await db.query(query, [userId]);

  return result.rowCount;
}

module.exports = {
  createVerificationToken,
  findTokenForUpdate,
  markTokenAsUsed,
  invalidateUserTokens,
};
