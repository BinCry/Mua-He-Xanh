const db = require('../core/database');
const bcrypt = require('bcryptjs');

async function reset() {
    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash('Admin@2026', salt);
    const managerPass = await bcrypt.hash('Manager@2026', salt);

    // Update Admin
    await db.query("UPDATE users SET password = ? WHERE role = 'admin'", [adminPass]);
    
    // Update Managers
    await db.query("UPDATE users SET password = ? WHERE role = 'manager'", [managerPass]);

    console.log("PASSWORDS RESET SUCCESSFULLY!");
    console.log("Admin: admin@binhloi.local / Admin@2026");
    console.log("Managers: Manager@2026 (use their specific emails)");
    process.exit();
}

reset();
