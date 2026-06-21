const Model = require('../core/Model');

class Destination extends Model {
    constructor() {
        super('destinations');
    }

    /** Get all active destinations */
    async getActive(limit = 100) {
        const [rows] = await this.db.query(
            `SELECT * FROM ${this.table} WHERE is_active = 1 ORDER BY sort_order ASC LIMIT ?`,
            [limit]
        );
        return rows;
    }

    /** Find by slug or name */
    async findBySlug(slug) {
        let dest = await this.findOne({ slug });
        if (!dest) {
            dest = await this.findOne({ name: slug });
        }
        return dest;
    }

    /** Get Hub */
    async getHub() {
        return this.findOne({ is_hub: 1, is_active: 1 });
    }

    /** Get destinations for journey */
    async getForJourney(mood, interests = [], excludeIds = []) {
        let where = "is_active = 1";
        const params = [];

        // Mood
        where += " AND moods LIKE ?";
        params.push(`%${mood}%`);

        // Interests
        if (interests.length > 0) {
            const intParts = interests.map(() => "type = ?").join(" OR ");
            where += ` AND (${intParts})`;
            params.push(...interests);
        }

        // Exclude
        if (excludeIds.length > 0) {
            const placeholders = excludeIds.map(() => "?").join(",");
            where += ` AND id NOT IN (${placeholders})`;
            params.push(...excludeIds);
        }

        const [rows] = await this.db.query(
            `SELECT * FROM ${this.table} WHERE ${where} ORDER BY sort_order ASC`,
            params
        );
        return rows;
    }

    /** Get by type */
    async getByType(type) {
        return this.findWhere({ type, is_active: 1 }, 'sort_order ASC');
    }

    /** Paginate active */
    async paginateActive(page = 1, limit = 6, type = null, mood = null, search = null, season = null) {
        let where = "is_active = 1";
        const params = [];

        if (type) {
            if (type === 'park') {
                where += " AND (type = 'park' OR type = 'nature')";
            } else {
                where += " AND type = ?";
                params.push(type);
            }
        }
        if (mood) {
            where += " AND moods LIKE ?";
            params.push(`%${mood}%`);
        }
        if (season) {
            where += " AND seasons LIKE ?";
            params.push(`%${season}%`);
        }
        if (search) {
            const searchLower = search.toLowerCase().trim();
            let typeMatch = null;
            if (searchLower.includes('tâm linh') || searchLower.includes('tam linh') || searchLower.includes('chữa lành') || searchLower.includes('chua lanh')) {
                typeMatch = 'temple';
            } else if (searchLower.includes('sinh thái') || searchLower.includes('sinh thai') || searchLower.includes('sông nước') || searchLower.includes('song nuoc')) {
                typeMatch = 'park_or_nature';
            } else if (searchLower.includes('làng nghề') || searchLower.includes('lang nghe') || searchLower.includes('bản sắc') || searchLower.includes('ban sac')) {
                typeMatch = 'craft';
            }

            if (typeMatch) {
                if (typeMatch === 'park_or_nature') {
                    where += " AND (name LIKE ? OR short_desc LIKE ? OR story LIKE ? OR type = 'park' OR type = 'nature')";
                } else {
                    where += " AND (name LIKE ? OR short_desc LIKE ? OR story LIKE ? OR type = ?)";
                    params.push(typeMatch);
                }
            } else {
                where += " AND (name LIKE ? OR short_desc LIKE ? OR story LIKE ?)";
            }
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        return this.paginate(page, limit, where, params, 'sort_order ASC');
    }

    /** Get by season */
    async getBySeason(season) {
        try {
            const [rows] = await this.db.query(
                `SELECT * FROM ${this.table} WHERE is_active = 1 AND seasons LIKE ? ORDER BY sort_order ASC`,
                [`%${season}%`]
            );
            return rows || [];
        } catch (e) {
            console.error("Error in getBySeason:", e);
            return [];
        }
    }

    /** Get related destinations */
    async getRelated(type, excludeId, limit = 3) {
        const [rows] = await this.db.query(
            `SELECT * FROM ${this.table} WHERE type = ? AND id != ? AND is_active = 1 LIMIT ?`,
            [type, excludeId, limit]
        );
        return rows;
    }

    /** Get popular destinations based on check-ins */
    async getPopular(limit = 3) {
        const [rows] = await this.db.query(
            `SELECT d.*, COUNT(c.id) as checkin_count 
             FROM ${this.table} d
             LEFT JOIN check_ins c ON d.id = c.destination_id
             WHERE d.is_active = 1
             GROUP BY d.id
             ORDER BY checkin_count DESC, d.sort_order ASC
             LIMIT ?`,
            [limit]
        );
        return rows;
    }
}

module.exports = new Destination();
