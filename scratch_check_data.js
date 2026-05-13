const db = require('./src/core/database');
async function check() {
    try {
        const [rows] = await db.query("SELECT id, name, slug, cover_image FROM destinations WHERE slug LIKE '%nhang%'");
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
