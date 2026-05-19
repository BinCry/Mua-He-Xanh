const db = require('./src/core/database');

async function check() {
    const [rows] = await db.query("SELECT id, full_name, email, phone, role FROM users WHERE role = 'admin' LIMIT 5");
    console.log('Admin accounts found:', rows.length);
    rows.forEach(r => console.log(`  ${r.full_name} | ${r.email} | ${r.phone} | role: ${r.role}`));
    
    const [all] = await db.query("SELECT id, full_name, email, phone, role FROM users LIMIT 10");
    console.log('\nAll users:');
    all.forEach(r => console.log(`  ${r.full_name} | ${r.email} | ${r.phone} | role: ${r.role}`));
    
    process.exit(0);
}
check();
