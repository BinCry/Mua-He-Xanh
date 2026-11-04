const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('mobile hamburger bars are centered and do not inherit legacy margins', () => {
    const navbar = fs.readFileSync('src/views/partials/navbar.ejs', 'utf8');
    const selector = '.navbar-premium .navbar-toggler .nav-hamburger span';
    const start = navbar.indexOf(`${selector} {`);
    const end = navbar.indexOf('\n    }', start);
    const css = start >= 0 && end >= 0 ? navbar.slice(start, end) : '';

    assert.match(css, /left:\s*50% !important/);
    assert.match(css, /transform:\s*translateX\(-50%\)/);
    assert.match(css, /margin:\s*0 !important/);
    assert.match(css, /width:\s*22px !important/);
});

test('mobile language selector stays compact without changing desktop sizing', () => {
    const stylesheet = fs.readFileSync('public/css/style-v5.css', 'utf8');
    const mobileBreakpoint = /@media \(max-width: 991\.98px\) \{([\s\S]*?)\n\}/.exec(stylesheet);
    const mobileRule = mobileBreakpoint && /\.navbar-premium \.lang-switch-group button \{([\s\S]*?)\n\s*\}/.exec(mobileBreakpoint[1]);

    assert.ok(mobileRule, 'mobile language selector rule must exist');
    assert.match(mobileRule[1], /width:\s*36px !important/);
    assert.match(mobileRule[1], /height:\s*36px !important/);
    assert.match(mobileRule[1], /min-width:\s*36px !important/);
    assert.match(mobileRule[1], /min-height:\s*36px !important/);
});
