const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('studio restores the saved ratio to the preview as well as the selected card', () => {
    const script = fs.readFileSync('public/js/video-editor.js', 'utf8');

    assert.match(script, /function applyRatioToCanvas\(ratio\)/);
    assert.match(script, /selectedRatio = normalizeStudioRatio\(s\.selectedRatio\);\s*applyRatioToCanvas\(selectedRatio\);/);
    assert.match(script, /window\.selectStudioRatio = function\(ratio\) \{[\s\S]*?selectedRatio = normalizeStudioRatio\(ratio\);\s*applyRatioToCanvas\(selectedRatio\);/);
    assert.match(script, /'16:9': \{ aspectRatio: '16 \/ 9', width: 960, height: 540, label: '16:9 Ngang' \}/);
});
