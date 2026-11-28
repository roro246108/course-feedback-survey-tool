
const dotenv = require("dotenv");
const path = require("path");
const { createPool } = require("../shared/config/pgPoolFactory");

// Load environment variables from backend/.env
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// PostgreSQL connection pool.
// Outside Lambda this is the same configuration as before; inside Lambda the
// pool is shared with shared/config/db.js and tuned for Lambda.
const pool = createPool();

module.exports = pool;
