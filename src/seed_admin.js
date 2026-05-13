/**
 * Seed Admin & Manager Accounts
 * Chạy 1 lần: node src/seed_admin.js
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    const db = require('./core/database');

    const salt = await bcrypt.genSalt(10);

    // ==================== ADMIN ====================
    const adminPassword = await bcrypt.hash('Admin@2026', salt);
    const [existingAdmin] = await db.query("SELECT id FROM users WHERE email = 'admin@binhloi.local'");
    
    if (existingAdmin.length === 0) {
        await db.query(
            `INSERT INTO users (id, full_name, email, password, role, role_id, total_points, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), 'Admin Bình Lợi', 'admin@binhloi.local', adminPassword, 'admin', 1, 0, 1]
        );
        console.log('✅ Tạo tài khoản Admin: admin@binhloi.local / Admin@2026');
    } else {
        // Update password in case it was corrupted
        await db.query("UPDATE users SET password = ?, role = 'admin', role_id = 1 WHERE email = 'admin@binhloi.local'", [adminPassword]);
        console.log('🔄 Cập nhật mật khẩu Admin: admin@binhloi.local / Admin@2026');
    }

    // ==================== MANAGERS ====================
    const [destinations] = await db.query('SELECT id, name, slug FROM destinations WHERE is_active = TRUE ORDER BY sort_order');
    
    const managerPassword = await bcrypt.hash('Manager@2026', salt);

    for (const dest of destinations) {
        const email = `manager.${dest.slug}@binhloi.local`;
        const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
        
        if (existing.length === 0) {
            const managerId = uuidv4();
            await db.query(
                `INSERT INTO users (id, full_name, email, password, role, role_id, managed_destination_id, total_points, is_active) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [managerId, `QL ${dest.name}`, email, managerPassword, 'manager', 2, dest.id, 0, 1]
            );
            console.log(`✅ Manager: ${email} → ${dest.name}`);
        } else {
            await db.query("UPDATE users SET password = ?, role = 'manager', role_id = 2, managed_destination_id = ? WHERE email = ?", 
                [managerPassword, dest.id, email]);
            console.log(`🔄 Cập nhật Manager: ${email} → ${dest.name}`);
        }
    }

    console.log('\n========================================');
    console.log('📋 DANH SÁCH TÀI KHOẢN:');
    console.log('========================================');
    console.log('🏛️  ADMIN (Cấp Xã):');
    console.log('    Email: admin@binhloi.local');
    console.log('    Mật khẩu: Admin@2026');
    console.log('');
    console.log('📍 MANAGER (Quản lý Địa điểm):');
    for (const dest of destinations) {
        console.log(`    ${dest.name}`);
        console.log(`    Email: manager.${dest.slug}@binhloi.local`);
        console.log(`    Mật khẩu: Manager@2026`);
        console.log('');
    }
    console.log('🧳 DU KHÁCH: Tự đăng ký qua /auth/login');
    console.log('========================================');

    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed error:', err);
    process.exit(1);
});
