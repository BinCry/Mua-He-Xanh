const mysql = require('mysql2/promise');
const config = require('../src/config/env');

(async () => {
    try {
        const db = await mysql.createConnection({
            host: config.db.host,
            user: config.db.user,
            password: config.db.pass,
            database: config.db.name,
            port: config.db.port,
            ssl: config.db.ssl ? { rejectUnauthorized: false } : null
        });

        console.log("Connected to Aiven. Starting Database Rebuild...");

        // 1. Add is_ai to messages
        try {
            await db.query("ALTER TABLE messages ADD COLUMN is_ai TINYINT DEFAULT 0");
            console.log("Added is_ai to messages");
        } catch (e) { console.log("is_ai already exists or error in messages"); }

        // 2. Add user_id to check_ins
        try {
            await db.query("ALTER TABLE check_ins ADD COLUMN user_id VARCHAR(36) NULL AFTER session_id");
            console.log("Added user_id to check_ins");
        } catch (e) { console.log("user_id already exists in check_ins"); }

        // 3. Add user_id to user_badges
        try {
            await db.query("ALTER TABLE user_badges ADD COLUMN user_id VARCHAR(36) NULL AFTER session_id");
            console.log("Added user_id to user_badges");
        } catch (e) { console.log("user_id already exists in user_badges"); }

        // 4. Create products table for OCOP Market
        await db.query(`
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10,2),
                description TEXT,
                image VARCHAR(255),
                category VARCHAR(100),
                rating DECIMAL(2,1) DEFAULT 4.5,
                sold INT DEFAULT 0,
                is_active TINYINT DEFAULT 1
            )
        `);
        console.log("Table 'products' ensured.");

        // 5. Create festivals table
        await db.query(`
            CREATE TABLE IF NOT EXISTS festivals (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                date DATE,
                description TEXT,
                image VARCHAR(255),
                status VARCHAR(50) DEFAULT 'upcoming'
            )
        `);
        console.log("Table 'festivals' ensured.");

        console.log("Database Rebuild Complete!");
        process.exit(0);
    } catch (err) {
        console.error("Migration error:", err);
        process.exit(1);
    }
})();
