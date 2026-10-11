const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { CommerceIntegrityService } = require('./CommerceIntegrityService');

class ProductOrderService {
    static async create({ userId, productId, quantity, idempotencyKey }) {
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
            const error = new Error('INVALID_QUANTITY');
            error.code = 'INVALID_QUANTITY';
            throw error;
        }
        return db.transaction(async tx => {
            const idempotency = await CommerceIntegrityService.begin(
                tx, userId, 'product-order.create', idempotencyKey, { productId, quantity }
            );
            if (idempotency.replay) return { replay: true, ...idempotency.body };
            const [products] = await tx.query(
                'SELECT id, title, price_vnd, stock_on_hand, reserved_stock FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
                [productId]
            );
            const product = products[0];
            if (!product) {
                const error = new Error('PRODUCT_UNAVAILABLE');
                error.code = 'PRODUCT_UNAVAILABLE';
                throw error;
            }
            if (Number(product.stock_on_hand) - Number(product.reserved_stock) < quantity) {
                const error = new Error('INSUFFICIENT_STOCK');
                error.code = 'INSUFFICIENT_STOCK';
                throw error;
            }
            const order = {
                id: uuidv4(),
                userId,
                productId: product.id,
                quantity,
                title: product.title,
                price: Number(product.price_vnd)
            };
            await tx.query('UPDATE products SET reserved_stock = reserved_stock + $1, updated_at = NOW() WHERE id = $2', [quantity, product.id]);
            await tx.query(
                'INSERT INTO product_orders (id, user_id, product_id, quantity, product_title_snapshot, unit_price_vnd, status, idempotency_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [order.id, userId, product.id, quantity, order.title, order.price, 'pending', idempotencyKey]
            );
            const body = { success: true, order: { id: order.id, status: 'pending', totalVnd: order.price * quantity } };
            await CommerceIntegrityService.commit(tx, userId, 'product-order.create', idempotencyKey, 201, body);
            return { replay: false, ...body };
        });
    }
}

module.exports = ProductOrderService;
