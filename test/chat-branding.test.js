const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('tourist chat header consistently uses the Bình Lợi logo', () => {
    const view = fs.readFileSync('src/views/chat/index.ejs', 'utf8');
    const header = view.split('<!-- Messages Body -->')[0];

    assert.match(header, /alt="Logo Bình Lợi"/);
    assert.match(header, /settings\.brand_logo/);
    assert.match(header, /onerror="this\.src='\/images\/logo\.png'"/);
    assert.match(header, /tourist-chat-header p-3/);
    assert.match(header, /tourist-chat-brand-logo/);
    assert.match(header, /tourist-chat-user-avatar/);
    assert.doesNotMatch(header, /bi bi-messenger text-danger/);
    assert.match(view, /@media \(max-width: 767\.98px\) \{[\s\S]*?\.tourist-chat-header \{ padding: 0\.75rem !important; \}[\s\S]*?\.tourist-chat-brand-logo \{ width: 34px !important; height: 34px !important; \}[\s\S]*?\.tourist-chat-user-avatar \{ display: none !important; \}/);
});
