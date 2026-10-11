const test = require('node:test');
const assert = require('node:assert/strict');
const sameOrigin = require('../src/middleware/sameOrigin');

function response() {
    return {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return body; }
    };
}

test('same-origin middleware permits safe methods and same-origin writes', () => {
    let called = 0;
    const next = () => { called += 1; };
    sameOrigin({ method: 'GET', get: () => '' }, response(), next);
    sameOrigin({
        method: 'POST',
        get: name => name === 'origin' ? 'https://example.test' : 'example.test'
    }, response(), next);
    assert.equal(called, 2);
});

test('same-origin middleware rejects a cross-origin browser write', () => {
    const res = response();
    sameOrigin({
        method: 'POST',
        get: name => name === 'origin' ? 'https://attacker.test' : 'example.test'
    }, res, () => assert.fail('next must not be called'));
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'CROSS_ORIGIN_WRITE_REJECTED');
});
