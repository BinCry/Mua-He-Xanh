const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('mobile admin and manager header starts flush with the viewport', () => {
    const layout = fs.readFileSync('src/views/layouts/admin.ejs', 'utf8');
    const mobileRules = /@media \(max-width: 991px\) \{([\s\S]*?)\n        \}/.exec(layout);

    assert.ok(mobileRules, 'admin mobile breakpoint must exist');
    assert.match(mobileRules[1], /\.admin-main \{[\s\S]*?padding:\s*0 16px 16px !important/);
    assert.match(mobileRules[1], /\.admin-mobile-topbar \{\s*margin:\s*0 -16px 20px !important/);
});
