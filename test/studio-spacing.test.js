const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('studio keeps safe edge spacing and explicit icon/text gaps', () => {
    const view = fs.readFileSync('src/views/reviews/video-editor.ejs', 'utf8');
    const script = fs.readFileSync('public/js/video-editor.js', 'utf8');

    assert.match(view, /\.bl-monitor-controls \{[\s\S]*?width: min\(100%, 480px\)[\s\S]*?margin-inline: auto[\s\S]*?padding-inline: 14px !important/);
    assert.match(view, /\.bl-monitor-controls \{[\s\S]*?width: min\(calc\(100% - 24px\), 360px\)/);
    assert.match(view, /id="propPanelTitle"[\s\S]*?d-flex align-items-center gap-2/);
    assert.match(view, /id="saveStatusIndicator"[\s\S]*?gap-2/);
    assert.match(view, /\.bl-empty-track-hint \{[\s\S]*?gap: 0\.5rem/);
    assert.match(script, /bl-empty-track-hint d-flex/);
    assert.doesNotMatch(script, /bi bi-sliders text-danger me-1\.5/);
});
