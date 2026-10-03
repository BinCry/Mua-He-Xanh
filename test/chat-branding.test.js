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

test('mobile tourist chat fits the visual viewport and keeps the composer above the keyboard', () => {
    const view = fs.readFileSync('src/views/chat/index.ejs', 'utf8');

    assert.match(view, /tourist-chat-page/);
    assert.match(view, /tourist-chat-panel/);
    assert.match(view, /--tourist-chat-visual-height/);
    assert.match(view, /visualViewport\.addEventListener\('resize', syncTouristChatViewport\)/);
    assert.match(view, /body\.tourist-chat-page-active main \{[\s\S]*?min-height: 100dvh;/);
    assert.match(view, /body\.tourist-chat-keyboard-open \.tourist-chat-page \{/);
    assert.match(view, /touristChatLargestViewportHeight - visualHeight > 120/);
    assert.match(view, /height: calc\(var\(--tourist-chat-visual-height, 100dvh\) - var\(--tourist-chat-navbar-height, 56px\) - 8px\);/);
    assert.match(view, /padding: 0 2px !important;/);
    assert.doesNotMatch(view, /tourist-chat-page-active \.footer-main \{ display: none/);
    assert.match(view, /min-height: 0 !important/);
});
