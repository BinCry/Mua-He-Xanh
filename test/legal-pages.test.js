const assert = require('node:assert/strict');
const ejs = require('ejs');
const fs = require('node:fs');
const test = require('node:test');

test('legal pages have stable routes and login links', () => {
    const routes = fs.readFileSync('src/routes/index.js', 'utf8');
    const login = fs.readFileSync('src/views/auth/login.ejs', 'utf8');
    const footer = fs.readFileSync('src/views/partials/footer.ejs', 'utf8');

    assert.match(routes, /\/dieu-khoan-dich-vu/);
    assert.match(routes, /\/chinh-sach-bao-mat/);
    assert.match(login, /href="\/dieu-khoan-dich-vu"/);
    assert.match(login, /href="\/chinh-sach-bao-mat"/);
    assert.match(footer, /href="\/dieu-khoan-dich-vu"/);
    assert.match(footer, /href="\/chinh-sach-bao-mat"/);
    const legal = fs.readFileSync('src/views/home/privacy.ejs', 'utf8');
    assert.match(legal, /href="mailto:binhloi\.travel@gmail\.com"/);
    assert.match(legal, /mail\.google\.com\/mail\/\?view=cm/);
});

test('legal page uses an in-site back fallback instead of a dead link', () => {
    const legal = fs.readFileSync('src/views/home/privacy.ejs', 'utf8');
    assert.match(legal, /id="legalBackButton"/);
    assert.match(legal, /window\.history\.back\(\)/);
    assert.match(legal, /window\.location\.assign\('\/'\)/);
});

test('all legal page variants compile with their expected content', () => {
    const template = fs.readFileSync('src/views/home/privacy.ejs', 'utf8');
    for (const page of ['terms', 'privacy', 'deletion']) {
        const html = ejs.render(template, { page });
        assert.match(html, /legalBackButton/);
        assert.match(html, /Về trang chủ/);
        assert.doesNotMatch(html, /DU LỊCH BÌNH LỢI/);
    }
});
