
const pool = require("../../database/db");

// Find a user by email, ignoring letter case and surrounding spaces.
async function findUserByEmail(email, db = pool) {
  const query = `
    SELECT
      user_id,
      full_name,
      email,
      password_hash,
      role,
      account_status,
      email_verified,
      created_at
    FROM users
    WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
    LIMIT 1;
  `;

  const result = await db.query(query, [email]);

  return result.rows[0] || null;
}

async function findUserByEmailAddresses(emails, db = pool) {
  const query = `
    SELECT user_id
    FROM users
    WHERE LOWER(TRIM(email)) = ANY($1::text[])
      OR (
        role IN ('Student', 'Instructor')
        AND LOWER(TRIM(personal_email)) = ANY($1::text[])
      )
    LIMIT 1;
  `;

  const result = await db.query(query, [emails]);

  return result.rows[0] || null;
}

// Find a user by ID.
async function findUserById(userId, db = pool) {
  const query = `
    SELECT
      user_id,
      full_name,
      email,
      role,
      account_status,
      email_verified,
      created_at
    FROM users
    WHERE user_id = $1
    LIMIT 1;
  `;

  const result = await db.query(query, [userId]);

  return result.rows[0] || null;
}

// Find and lock a user row inside a transaction.
async function findUserByIdForUpdate(userId, db) {
  const query = `
    SELECT
      user_id,
      full_name,
      email,
      role,
      account_status,
      email_verified,
      created_at
    FROM users
    WHERE user_id = $1
    LIMIT 1
    FOR UPDATE;
  `;

  const result = await db.query(query, [userId]);

  return result.rows[0] || null;
}

// Create a user after a valid invitation is accepted.
async function createUser(
  { fullName, email, personalEmail, passwordHash, role },
  db = pool
) {
  const normalizedEmail = email.trim().toLowerCase();

  const query = `
    INSERT INTO users (
      full_name,
      email,
      personal_email,
      password_hash,
      role,
      account_status,
      email_verified,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      'Pending',
      FALSE,
      CURRENT_TIMESTAMP
    )
    RETURNING
      user_id,
      full_name,
      email,
      personal_email,
      role,
      account_status,
      email_verified,
      created_at;
  `;

  const result = await db.query(query, [
    fullName.trim(),
    normalizedEmail,
    personalEmail || null,
    passwordHash,
    role,
  ]);

  return result.rows[0];
}

// Update a user's password.
async function updatePassword(userId, passwordHash, db = pool) {
  const query = `
    UPDATE users
    SET
      password_hash = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $2
    RETURNING user_id;
  `;

  const result = await db.query(query, [
    passwordHash,
    userId,
  ]);

  return result.rowCount === 1;
}

// Activate an account after successful email verification.
async function activateVerifiedUser(userId, db = pool) {
  const query = `
    UPDATE users
    SET
      account_status = 'Active',
      email_verified = TRUE,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
      AND account_status = 'Pending'
      AND password_hash <> 'DEMO_ONLY'
    RETURNING user_id;
  `;

  const result = await db.query(query, [userId]);

  return result.rowCount === 1;
}

module.exports = {
  findUserByEmail,
  findUserByEmailAddresses,
  findUserById,
  findUserByIdForUpdate,
  createUser,
  updatePassword,
  activateVerifiedUser,
};
