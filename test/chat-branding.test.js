const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('tourist chat header consistently uses the Bình Lợi logo', () => {
    const view = fs.readFileSync('src/views/chat/index.ejs', 'utf8');
    const header = view.split('<!-- Messages Body -->')[0];

    assert.match(header, /alt="Logo Bình Lợi"/);
    assert.match(header, /settings\.brand_logo/);
    assert.match(header, /onerror="this\.src='\/images\/logo\.png'"/);
    assert.doesNotMatch(header, /bi bi-messenger text-danger/);
});
