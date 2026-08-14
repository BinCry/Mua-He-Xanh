const Model = require('../core/Model');

class HeroPoster extends Model {
    constructor() {
        super('hero_posters');
    }

    /** Ensure hero_posters table exists */
    async ensureTableExists() {
        try {
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS hero_posters (
                    id VARCHAR(36) PRIMARY KEY,
                    title VARCHAR(255),
                    image_url TEXT NOT NULL,
                    sort_order INT DEFAULT 0,
                    is_active INT DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
        } catch (e) {
            console.error("HeroPoster table init warning:", e.message);
        }
    }

    /** Get active posters */
    async getActive() {
        try {
            const [rows] = await this.db.query(
                `SELECT * FROM ${this.table} WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC`
            );
            return rows;
        } catch (e) {
            console.error("HeroPoster getActive error:", e.message);
            return [];
        }
    }

    /** Get all posters for admin */
    async getAll() {
        try {
            const [rows] = await this.db.query(
                `SELECT * FROM ${this.table} ORDER BY sort_order ASC, created_at DESC`
            );
            return rows;
        } catch (e) {
            console.error("HeroPoster getAll error:", e.message);
            return [];
        }
    }
}

const heroPosterInstance = new HeroPoster();

// Run table creation once at module load
const _initPromise = (async () => {
    try { await heroPosterInstance.ensureTableExists(); } catch(e) { console.error('HeroPoster init:', e); }
})();

module.exports = heroPosterInstance;
