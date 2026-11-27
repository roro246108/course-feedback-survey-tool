
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

// Password policy:
// 8-128 characters, uppercase, lowercase, number and special character.
function isValidPassword(password) {
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,128}$/;

  return passwordRegex.test(password);
}

// Read password without displaying it in the terminal.
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

async function bootstrapAdmin() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing.");
  }

  const password = await readHidden("Enter Admin password: ");
  const confirmation = await readHidden("Confirm Admin password: ");

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
      `SELECT user_id, email, role, account_status,
              email_verified, password_hash
       FROM users
       WHERE user_id = $1
       FOR UPDATE`,
      [1]
    );

    const admin = result.rows[0];

    if (!admin || admin.role !== "Admin") {
      throw new Error("The specified Admin account was not found.");
    }

    if (admin.account_status !== "Pending") {
      throw new Error("Admin account is not Pending.");
    }

    if (admin.email_verified) {
      throw new Error("Admin email is already verified.");
    }

    if (admin.password_hash !== "DEMO_ONLY") {
      throw new Error(
        "Admin password has already been initialized. Use changeAdminPassword.js instead."
      );
    }

    if (
      !admin.email ||
      admin.email.toLowerCase().endsWith("@example.com")
    ) {
      throw new Error("Replace the demo email with a real email first.");
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const updateResult = await client.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
         AND role = 'Admin'
         AND account_status = 'Pending'
         AND email_verified = FALSE
         AND password_hash = 'DEMO_ONLY'
       RETURNING user_id`,
      [passwordHash, admin.user_id]
    );

    if (updateResult.rowCount !== 1) {
      throw new Error("Admin password initialization failed.");
    }

    await client.query("COMMIT");

    console.log("\nAdmin password initialized successfully.");
    console.log("Account status remains Pending.");
    console.log("Email verification is still required.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

bootstrapAdmin()
  .catch((error) => {
    console.error("\nBootstrap failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
