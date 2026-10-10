const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('journey suggestions heading uses the shared Vietnamese-safe font without a shadow', () => {
    const view = fs.readFileSync('src/views/journey/suggestions.ejs', 'utf8');
    const start = view.indexOf('.sug-hero-title {');
    const end = view.indexOf('\n}', start);
    const css = start >= 0 && end >= 0 ? view.slice(start, end) : '';

    assert.match(css, /font-family:\s*var\(--font-display\)/);
    assert.match(css, /line-height:\s*1\.25/);
    assert.match(css, /text-shadow:\s*none/);
    assert.doesNotMatch(css, /font-heading/);
});
