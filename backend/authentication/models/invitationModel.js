
const pool = require("../../database/db");

// Create a new invitation.
async function createInvitation(
  {
    email,
    fullName,
    role,
    tokenHash,
    invitedBy,
    expiresAt,
  },
  db = pool
) {
  const query = `
    INSERT INTO account_invitations (
      email,
      full_name,
      role,
      token_hash,
      invited_by,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      invitation_id,
      email,
      full_name,
      role,
      invited_by,
      created_at,
      expires_at;
  `;

  const result = await db.query(query, [
    email,
    fullName,
    role,
    tokenHash,
    invitedBy,
    expiresAt,
  ]);

  return result.rows[0];
}

// Find an invitation by its token hash and lock it.
// This function must be called inside a transaction
// using a transaction client.
async function findInvitationForUpdate(tokenHash, db) {
  if (!db || typeof db.query !== "function") {
    throw new Error(
      "A transaction database client is required to lock an invitation."
    );
  }

  const query = `
    SELECT
      invitation_id,
      email,
      full_name,
      role,
      token_hash,
      invited_by,
      created_at,
      expires_at,
      accepted_at,
      revoked_at
    FROM account_invitations
    WHERE token_hash = $1
    FOR UPDATE;
  `;

  const result = await db.query(query, [tokenHash]);

  return result.rows[0] || null;
}

// Mark an invitation as accepted only if it is still valid.
async function markInvitationAccepted(invitationId, db = pool) {
  const query = `
    UPDATE account_invitations
    SET accepted_at = CURRENT_TIMESTAMP
    WHERE invitation_id = $1
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > CURRENT_TIMESTAMP
    RETURNING invitation_id;
  `;

  const result = await db.query(query, [invitationId]);

  return result.rowCount === 1;
}

// Revoke an invitation if it has not already been accepted or revoked.
async function revokeInvitation(invitationId, db = pool) {
  const query = `
    UPDATE account_invitations
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE invitation_id = $1
      AND accepted_at IS NULL
      AND revoked_at IS NULL
    RETURNING invitation_id;
  `;

  const result = await db.query(query, [invitationId]);

  return result.rowCount === 1;
}

// Find an existing unexpired invitation for an email.
async function findActiveInvitationByEmail(email, db = pool) {
  const query = `
    SELECT
      invitation_id,
      email,
      full_name,
      role,
      expires_at
    FROM account_invitations
    WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > CURRENT_TIMESTAMP
    LIMIT 1;
  `;

  const result = await db.query(query, [email]);

  return result.rows[0] || null;
}

// Revoke previous invitations for the same normalized email.
async function revokeActiveInvitationsByEmail(email, db = pool) {
  const query = `
    UPDATE account_invitations
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
      AND accepted_at IS NULL
      AND revoked_at IS NULL;
  `;

  const result = await db.query(query, [email]);

  return result.rowCount;
}

module.exports = {
  createInvitation,
  findInvitationForUpdate,
  markInvitationAccepted,
  revokeInvitation,
  findActiveInvitationByEmail,
  revokeActiveInvitationsByEmail,
};
