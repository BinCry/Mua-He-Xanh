const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('a liked destination keeps the outline button while showing a filled red heart', () => {
    const explore = fs.readFileSync('src/views/explore/show.ejs', 'utf8');

    assert.match(
        explore,
        /<button class="btn btn-outline-danger rounded-pill px-4 py-2\.5 fw-bold shadow-2xs d-flex align-items-center gap-2" onclick="handleLikeToggle/
    );
    assert.match(explore, /bi <%= hasLiked \? 'bi-heart-fill text-danger' : 'bi-heart' %>/);
    assert.match(explore, /if \(res\.data\.liked\) \{[\s\S]*?icon\.className = 'bi bi-heart-fill text-danger';[\s\S]*?btn\.classList\.remove\('active', 'bg-danger', 'text-white'\);/);
});

test('add-to-journey reports a non-authentication failure accurately', () => {
    const explore = fs.readFileSync('src/views/explore/show.ejs', 'utf8');

    assert.match(explore, /err\.response\?\.status === 401/);
    assert.match(explore, /else \{\s*showToast\(err\.response\?\.data\?\.message \|\| 'Không thể thêm địa điểm vào hành trình\. Vui lòng thử lại\.', 'warning'\);\s*\}/);
});
