const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('studio keeps template image actions separated and can remove subtitles', () => {
    const view = fs.readFileSync('src/views/reviews/video-editor.ejs', 'utf8');
    const script = fs.readFileSync('public/js/video-editor.js', 'utf8');

    assert.match(view, /d-flex flex-column gap-3[\s\S]*?btnUseTemplateSamplePhotos[\s\S]*?btnUploadOwnPhotosForTemplate/);
    assert.match(script, /onclick="removeSubtitles\(event\)"/);
    assert.match(script, /window\.removeSubtitles = function\(e\)/);
    assert.match(script, /subtitleInputs\.forEach\(input => \{ input\.value = ''; \}\)/);
    assert.match(script, /window\.selectTextTrackBadge = function\(\)/);
    assert.match(script, /d-flex align-items-center gap-2/);
    assert.match(script, /toast\.append\(icon, message\)/);
});
