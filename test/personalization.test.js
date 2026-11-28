const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createPersonalizationController } = require('../src/controllers/PersonalizationController');
const { createHelpdeskAgentClient } = require('../src/services/HelpdeskAgentClient');
function response() {
    return { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
}
test('disabled feature flags reject API access case-insensitively', async () => {
    const previous = process.env.AI_PERSONALIZATION_ENABLED;
    const controller = createPersonalizationController({ client: { personalization() { throw new Error('must not call'); } } });
    try {
        for (const flag of ['false', 'FALSE', '0', 'off', 'OFF']) {
            process.env.AI_PERSONALIZATION_ENABLED = flag;
            const res = response();
            await controller.get({ user: { id: 'customer-1' } }, res);
            assert.equal(res.statusCode, 404, flag);
        }
    } finally {
        if (previous === undefined) delete process.env.AI_PERSONALIZATION_ENABLED;
        else process.env.AI_PERSONALIZATION_ENABLED = previous;
    }
});
test('personalization proxy derives identity from the login and restricts forwarded payload', async () => {
    let received;
    const controller = createPersonalizationController({ client: { async personalization(input) { received = input; return { enabled: true, items: [] }; } } });
    const res = response();
    await controller.edit({ user: { id: 'customer-1' }, params: { key: 'dietary_preferences' }, body: { value: ['vegetarian'], principalId: 'other-user' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(received.principalId, 'customer-1');
    assert.deepEqual(received.payload, { value: ['vegetarian'] });
    assert.equal(received.method, 'PATCH');
    const anonymous = response();
    await controller.get({}, anonymous);
    assert.equal(anonymous.statusCode, 401);
});
test('invalid settings and item keys are rejected before forwarding', async () => {
    const controller = createPersonalizationController({ client: { personalization() { throw new Error('must not call'); } } });
    const settings = response();
    await controller.settings({ body: { enabled: 'false' } }, settings);
    assert.equal(settings.statusCode, 400);
    const item = response();
    await controller.remove({ user: { id: 'customer-1' }, params: { key: '../private' } }, item);
    assert.equal(item.statusCode, 400);
});
test('personalization service uses authenticated fixed endpoint and strips internal errors', async () => {
    let captured;
    const env = { AI_SERVICE_CHAT_URL: 'http://127.0.0.1:8100/api/v1/chat', AI_SERVICE_AUTH_TOKEN: 'test-credential-with-more-than-32-characters' };
    const client = createHelpdeskAgentClient({ env, httpClient: { async request(options) { captured = options; return { data: { success: true, data: { enabled: true, items: [] } } }; } } });
    await client.personalization({ method: 'DELETE', key: 'food_avoidances', principalId: 'customer-1', principalRole: 'customer', requestId: 'req-1' });
    assert.equal(new URL(captured.url).pathname, '/api/v1/personalization/items/food_avoidances');
    assert.equal(captured.headers['X-Principal-ID'], 'customer-1');
    assert.equal(captured.proxy, false);
    assert.equal(captured.maxRedirects, 0);
    const broken = createPersonalizationController({ client: { async personalization() { throw new Error('secret'); } } });
    const output = response();
    await broken.get({ user: { id: 'customer-1' } }, output);
    assert.equal(output.statusCode, 503);
    assert.doesNotMatch(JSON.stringify(output.body), /secret/);
});

test('personalization UI exposes allowlisted favorite Shop products', () => {
    const script = fs.readFileSync(path.join(__dirname, '../public/js/personalization.js'), 'utf8');
    assert.match(script, /preferred_shop_products/);
    for (const value of ['melon', 'incense', 'tote_bag', 't_shirt', 'pin_badge', 'souvenir_cup', 'ornamental_plant', 'local_craft']) {
        assert.match(script, new RegExp(`\\b${value}\\b`));
    }
    assert.match(script, /Sản phẩm Shop yêu thích/);
});

test('personalization uses a memory summary and natural-language update composer', () => {
    const view = fs.readFileSync(path.join(__dirname, '../src/views/profile/personalization.ejs'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '../public/js/personalization.js'), 'utf8');
    const styles = fs.readFileSync(path.join(__dirname, '../public/css/personalization.css'), 'utf8');

    assert.match(view, /id="personalization-memory-summary"/);
    assert.match(view, /id="personalization-prompt-form"/);
    assert.match(view, /Hỏi hoặc cập nhật thông tin đang ghi nhớ/);
    assert.match(view, /id="personalization-prompt"[^>]*autocomplete="off"[^>]*disabled/);
    assert.match(view, /id="personalization-details"[^>]*hidden/);
    assert.match(script, /fetch\('\/api\/agent\/chat'/);
    assert.match(script, /body: JSON\.stringify\(\{[\s\S]*message,[\s\S]*requestId:/);
    assert.match(script, /state = await request\(\)/);
    assert.match(styles, /\.memory-composer textarea[\s\S]*font-size: 16px/);
    assert.match(styles, /@media \(max-width: 640px\)/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('structured controls remain available only through progressive disclosure', () => {
    const view = fs.readFileSync(path.join(__dirname, '../src/views/profile/personalization.ejs'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '../public/js/personalization.js'), 'utf8');

    assert.match(view, /id="personalization-show-details"/);
    assert.match(view, /id="personalization-menu-trigger"[^>]*aria-controls="personalization-details"[^>]*aria-expanded="false"/);
    assert.match(view, /id="personalization-items"/);
    assert.match(view, /id="personalization-editor"[^>]*hidden/);
    assert.match(script, /details\.hidden = false/);
    assert.match(script, /detailsDisclosure\.setAttribute\('aria-expanded', 'true'\)/);
    assert.match(script, /detailsDisclosure\.focus\(\)/);
    assert.match(script, /if \(!state \|\| !state\.enabled\)/);
    assert.match(script, /prefers-reduced-motion: reduce/);
    assert.match(script, /editorError\.textContent = copy\.choose/);
    assert.match(script, /allowed\[item\.key\]/);
});
