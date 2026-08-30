const mysql = require('mysql2/promise');
const { Pool } = require('pg');
require('dotenv').config();
const config = require('../src/config/env');

const mysqlConfig = {
    host: config.db.host || 'localhost',
    port: config.db.port || 3306,
    user: config.db.user || 'root',
    password: config.db.pass || '',
    database: config.db.name || 'binhloi_tourism'
};

let pgPoolConfig;
if (process.env.DATABASE_URL) {
    pgPoolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    };
} else {
    pgPoolConfig = {
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT) || 5432,
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || '',
        database: process.env.PG_DATABASE || 'binhloi_healing',
        ssl: { rejectUnauthorized: false }
    };
}

const createTablesSQL = `
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255),
    password VARCHAR(255),
    full_name VARCHAR(255),
    avatar TEXT,
    role VARCHAR(20) DEFAULT 'user',
    google_id VARCHAR(100),
    facebook_id VARCHAR(100),
    managed_destination_id VARCHAR(36),
    phone VARCHAR(20),
    city VARCHAR(100),
    preferences TEXT,
    travel_style VARCHAR(100),
    total_points INT DEFAULT 0,
    role_id INT DEFAULT 3,
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS destinations (
    id VARCHAR(36) PRIMARY KEY,
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    short_desc TEXT,
    type VARCHAR(100) DEFAULT 'nature',
    moods VARCHAR(255) DEFAULT '[]',
    seasons VARCHAR(255) DEFAULT '[]',
    open_hours VARCHAR(200) DEFAULT '08:00 - 17:00',
    cost VARCHAR(300) DEFAULT 'Miễn phí',
    stay_capacity VARCHAR(50) DEFAULT 'none',
    highlight TEXT,
    checkin_tip VARCHAR(500) DEFAULT 'Hãy chụp ảnh tại điểm này!',
    best_time VARCHAR(255) DEFAULT 'Quanh năm',
    lat DECIMAL(10,7) DEFAULT 10.8250000,
    lng DECIMAL(10,7) DEFAULT 106.7200000,
    map_x INT DEFAULT 50,
    map_y INT DEFAULT 50,
    radius_meter INT DEFAULT 20000,
    cover_image TEXT,
    gallery TEXT,
    audio_url VARCHAR(500),
    video_url VARCHAR(500),
    story TEXT,
    zen_walk_desc VARCHAR(500),
    qr_code_url VARCHAR(500),
    qr_secret VARCHAR(255),
    points INT DEFAULT 20,
    is_hub INT DEFAULT 0,
    is_active INT DEFAULT 1,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(36) PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL,
    current_mood VARCHAR(50),
    total_points INT DEFAULT 0,
    ip_address VARCHAR(50),
    user_agent TEXT,
    mood VARCHAR(50),
    duration VARCHAR(20),
    interests TEXT,
    user_id VARCHAR(36),
    pax INT DEFAULT 1,
    budget VARCHAR(50) DEFAULT 'medium',
    season VARCHAR(50) DEFAULT 'now',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journeys (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    mood VARCHAR(50) NOT NULL,
    duration VARCHAR(50),
    interests TEXT,
    total_km DECIMAL(5,2) DEFAULT 0.00,
    total_minutes INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journey_stops (
    id VARCHAR(36) PRIMARY KEY,
    journey_id VARCHAR(36) NOT NULL,
    destination_id VARCHAR(36) NOT NULL,
    stop_order INT NOT NULL,
    is_completed INT DEFAULT 0,
    completed_at TIMESTAMP,
    transport VARCHAR(50) DEFAULT 'walking',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seasonal_journey_templates (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(300) NOT NULL,
    description TEXT,
    season VARCHAR(50) NOT NULL,
    interest VARCHAR(50) NOT NULL,
    stops TEXT NOT NULL,
    duration VARCHAR(100) DEFAULT 'full_day',
    valid_from DATE,
    valid_until DATE,
    km DECIMAL(5,2) DEFAULT 5.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS check_ins (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36),
    stop_id VARCHAR(36),
    destination_id VARCHAR(36) NOT NULL,
    checkin_method VARCHAR(50) DEFAULT 'manual',
    user_lat DECIMAL(10,7),
    user_lng DECIMAL(10,7),
    distance_meter INT,
    points_earned INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workshops (
    id VARCHAR(36) PRIMARY KEY,
    destination_id VARCHAR(36),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100) DEFAULT 'other',
    price INT DEFAULT 0,
    max_participants INT DEFAULT 20,
    duration_minutes INT DEFAULT 60,
    duration VARCHAR(100) DEFAULT '2 giờ',
    schedule_note VARCHAR(500),
    image TEXT,
    is_active INT DEFAULT 1,
    sort_order INT DEFAULT 0,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36),
    event VARCHAR(100) NOT NULL,
    metadata TEXT,
    page_url VARCHAR(500),
    user_agent VARCHAR(500),
    duration_ms INT DEFAULT 0,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    destination_id VARCHAR(36),
    content TEXT,
    rating INT DEFAULT 5,
    images JSON,
    video_url VARCHAR(500),
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    is_featured INT DEFAULT 0,
    location_lat DECIMAL(10,7),
    location_lng DECIMAL(10,7),
    location_name VARCHAR(300),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seasonal_experiences (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    icon_color VARCHAR(50) DEFAULT 'warning',
    season VARCHAR(50) NOT NULL,
    sort_order INT DEFAULT 0,
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS badges (
    id VARCHAR(36) PRIMARY KEY,
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(10) NOT NULL,
    mood VARCHAR(50) NOT NULL,
    points INT DEFAULT 0,
    condition TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS soundscapes (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(300) NOT NULL,
    mood VARCHAR(50) NOT NULL,
    audio_url VARCHAR(500) NOT NULL,
    duration_seconds INT DEFAULT 0,
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    season VARCHAR(50) DEFAULT 'all',
    event_date TIMESTAMP,
    end_date TIMESTAMP,
    location VARCHAR(300),
    image TEXT,
    is_featured INT DEFAULT 0,
    is_active INT DEFAULT 1,
    sort_order INT DEFAULT 0,
    is_countdown INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS festivals (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE,
    description TEXT,
    image TEXT,
    status VARCHAR(50) DEFAULT 'upcoming'
);

CREATE TABLE IF NOT EXISTS settings (
    key_name VARCHAR(100) PRIMARY KEY,
    key_value TEXT,
    category VARCHAR(50) DEFAULT 'general',
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function runMigration() {
    console.log("🚀 Bắt đầu di chuyển toàn bộ CSDL sang Supabase PostgreSQL...");

    let mysqlPool, pgPool;
    try {
        mysqlPool = mysql.createPool(mysqlConfig);
        pgPool = new Pool(pgPoolConfig);

        console.log("📦 Khởi tạo các bảng PostgreSQL trên Supabase...");
        await pgPool.query(createTablesSQL);
        console.log("✅ Cấu trúc tất cả bảng PostgreSQL đã tạo xong!");

        const tables = [
            'users', 'destinations', 'user_sessions', 'journeys',
            'journey_stops', 'seasonal_journey_templates', 'check_ins',
            'workshops', 'analytics', 'reviews', 'seasonal_experiences',
            'badges', 'soundscapes', 'events', 'festivals', 'settings'
        ];

        for (const tbl of tables) {
            try {
                const [rows] = await mysqlPool.query(`SELECT * FROM ${tbl}`);
                if (!rows || rows.length === 0) continue;

                console.log(`🚚 Đang di chuyển ${rows.length} bản ghi của bảng '${tbl}'...`);
                
                const chunkSize = 200;
                for (let i = 0; i < rows.length; i += chunkSize) {
                    const chunk = rows.slice(i, i + chunkSize);
                    for (const row of chunk) {
                        const keys = Object.keys(row);
                        const values = Object.values(row);
                        const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
                        const sql = `INSERT INTO ${tbl} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
                        await pgPool.query(sql, values);
                    }
                }
                console.log(`  ✓ Bảng '${tbl}' hoàn tất!`);
            } catch (err) {
                console.warn(`  ⚠️ Cảnh báo bảng '${tbl}':`, err.message);
            }
        }

        console.log("\n🎉 HOÀN TẤT CHUYỂN DỮ LIỆU SANG SUPABASE POSTGRESQL THÀNH CÔNG!");
        process.exit(0);
    } catch (e) {
        console.error("❌ Lỗi di chuyển dữ liệu:", e);
        process.exit(1);
    } finally {
        if (mysqlPool) await mysqlPool.end();
        if (pgPool) await pgPool.end();
    }
}

runMigration();
