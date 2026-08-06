const db = require('./database');
const { v4: uuidv4 } = require('uuid');

/**
 * Base Model - Pure PostgreSQL Implementation
 */
class Model {
    constructor(table) {
        this.table = table;
        this.primaryKey = 'id';
        this.db = db;
    }

    /** Find all records */
    async findAll(orderBy = 'created_at DESC', limit = 100) {
        const [rows] = await this.db.query(`SELECT * FROM ${this.table} ORDER BY ${orderBy} LIMIT $1`, [limit]);
        return rows;
    }

    /** Find by ID */
    async findById(id) {
        const [rows] = await this.db.query(`SELECT * FROM ${this.table} WHERE ${this.primaryKey} = $1 LIMIT 1`, [id]);
        return rows[0] || null;
    }

    /** Find one record by conditions */
    async findOne(conditions) {
        const where = [];
        const params = [];
        let index = 1;
        for (const [col, val] of Object.entries(conditions)) {
            where.push(`${col} = $${index++}`);
            params.push(val);
        }
        const whereStr = where.length > 0 ? where.join(' AND ') : '1=1';
        const [rows] = await this.db.query(`SELECT * FROM ${this.table} WHERE ${whereStr} LIMIT 1`, params);
        return rows[0] || null;
    }

    /** Find many records by conditions */
    async findWhere(conditions, orderBy = 'created_at DESC') {
        const where = [];
        const params = [];
        let index = 1;
        for (const [col, val] of Object.entries(conditions)) {
            where.push(`${col} = $${index++}`);
            params.push(val);
        }
        const whereStr = where.length > 0 ? where.join(' AND ') : '1=1';
        const [rows] = await this.db.query(`SELECT * FROM ${this.table} WHERE ${whereStr} ORDER BY ${orderBy}`, params);
        return rows;
    }

    /** Create new record */
    async create(data) {
        if (!data[this.primaryKey]) {
            data[this.primaryKey] = uuidv4();
        }

        const cols = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
        const params = Object.values(data);

        await this.db.query(`INSERT INTO ${this.table} (${cols}) VALUES (${placeholders})`, params);
        return data[this.primaryKey];
    }

    /** Update record by ID */
    async update(id, data) {
        const sets = [];
        const params = [];
        let index = 1;
        for (const [col, val] of Object.entries(data)) {
            sets.push(`${col} = $${index++}`);
            params.push(val);
        }
        params.push(id);
        const setStr = sets.join(', ');
        const [result] = await this.db.query(`UPDATE ${this.table} SET ${setStr} WHERE ${this.primaryKey} = $${index}`, params);
        return (result.affectedRows || result.rowCount || 0) > 0;
    }

    /** Delete by ID */
    async delete(id) {
        const [result] = await this.db.query(`DELETE FROM ${this.table} WHERE ${this.primaryKey} = $1`, [id]);
        return (result.affectedRows || result.rowCount || 0) > 0;
    }

    /** Pagination */
    async paginate(page = 1, limit = 10, where = '1=1', params = [], orderBy = 'created_at DESC') {
        page = Math.max(1, page);
        limit = Math.min(50, Math.max(1, limit));
        const offset = (page - 1) * limit;

        // Convert any '?' in custom where string to PostgreSQL '$1, $2...'
        let index = 1;
        const pgWhere = where.replace(/\?/g, () => `$${index++}`);

        // Count total
        const [countRows] = await this.db.query(`SELECT COUNT(*) as total FROM ${this.table} WHERE ${pgWhere}`, params);
        const total = parseInt(countRows[0]?.total || 0, 10);

        // Get data
        const limitParamIndex = params.length + 1;
        const offsetParamIndex = params.length + 2;
        const [rows] = await this.db.query(
            `SELECT * FROM ${this.table} WHERE ${pgWhere} ORDER BY ${orderBy} LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
            [...params, limit, offset]
        );

        const totalPages = Math.ceil(total / limit);

        return {
            data: rows,
            pagination: {
                total_records: total,
                current_page: page,
                limit: limit,
                total_pages: totalPages,
                has_next: page < totalPages,
                has_prev: page > 1,
            }
        };
    }

    /** Haversine distance */
    static haversine(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}

module.exports = Model;
