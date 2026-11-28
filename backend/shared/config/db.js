
const dotenv = require('dotenv');
const path = require('path');
const { createPool } = require('./pgPoolFactory');

// Load environment variables from backend/.env
dotenv.config({
    path: path.resolve(__dirname, '../../.env')
});

// Create PostgreSQL connection pool.
// Outside Lambda this is the same configuration as before; inside Lambda the
// pool is shared with database/db.js and tuned for Lambda (see pgPoolFactory).
const pool = createPool();

// Export the pool for other backend services
module.exports = pool;
