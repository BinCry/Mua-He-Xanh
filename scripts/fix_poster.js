require('dotenv').config();
const db = require('../src/core/database');

async function run() {
    try {
        await db.query("UPDATE hero_posters SET image_url = '/uploads/posters/poster-1.webp' WHERE sort_order = 1");
        console.log('Successfully updated hero_posters in database!');
        const [rows] = await db.query('SELECT id, title, image_url, sort_order FROM hero_posters ORDER BY sort_order ASC');
        console.log(rows);
    } catch (e) {
        console.error('Error updating DB:', e);
    } finally {
        process.exit(0);
    }
}

run();
