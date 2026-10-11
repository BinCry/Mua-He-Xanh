const test = require('node:test');
const assert = require('node:assert/strict');
const sanitizeServerErrors = require('../src/middleware/sanitizeServerErrors');

function makeResponse() {
    return {
        statusCode: 200,
        typeValue: null,
        status(code) { this.statusCode = code; return this; },
        type(value) { this.typeValue = value; return this; },
        json(payload) { this.jsonBody = payload; return payload; },
        send(payload) { this.sendBody = payload; return payload; }
    };
}

test('5xx JSON response removes accidental internal error messages', () => {
    const res = makeResponse();
    sanitizeServerErrors({}, res, () => {});
    res.status(500).json({ success: false, message: 'password=secret database timeout', trace: 'internal' });
    assert.equal(res.jsonBody.success, false);
    assert.equal(res.jsonBody.message, 'Lỗi hệ thống. Vui lòng thử lại sau.');
    assert.equal(res.jsonBody.trace, undefined);
    assert.doesNotMatch(res.jsonBody.message, /secret|database/i);
});

test('5xx text response removes accidental internal details', () => {
    const res = makeResponse();
    sanitizeServerErrors({}, res, () => {});
    res.status(500).send('Error: SELECT internal_secret FROM users');
    assert.equal(res.sendBody, 'Lỗi hệ thống. Vui lòng thử lại sau.');
    assert.match(res.typeValue, /text\/plain/);
});

test('4xx domain error remains visible to the user', () => {
    const res = makeResponse();
    sanitizeServerErrors({}, res, () => {});
    res.status(409).json({ success: false, code: 'INSUFFICIENT_STOCK', message: 'Hết hàng' });
    assert.equal(res.jsonBody.message, 'Hết hàng');
});
