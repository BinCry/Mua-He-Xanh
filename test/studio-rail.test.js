const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('studio rail buttons reserve room for multi-line labels', () => {
    const view = fs.readFileSync('src/views/reviews/video-editor.ejs', 'utf8');
    const railButtonCss = view.match(/\.bl-rail-btn \{([\s\S]*?)\n\}/)?.[1] || '';

    assert.match(railButtonCss, /min-height:\s*58px/);
    assert.match(railButtonCss, /height:\s*auto/);
    assert.match(railButtonCss, /flex:\s*0 0 auto/);
    assert.match(view, /\.bl-rail-btn span \{[\s\S]*?line-height:\s*1\.2/);
});
