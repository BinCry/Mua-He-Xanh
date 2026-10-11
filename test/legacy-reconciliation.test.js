const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('legacy commerce reconciliation is read-only and rejects automatic product/session guessing', () => {
    const source = fs.readFileSync('scripts/reconcile_legacy_commerce.js', 'utf8');
    assert.match(source, /mode: 'read-only'/);
    assert.match(source, /REQUIRES_BUSINESS_MAPPING_APPROVAL/);
    assert.match(source, /No records were migrated/);
    assert.doesNotMatch(source, /\bINSERT\s+INTO\s+(products|workshop_sessions|product_orders)/i);
});
