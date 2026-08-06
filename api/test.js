const db = require('../src/core/database');

module.exports = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 as test');
        res.json({
            success: true,
            db_test: rows[0],
            env: process.env.NODE_ENV,
            db_url_prefix: (process.env.DATABASE_URL || '').substring(0, 15)
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            stack: err.stack
        });
    }
};
