const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('studio switches to a scrollable one-column workspace on mobile', () => {
    const view = fs.readFileSync('src/views/reviews/video-editor.ejs', 'utf8');
    const mobileCss = view.split('@media (max-width: 1199.98px) {')[1] || '';

    assert.match(view, /@media \(max-width: 1199\.98px\)/);
    assert.match(mobileCss, /\.bl-studio-workspace \{[\s\S]*?position: relative !important/);
    assert.match(mobileCss, /\.bl-studio-body \{[\s\S]*?flex-direction: column !important/);
    assert.match(mobileCss, /\.bl-nav-rail \{[\s\S]*?overflow-x: auto !important/);
    assert.match(mobileCss, /\.bl-timeline-toolbar \{[\s\S]*?overflow-x: auto/);
    assert.match(mobileCss, /\.bl-timeline-scroll \{[\s\S]*?overflow-y: auto/);
    assert.match(mobileCss, /\.bl-time-ruler,[\s\S]*?min-width: 560px/);
});
