
const { Pool } = require("pg");
const argon2 = require("argon2");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

function isValidPassword(password) {
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,128}$/;

  return passwordRegex.test(password);
}

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;

    if (!stdin.isTTY) {
      reject(new Error("Run this script directly from a terminal."));
      return;
    }

    let password = "";

    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    }

    function onData(char) {
      if (char === "\u0003") {
        cleanup();
        process.stdout.write("\n");
        reject(new Error("Operation cancelled."));
        return;
      }

      if (char === "\r" || char === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(password);
        return;
      }

      if (char === "\u007f" || char === "\b") {
        password = password.slice(0, -1);
        return;
      }

      if (char >= " " && char !== "\u001b") {
        password += char;
      }
    }

    stdin.on("data", onData);
  });
}

async function changeAdminPassword() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing.");
  }

  const password = await readHidden("Enter the new Admin password: ");
  const confirmation = await readHidden("Confirm the new Admin password: ");

  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }

  if (!isValidPassword(password)) {
    throw new Error(
      "Password must be 8-128 characters and contain uppercase, lowercase, number and special character. Spaces are not allowed."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT user_id, role
       FROM users
       WHERE user_id = $1
       FOR UPDATE`,
      [1]
    );

    const admin = result.rows[0];

    if (!admin || admin.role !== "Admin") {
      throw new Error("Admin account was not found.");
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await client.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [passwordHash, admin.user_id]
    );

    // Revoke all existing sessions for this Admin.
    await client.query(
      `UPDATE user_sessions
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [admin.user_id]
    );

    // Invalidate unused password reset tokens.
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
         AND used_at IS NULL`,
      [admin.user_id]
    );

    // Record the security event.
    await client.query(
      `INSERT INTO auth_audit_logs
       (user_id, email, event_type, success)
       SELECT user_id, email, 'PASSWORD_CHANGED', TRUE
       FROM users
       WHERE user_id = $1`,
      [admin.user_id]
    );

    await client.query("COMMIT");

    console.log("\nAdmin password changed successfully.");
    console.log("Old sessions have been revoked.");
    console.log("Unused password reset tokens have been invalidated.");
    console.log("Account status and email verification were not changed.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

changeAdminPassword()
  .catch((error) => {
    console.error("\nPassword change failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
