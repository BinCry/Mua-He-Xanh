const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDb() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            ssl: { rejectUnauthorized: false }
        });

        console.log('--- KIỂM TRA DATABASE ---');
        const [rows] = await connection.query('SHOW TABLES');
        console.log('Danh sách các bảng:', rows.map(r => Object.values(r)[0]));
        
        if (rows.length > 0) {
            console.log('✅ Database đã có dữ liệu!');
        } else {
            console.log('❌ Database trống trơn!');
        }
        
        await connection.end();
    } catch (error) {
        console.error('❌ Lỗi kết nối:', error.message);
    }
}

checkDb();
