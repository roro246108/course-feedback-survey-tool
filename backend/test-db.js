
const pool = require('./shared/config/db');

async function testConnection() {
    try {
        const result = await pool.query(
            'SELECT NOW() AS current_time, version() AS database_version'
        );

        console.log('Database connected successfully!');
        console.log('Current time:', result.rows[0].current_time);
        console.log('PostgreSQL:', result.rows[0].database_version);

    } catch (error) {
        console.error('Database connection failed:', error.message);

    } finally {
        await pool.end();
    }
}

testConnection();
