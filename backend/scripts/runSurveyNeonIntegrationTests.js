// Runs the read-only Survey Management integration tests against the
// existing Neon PostgreSQL database configured for the backend.
// Usage: npm run test:survey:neon
//
// The tests only execute SELECT queries on read-only sessions. They never
// print connection details or personal data.

const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync(
    process.execPath,
    ['--test', path.join('tests', 'integration', 'surveyManagementNeon.integration.test.js')],
    {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
        env: { ...process.env, RUN_NEON_INTEGRATION: 'true' }
    }
);

process.exit(result.status === null ? 1 : result.status);
