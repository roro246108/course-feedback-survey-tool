
const dotenv = require("dotenv");
const path = require("path");
const argon2 = require("argon2");
const readline = require("readline");
const pool = require("../database/db");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const STUDENT_EMAIL = "fatmaismaill360@gmail.com";

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Run this script in a terminal."));
      return;
    }

    process.stdout.write(question);
    let password = "";

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", handleInput);
    }

    function handleInput(key) {
      if (key === "\u0003") {
        cleanup();
        process.stdout.write("\n");
        reject(new Error("Operation cancelled."));
        return;
      }

      if (key === "\r" || key === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(password);
        return;
      }

      if (key === "\u007f" || key === "\b") {
        password = password.slice(0, -1);
        return;
      }

      if (key >= " " && key !== "\u007f") {
        password += key;
      }
    }

    process.stdin.on("data", handleInput);
  });
}

async function createDevStudent() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error(
      "This script can only run when NODE_ENV=development."
    );
  }

  const fullName = await ask("Enter Student full name: ");

  if (fullName.length < 2 || fullName.length > 150) {
    throw new Error("Name must be between 2 and 150 characters.");
  }

  const password = await askHidden("Enter Student password: ");

  const passwordPattern =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,128}$/;

  if (!passwordPattern.test(password)) {
    throw new Error(
      "Password must be 8-128 characters and contain uppercase, lowercase, number and special character."
    );
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingUser = await client.query(
      `SELECT user_id
       FROM users
       WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
       FOR UPDATE`,
      [STUDENT_EMAIL]
    );

    if (existingUser.rows.length > 0) {
      throw new Error("An account with this email already exists.");
    }

    const result = await client.query(
      `INSERT INTO users (
         full_name,
         email,
         password_hash,
         role,
         account_status,
         email_verified,
         updated_at
       )
       VALUES ($1, $2, $3, 'Student', 'Active', TRUE,
               CURRENT_TIMESTAMP)
       RETURNING user_id, full_name, email, role,
                 account_status, email_verified`,
      [fullName, STUDENT_EMAIL, passwordHash]
    );

    await client.query("COMMIT");

    console.log("\nStudent account created successfully:");
    console.table(result.rows);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

createDevStudent()
  .catch((error) => {
    console.error("\nError:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
