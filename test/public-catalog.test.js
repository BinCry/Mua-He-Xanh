const test = require('node:test');
const assert = require('node:assert/strict');
const databasePath = require.resolve('../src/core/database');
const calls = [];
let result = [];
let fail = false;
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true,
    exports: { query: async (sql, params) => {
        calls.push({ sql, params });
        if (fail) throw Error('private DB error');
        return [result];
    } }
};
const controller = require('../src/controllers/PublicCatalogController');
function response() {
    return { statusCode: 200, status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; } };
}

test('public catalog bounds, filtering, pagination and safe errors', async () => {
    result = [{ id: 'p1', title: 'Product', price_vnd: 0 }, { id: 'p2', title: 'Next' }];
    const products = response();
    await controller.products({ query: { q: "dua' OR 1=1", limit: '1', offset: '0' } }, products);
    assert.equal(products.body.data.hasMore, true);
    assert.equal(products.body.data.nextOffset, 1);
    assert.equal(products.body.data.items[0].price_vnd, null);
    assert.equal(products.body.data.items[0].purchase_method, 'contact');
    assert.ok(calls[0].sql.includes("w.catalog_kind = 'shop'"));
    assert.ok(!calls[0].sql.includes("dua' OR 1=1"));
    result = [];
    const sessions = response();
    await controller.workshops({ query: { from: '2026-12-01T00:00:00+07:00', limit: '5' } }, sessions);
    assert.ok(calls[1].sql.includes('ws.starts_at > NOW()'));
    assert.ok(calls[1].sql.includes('d.is_active = 1'));
    assert.ok(calls[1].sql.includes('available_seats'));
    assert.equal(sessions.body.data.hasMore, false);
    for (const query of [{ limit: '-1' }, { offset: '1.1' }, { until: 'garbage' }]) {
        const invalid = response();
        await controller.workshops({ query }, invalid);
        assert.equal(invalid.statusCode, 400);
    }
    fail = true;
    const unavailable = response();
    await controller.products({ query: {} }, unavailable);
    assert.equal(unavailable.statusCode, 503);
    assert.ok(!JSON.stringify(unavailable.body).includes('private'));
});
