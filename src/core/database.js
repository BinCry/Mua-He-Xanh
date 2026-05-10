const mysql = require('mysql2/promise');
const config = require('../config/env');

const pool = mysql.createPool({
    host: config.db.host || 'localhost',
    port: config.db.port,
    user: config.db.user || 'root',
    password: config.db.pass || '',
    database: config.db.name || 'binhloi_tourism',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    ssl: config.db.ssl ? { rejectUnauthorized: false } : null
});

module.exports = pool;
