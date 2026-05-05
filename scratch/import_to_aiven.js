const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function importSql() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false },
        multipleStatements: true
    });

    console.log('Đang kết nối tới Aiven...');
    
    try {
        const sql = fs.readFileSync('database_backup.sql', 'utf8');
        console.log('Đang thực thi lệnh SQL...');
        await connection.query(sql);
        console.log('✅ Đã nhập dữ liệu thành công lên Aiven!');
    } catch (error) {
        console.error('❌ Lỗi khi nhập dữ liệu:', error.message);
    } finally {
        await connection.end();
    }
}

importSql();
