const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

function cssBlock(view, selector) {
    return view.match(new RegExp(`${selector} \\{([\\s\\S]*?)\\n\\}`, ''))?.[1] || '';
}

test('studio panels retain padding and timeline tracks can scroll vertically', () => {
    const view = fs.readFileSync('src/views/reviews/video-editor.ejs', 'utf8');

    assert.match(cssBlock(view, '\\.bl-project-name-wrapper'), /padding:\s*6px 14px/);
    assert.match(cssBlock(view, '\\.bl-properties-panel'), /padding:\s*16px !important/);
    assert.match(cssBlock(view, '\\.bl-timeline-panel'), /height:\s*230px/);

    const timelineScrollCss = cssBlock(view, '\\.bl-timeline-scroll');
    assert.match(timelineScrollCss, /min-height:\s*0/);
    assert.match(timelineScrollCss, /overflow-y:\s*auto/);
});
