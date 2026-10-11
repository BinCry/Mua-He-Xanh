const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Playwright requires an explicit environment and stores artifacts inside the audit workspace', () => {
    const source = fs.readFileSync('playwright.config.js', 'utf8');
    assert.match(source, /E2E_BASE_URL is required/);
    assert.match(source, /E2E_ALLOW_PRODUCTION/);
    assert.match(source, /'\.tmp', 'audit', 'playwright-results'/);
    assert.match(source, /name: 'firefox'/);
    assert.match(source, /name: 'webkit'/);
    assert.match(source, /channel: process\.env\.PW_CHANNEL \|\| 'chrome'/);
});
