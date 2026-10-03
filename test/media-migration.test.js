const assert = require('node:assert/strict');
const test = require('node:test');

const { migrateValue } = require('../scripts/migrate_base64_media');

const dataImage = 'data:image/webp;base64,UklGRg==';

test('media migration converts PostgreSQL native JSON image arrays', async () => {
    const input = [dataImage, '/uploads/existing.webp'];
    const output = await migrateValue(input, async () => '/uploads/media/migrated/hash.webp');

    assert.deepEqual(output, ['/uploads/media/migrated/hash.webp', '/uploads/existing.webp']);
});

test('media migration preserves JSON string storage while converting its image values', async () => {
    const input = JSON.stringify({ cover: dataImage, title: 'Bình Lợi' });
    const output = await migrateValue(input, async () => '/uploads/media/migrated/hash.webp');

    assert.equal(typeof output, 'string');
    assert.deepEqual(JSON.parse(output), { cover: '/uploads/media/migrated/hash.webp', title: 'Bình Lợi' });
});

test('media migration converts nested PostgreSQL JSON images without altering other values', async () => {
    const input = { gallery: [{ source: dataImage }], title: 'Bình Lợi', enabled: true };
    const output = await migrateValue(input, async () => '/uploads/media/migrated/hash.webp');

    assert.deepEqual(output, {
        gallery: [{ source: '/uploads/media/migrated/hash.webp' }],
        title: 'Bình Lợi',
        enabled: true
    });
});

test('media migration accepts whitespace and uppercase data URI schemes', async () => {
    const output = await migrateValue(['  DATA:IMAGE/WEBP;base64,UklGRg=='], async () => '/uploads/media/migrated/hash.webp');

    assert.deepEqual(output, ['/uploads/media/migrated/hash.webp']);
});
