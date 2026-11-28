const pg = require('pg');

// One pool per Lambda execution environment, shared by every module that
// imports a database module (shared/config/db.js and database/db.js).
const LAMBDA_POOL_KEY = Symbol.for('course-feedback.lambdaPgPool');

const isLambdaRuntime = (env = process.env) =>
    Boolean(env.AWS_LAMBDA_FUNCTION_NAME);

const readPositiveInteger = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// Lambda settings: a container handles one request at a time, so a very
// small pool is enough. Neon closes idle connections, so idle clients are
// released quickly and TCP keep-alive is enabled.
const buildLambdaPoolConfig = (env = process.env) => ({
    connectionString: env.DATABASE_URL,
    ssl: {
        // Neon presents a publicly trusted certificate, so verification is
        // enabled in Lambda unless explicitly disabled.
        rejectUnauthorized: env.PG_SSL_REJECT_UNAUTHORIZED !== 'false'
    },
    max: readPositiveInteger(env.PG_POOL_MAX, 2),
    idleTimeoutMillis: readPositiveInteger(env.PG_IDLE_TIMEOUT_MS, 10000),
    connectionTimeoutMillis: readPositiveInteger(env.PG_CONNECTION_TIMEOUT_MS, 5000),
    statement_timeout: readPositiveInteger(env.PG_STATEMENT_TIMEOUT_MS, 10000),
    keepAlive: true,
    allowExitOnIdle: true
});

// Existing configuration used by the Express server (unchanged behaviour).
const buildDefaultPoolConfig = (env = process.env) => ({
    connectionString: env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// pg.Pool is resolved at call time (not import time) so tests that replace
// it, as before this factory existed, keep working.
const createPool = (env = process.env, PoolClass = pg.Pool) => {
    if (!isLambdaRuntime(env)) {
        return new PoolClass(buildDefaultPoolConfig(env));
    }

    if (!globalThis[LAMBDA_POOL_KEY]) {
        const pool = new PoolClass(buildLambdaPoolConfig(env));

        // An idle client can be dropped by Neon while the Lambda is frozen.
        // Without a listener, that error would crash the execution environment.
        pool.on('error', (error) => {
            console.error('[db] idle PostgreSQL client error', {
                code: error && error.code,
                message: error && error.message
            });
        });

        globalThis[LAMBDA_POOL_KEY] = pool;
    }

    return globalThis[LAMBDA_POOL_KEY];
};

module.exports = {
    LAMBDA_POOL_KEY,
    buildDefaultPoolConfig,
    buildLambdaPoolConfig,
    createPool,
    isLambdaRuntime
};
