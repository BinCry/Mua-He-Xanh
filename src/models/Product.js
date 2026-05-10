const Model = require('../core/Model');

class Product extends Model {
    constructor() {
        super('products');
    }

    async findAllActive(category = null) {
        let query = 'SELECT * FROM products WHERE is_active = 1';
        let params = [];
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        const [rows] = await this.db.query(query, params);
        return rows;
    }

    async getCategories() {
        const [rows] = await this.db.query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL');
        return rows.map(r => r.category);
    }
}

module.exports = new Product();
