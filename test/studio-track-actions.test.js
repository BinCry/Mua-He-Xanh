const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('studio keeps template image actions separated and can remove subtitles', () => {
    const view = fs.readFileSync('src/views/reviews/video-editor.ejs', 'utf8');
    const script = fs.readFileSync('public/js/video-editor.js', 'utf8');

    assert.match(view, /d-flex flex-column gap-3[\s\S]*?btnUseTemplateSamplePhotos[\s\S]*?btnUploadOwnPhotosForTemplate/);
    assert.match(view, /<!-- Resolution & Format Settings -->\s*<div class="mb-4" style="margin-bottom: 1\.25rem !important;">/);
    assert.match(view, /Tên tệp video xuất ra<\/label>\s*<input/);
    assert.match(view, /x-small fw-bold text-muted text-uppercase mb-2 d-block">Tên tệp video xuất ra/);
    assert.match(view, /id="blExportModal"[\s\S]*?d-flex align-items-center gap-3[\s\S]*?Xuất video Bình Lợi Studio/);
    assert.match(script, /onclick="removeSubtitles\(event\)"/);
    assert.match(script, /window\.removeSubtitles = function\(e\)/);
    assert.match(script, /subtitleInputs\.forEach\(input => \{ input\.value = ''; \}\)/);
    assert.match(script, /window\.selectTextTrackBadge = function\(\)/);
    assert.match(script, /btnAddNewText\.addEventListener\('click', \(\) => \{/);
    assert.match(script, /const nextSubtitleInput = subtitleInputs\.find\(input => !input\.value\.trim\(\)\) \|\| textHookInput;/);
    assert.match(script, /nextSubtitleInput\.value = 'Phụ đề mới';/);
    assert.match(script, /nextSubtitleInput\.focus\(\);/);
    assert.match(script, /const modal = bootstrap\.Modal\.getOrCreateInstance\(modalEl\);\s*modal\.show\(\);/);
    assert.match(script, /d-flex align-items-center gap-2/);
    assert.match(script, /toast\.append\(icon, message\)/);
    assert.match(view, /\.bl-badge-text > div \{[\s\S]*?min-width: 0;[\s\S]*?flex: 1 1 auto;/);
    assert.match(view, /\.bl-badge-text > button \{[\s\S]*?display: inline-flex !important;[\s\S]*?flex: 0 0 auto;/);
});
