const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Passport reads an account balance rather than a mutable session point snapshot', () => {
    const source = fs.readFileSync('src/controllers/PassportController.js', 'utf8');
    assert.match(source, /SELECT COALESCE\(total_points, 0\) AS total_points FROM users WHERE id = \$1/);
    assert.doesNotMatch(source, /const totalPoints = session\.total_points/);
});
