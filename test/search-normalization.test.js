const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSearchText, searchPattern, searchTokens, sqlNormalized, buildTokenSearchClause } = require('../src/utils/search');

test('text search normalizes case, whitespace and Vietnamese diacritics', () => {
    assert.equal(normalizeSearchText('  LÀNG   mai VÀNG '), 'lang mai vang');
    assert.equal(normalizeSearchText('Địa điểm'), 'dia diem');
    assert.equal(searchPattern('Làng mai vàng'), '%lang mai vang%');
});

test('search helpers split words and escape LIKE metacharacters literally', () => {
    assert.deepEqual(searchTokens('  Workshop   Lang   Mai  '), ['workshop', 'lang', 'mai']);
    assert.equal(searchPattern('100%_sale'), '%100\\%\\_sale%');
});

test('database search expression is deterministic and has no request-controlled SQL identifier', () => {
    assert.match(sqlNormalized('name'), /^translate\(lower\(coalesce\(name, ''\)\), '/);
    assert.match(sqlNormalized('d.short_desc'), /translate\(lower\(coalesce\(d\.short_desc, ''\)\), '/);
});

test('Vietnamese translation tables preserve a one-to-one character mapping', () => {
    const source = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
    assert.equal(source.length, 67);
    const expression = sqlNormalized('name');
    const values = [...expression.matchAll(/'([^']*)'/g)].map(match => match[1]);
    assert.equal(values.at(-2).length, values.at(-1).length);
});

test('tokenized search accepts incomplete, reordered and mixed-case terms across approved columns', () => {
    const result = buildTokenSearchClause(['w.title', 'w.description', 'd.name'], '  MAI   lAnG  ', 4);
    assert.match(result.clause, /w\.title/);
    assert.match(result.clause, /w\.description/);
    assert.match(result.clause, /d\.name/);
    assert.match(result.clause, /LIKE \$4 ESCAPE/);
    assert.match(result.clause, /LIKE \$5 ESCAPE/);
    assert.match(result.clause, /\) AND \(/);
    assert.deepEqual(result.params, ['%mai%', '%lang%']);
    assert.equal(result.nextIndex, 6);
});
