const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('studio keeps safe edge spacing and explicit icon/text gaps', () => {
    const view = fs.readFileSync('src/views/reviews/video-editor.ejs', 'utf8');
    const script = fs.readFileSync('public/js/video-editor.js', 'utf8');

    assert.match(view, /\.bl-monitor-controls \{[\s\S]*?width: min\(100%, 480px\)[\s\S]*?margin-inline: auto[\s\S]*?padding-inline: 14px !important/);
    assert.match(view, /\.bl-monitor-controls \{[\s\S]*?width: min\(calc\(100% - 24px\), 360px\)/);
    assert.match(view, /id="propPanelTitle"[\s\S]*?d-flex align-items-center gap-2/);
    assert.match(view, /id="propPanelTitle" style="column-gap: \.625rem !important;"/);
    assert.match(view, /class="bl-panel-heading"[\s\S]*?Thư viện Media/);
    assert.match(view, /\.bl-panel-heading h6 \{ margin-bottom: \.35rem !important; line-height: 1\.3; \}/);
    assert.match(view, /id="mediaSubBinhLoi"[\s\S]*?justify-content-between mb-3/);
    assert.match(view, /Kiểu chữ đẹp có sẵn<\/label>\s*<div class="row g-2">/);
    assert.match(view, /Kiểu chữ đẹp có sẵn<\/label>[\s\S]*?margin-bottom: \.75rem/);
    assert.match(view, /id="spane-audio"[\s\S]*?class="bl-panel-heading"[\s\S]*?id="soundscapeList"/);
    assert.match(view, /id="soundscapeList"[\s\S]*?bl-audio-card p-3[\s\S]*?gap-3/);
    assert.match(view, /bl-audio-card__controls d-flex align-items-center gap-2 flex-shrink-0/);
    assert.match(view, /\.bl-audio-card > :first-child \{ min-width: 0 !important; \}/);
    assert.match(view, /@media \(max-width: 420px\) \{[\s\S]*?\.bl-btn-add-audio \{ padding-inline: \.6rem !important; \}/);
    assert.match(view, /id="spane-effects"[\s\S]*?class="bl-panel-heading"[\s\S]*?d-flex flex-column gap-3/);
    assert.match(view, /id="spane-transitions"[\s\S]*?class="bl-panel-heading"[\s\S]*?d-flex flex-column gap-3/);
    assert.match(view, /id="spane-canvas"[\s\S]*?class="bl-panel-heading"[\s\S]*?<div class="row g-3">/);
    assert.match(view, /data-ratio="9:16"[\s\S]*?border: 2px solid #CBD5E1/);
    assert.match(view, /\.bl-ratio-card\.active div\[style\*="border: 2px solid"\] \{[\s\S]*?border-color: var\(--bl-primary\) !important/);
    assert.match(view, /<div class="col-12">\s*<label[^>]*>Font chữ<\/label>\s*<select[^>]*id="propFontFamily"/);
    assert.match(view, /<option value="Inter, sans-serif">Inter<\/option>/);
    assert.match(view, /<option value="Montserrat, sans-serif">Montserrat<\/option>/);
    assert.match(view, /id="spane-speed"[\s\S]*?class="bl-panel-heading"[\s\S]*?bg-light border mb-4" style="margin-bottom: 1\.25rem !important;"/);
    assert.match(view, /\.bl-studio-workspace \.gap-2\\\.5 \{ gap: \.75rem !important; \}/);
    assert.match(view, /\.bl-studio-workspace \.mb-3\\\.5 \{ margin-bottom: 1\.25rem !important; \}/);
    assert.match(view, /\.bl-studio-workspace \.g-2\\\.5 \{ --bs-gutter-x: \.75rem; --bs-gutter-y: \.75rem; \}/);
    assert.match(view, /id="saveStatusIndicator"[\s\S]*?gap-2/);
    assert.match(view, /\.bl-empty-track-hint \{[\s\S]*?gap: 0\.5rem/);
    assert.match(script, /bl-empty-track-hint d-flex/);
    assert.doesNotMatch(script, /bi bi-sliders text-danger me-1\.5/);
});
