const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('responsive browser checks stub only the VPS-hosted intro video', () => {
    const source = fs.readFileSync(path.join('test', 'e2e', 'responsive.spec.js'), 'utf8');

    assert.match(source, /const INTRO_VIDEO_PATH = '\/videos\/intro-trailer\.mp4';/);
    assert.match(source, /requestedUrl\.origin === e2eOrigin && requestedUrl\.pathname === INTRO_VIDEO_PATH/);
    assert.match(source, /await page\.route\(isProductionIntroVideo, route => route\.fulfill\(\{[\s\S]*?status: 200,[\s\S]*?contentType: 'video\/mp4'/);
});
