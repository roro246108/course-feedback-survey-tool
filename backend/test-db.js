
const pool = require('./shared/config/db');

async function testConnection() {
    try {
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);

        console.log('Database connected successfully!');
        console.log('Tables in Neon database:');

        result.rows.forEach((row) => {
            console.log('-', row.table_name);
        });

    } catch (error) {
        console.error('Database connection failed:', error.message);

    } finally {
        await pool.end();
    }
}

testConnection();
