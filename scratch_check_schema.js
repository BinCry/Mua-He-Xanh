const db = require('./src/core/database');
async function check() {
    try {
        const [rows] = await db.query("DESCRIBE destinations");
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
