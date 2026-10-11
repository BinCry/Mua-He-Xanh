#!/usr/bin/env node
/*
 * Creates only disposable identities and fixtures for authenticated browser
 * tests. It refuses every database except the explicitly named local audit DB.
 */
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { createTablesSQL } = require('./migrate_to_postgres');

const connectionString = String(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '').trim();
if (!/(?:localhost|127\.0\.0\.1).*binh_loi_audit/i.test(connectionString)) {
    throw new Error('Refusing to seed: TEST_DATABASE_URL must name local binh_loi_audit.');
}

const ids = {
    destinationOne: 'e2000000-0000-4000-8000-000000000001',
    destinationTwo: 'e2000000-0000-4000-8000-000000000002',
    tourist: 'e2000000-0000-4000-8000-000000000101',
    journeyTourist: 'e2000000-0000-4000-8000-000000000105',
    managerOne: 'e2000000-0000-4000-8000-000000000102',
    managerTwo: 'e2000000-0000-4000-8000-000000000103',
    admin: 'e2000000-0000-4000-8000-000000000104',
    product: 'e2000000-0000-4000-8000-000000000201',
    workshop: 'e2000000-0000-4000-8000-000000000301',
    workshopSession: 'e2000000-0000-4000-8000-000000000302'
};

async function main() {
    const pool = new Pool({ connectionString, ssl: false });
    const passwordHash = await bcrypt.hash('AuditE2E-only-2026', 10);
    const accountIds = [ids.tourist, ids.journeyTourist, ids.managerOne, ids.managerTwo, ids.admin];
    try {
        // Construct the complete application baseline before adding disposable
        // fixtures. The connection guard above prevents this from reaching a
        // production database.
        await pool.query(createTablesSQL);
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_destination_id VARCHAR(36);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS total_points INT NOT NULL DEFAULT 0;
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS pax INT NOT NULL DEFAULT 1;
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS budget VARCHAR(50) NOT NULL DEFAULT 'medium';
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS season VARCHAR(50) NOT NULL DEFAULT 'now';
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS image TEXT;
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS type VARCHAR(100) NOT NULL DEFAULT 'other';
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS price INT NOT NULL DEFAULT 0;
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS max_participants INT NOT NULL DEFAULT 20;
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 60;
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS duration VARCHAR(100) NOT NULL DEFAULT '2 giờ';
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS schedule_note VARCHAR(500);
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
            ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ;
            -- This is a baseline column used by every public destination
            -- query.  It belongs in the production bootstrap schema as well;
            -- the audit fixture declares it explicitly so browser tests do
            -- not hide missing-schema failures behind a partial test DB.
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS type VARCHAR(100) NOT NULL DEFAULT 'nature';
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS short_desc TEXT NOT NULL DEFAULT '';
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS story TEXT NOT NULL DEFAULT '';
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS cover_image TEXT;
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS gallery TEXT;
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS moods VARCHAR(255) NOT NULL DEFAULT '[]';
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS seasons VARCHAR(255) NOT NULL DEFAULT '[]';
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rating INT NOT NULL DEFAULT 5;
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS images TEXT;
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS comments_count INT NOT NULL DEFAULT 0;
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS location_name TEXT;
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS destination_id VARCHAR(36);
            ALTER TABLE journeys ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active';
            ALTER TABLE journeys ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
            CREATE TABLE IF NOT EXISTS soundscapes (
                id VARCHAR(36) PRIMARY KEY,
                title TEXT NOT NULL,
                is_active INT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            -- Analytics is written by global middleware on every browser
            -- request. Keep this fixture complete so a green UI suite cannot
            -- conceal a server-side missing-relation error.
            CREATE TABLE IF NOT EXISTS analytics (
                id VARCHAR(36) PRIMARY KEY,
                session_id TEXT,
                event TEXT,
                page_url TEXT,
                user_agent TEXT,
                duration_ms INT NOT NULL DEFAULT 0,
                ip_address TEXT,
                metadata TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS video_templates (
                id VARCHAR(36) PRIMARY KEY,
                title TEXT NOT NULL,
                is_published BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;
            ALTER TABLE soundscapes ADD COLUMN IF NOT EXISTS is_active INT NOT NULL DEFAULT 1;
            ALTER TABLE soundscapes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
            CREATE TABLE IF NOT EXISTS studio_projects (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                title TEXT NOT NULL,
                aspect_ratio TEXT,
                duration INT,
                thumbnail TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        // Reset only records created by this isolated fixture. This makes the
        // suite repeatable without touching any non-E2E audit evidence.
        await pool.query('DELETE FROM point_ledger WHERE user_id = ANY($1)', [accountIds]);
        await pool.query('DELETE FROM product_orders WHERE user_id = ANY($1)', [accountIds]);
        await pool.query('DELETE FROM workshop_session_bookings WHERE user_id = ANY($1)', [accountIds]);
        await pool.query('DELETE FROM idempotency_keys WHERE user_id = ANY($1)', [accountIds]);
        await pool.query('DELETE FROM user_sessions WHERE user_id = ANY($1)', [accountIds]);
        await pool.query(
            `INSERT INTO destinations (id, slug, name, type, short_desc, story, is_active, lat, lng, sort_order) VALUES
                ($1, 'dia-diem-e2e-1', 'Dia diem E2E 1', 'nature', 'Mo ta E2E 1', 'Noi dung E2E 1', 1, 10.1, 106.1, 1),
                ($2, 'dia-diem-e2e-2', 'Dia diem E2E 2', 'culture', 'Mo ta E2E 2', 'Noi dung E2E 2', 1, 10.2, 106.2, 2)
             ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name, type = EXCLUDED.type,
                short_desc = EXCLUDED.short_desc, story = EXCLUDED.story, is_active = 1, sort_order = EXCLUDED.sort_order`,
            [ids.destinationOne, ids.destinationTwo]
        );
        const users = [
            [ids.tourist, 'e2e-tourist@example.test', 'Khach kiem thu E2E', 'user', 3, null],
            [ids.journeyTourist, 'e2e-journey@example.test', 'Khach hanh trinh E2E', 'user', 3, null],
            [ids.managerOne, 'e2e-manager-one@example.test', 'Quan ly E2E 1', 'manager', 2, ids.destinationOne],
            [ids.managerTwo, 'e2e-manager-two@example.test', 'Quan ly E2E 2', 'manager', 2, ids.destinationTwo],
            [ids.admin, 'e2e-admin@example.test', 'Quan tri E2E', 'admin', 1, null]
        ];
        for (const [id, email, fullName, role, roleId, destinationId] of users) {
            await pool.query(
                `INSERT INTO users (id, email, full_name, role, role_id, is_active, total_points, password, managed_destination_id)
                 VALUES ($1, $2, $3, $4, $5, 1, 0, $6, $7)
                 ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name,
                    role = EXCLUDED.role, role_id = EXCLUDED.role_id, is_active = 1, password = EXCLUDED.password,
                    managed_destination_id = EXCLUDED.managed_destination_id`,
                [id, email, fullName, role, roleId, passwordHash, destinationId]
            );
        }
        await pool.query(
            `INSERT INTO products (id, destination_id, title, description, price_vnd, stock_on_hand, reserved_stock, is_active)
             VALUES ($1, $2, 'San pham E2E', 'Du lieu kiem thu co lap.', 50000, 50, 0, TRUE)
             ON CONFLICT (id) DO UPDATE SET destination_id = EXCLUDED.destination_id, title = EXCLUDED.title,
                description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, stock_on_hand = 50,
                reserved_stock = 0, is_active = TRUE, updated_at = NOW()`,
            [ids.product, ids.destinationOne]
        );
        await pool.query(
            `INSERT INTO workshops (id, title, destination_id, is_active, description, image)
             VALUES ($1, 'Workshop E2E', $2, 1, 'Du lieu kiem thu co lap.', NULL)
             ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, destination_id = EXCLUDED.destination_id,
                is_active = 1, description = EXCLUDED.description`,
            [ids.workshop, ids.destinationOne]
        );
        await pool.query(
            `INSERT INTO workshop_sessions (id, workshop_id, starts_at, ends_at, price_vnd, capacity, reserved_seats, is_active)
             VALUES ($1, $2, NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days 2 hours', 100000, 12, 0, TRUE)
             ON CONFLICT (id) DO UPDATE SET workshop_id = EXCLUDED.workshop_id, starts_at = EXCLUDED.starts_at,
                ends_at = EXCLUDED.ends_at, price_vnd = EXCLUDED.price_vnd, capacity = 12, reserved_seats = 0,
                is_active = TRUE, updated_at = NOW()`,
            [ids.workshopSession, ids.workshop]
        );
        console.log(JSON.stringify({ seeded: true, ids }));
    } finally {
        await pool.end();
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});

