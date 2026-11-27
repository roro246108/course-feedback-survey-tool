
const pool = require("../../database/db");

// Create a password reset token
async function createResetToken(
  { userId, tokenHash, expiresAt },
  db = pool
) {
  const query = `
    INSERT INTO password_reset_tokens (
      user_id,
      token_hash,
      expires_at
    )
    VALUES ($1, $2, $3)
    RETURNING reset_id, expires_at;
  `;

  const result = await db.query(query, [
    userId,
    tokenHash,
    expiresAt,
  ]);

  return result.rows[0];
}

// Find a token and lock it during a transaction
async function findTokenForUpdate(tokenHash, db = pool) {
  const query = `
    SELECT
      reset_id,
      user_id,
      token_hash,
      expires_at,
      used_at
    FROM password_reset_tokens
    WHERE token_hash = $1
    FOR UPDATE;
  `;

  const result = await db.query(query, [tokenHash]);

  return result.rows[0] || null;
}

// Mark a reset token as used
async function markTokenAsUsed(resetId, db = pool) {
  const query = `
    UPDATE password_reset_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE reset_id = $1
      AND used_at IS NULL
    RETURNING reset_id;
  `;

  const result = await db.query(query, [resetId]);

  return result.rowCount === 1;
}

// Invalidate all unused reset tokens for a user
async function invalidateUserTokens(userId, db = pool) {
  const query = `
    UPDATE password_reset_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
      AND used_at IS NULL;
  `;

  const result = await db.query(query, [userId]);

  return result.rowCount;
}

module.exports = {
  createResetToken,
  findTokenForUpdate,
  markTokenAsUsed,
  invalidateUserTokens,
};
