const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function browser(post) {
    class Element {
        constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.value = ''; }
        get isConnected() { return this.tag === 'body' || Boolean(this.parent && this.parent.children.includes(this) && this.parent.isConnected); }
        append(...items) { items.forEach(item => { item.parent = this; this.children.push(item); }); }
        insertBefore(item, target) { item.parent = this; this.children.splice(this.children.indexOf(target), 0, item); }
        remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); }
        setAttribute(key, value) { this[key] = value; }
        focus() { this.focused = true; }
    }
    const body = new Element('body');
    function find(predicate, element = body) {
        if (predicate(element)) return element;
        for (const child of element.children) { const match = find(predicate, child); if (match) return match; }
    }
    const events = [];
    const window = { dispatchEvent(event) { events.push(event.type); } };
    const context = { window, document: { body, createElement: tag => new Element(tag), getElementById: id => find(el => el.id === id) }, axios: { post }, Event: class { constructor(type) { this.type = type; } } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/handoff-preview.js'), 'utf8'), context);
    return { window, find, events };
}

test('handoff previews authoritative text safely and sends only after customer confirmation', async () => {
    const calls = [];
    let switched = 0;
    const ui = browser(async (url, payload) => {
        calls.push({ url, payload });
        return { data: { success: true, data: { handoffId: 'handoff-1', summary: '<img src=x onerror=alert(1)> Verified booking' } } };
    });
    await ui.window.openHumanHandoff({ handoffId: 'handoff-1', destinationId: 'dest-1', switchToStaff: () => switched++ });
    assert.equal(calls.length, 1);
    assert.equal(switched, 1);
    assert.equal(ui.find(el => el.tag === 'div').textContent, '<img src=x onerror=alert(1)> Verified booking');
    assert.equal(ui.find(el => el.tag === 'img'), undefined);
    const note = ui.find(el => el.tag === 'textarea');
    note.value = 'Please help';
    await ui.find(el => el.tag === 'button' && el.className.includes('btn-success')).onclick();
    assert.equal(calls[1].url, '/api/agent/handoff/send');
    assert.deepEqual(JSON.parse(JSON.stringify(calls[1].payload)), { handoffId: 'handoff-1', note: 'Please help', destinationId: 'dest-1' });
    assert.deepEqual(ui.events, ['human-handoff-sent']);
    assert.equal(ui.find(el => el.tag === 'button' && el.className.includes('btn-success')), undefined);
});

test('duplicate preview clicks do not create duplicate requests or panels', async () => {
    let calls = 0;
    let resolve;
    const ui = browser(() => { calls++; return new Promise(done => { resolve = done; }); });
    const first = ui.window.openHumanHandoff();
    await ui.window.openHumanHandoff();
    assert.equal(calls, 1);
    resolve({ data: { success: true, data: { handoffId: 'h1', summary: 'Summary' } } });
    await first;
    await ui.window.openHumanHandoff();
    assert.equal(calls, 1);
});

test('preview failure exposes recovery and never sends or changes chat mode', async () => {
    let switched = false;
    const ui = browser(async () => { throw new Error('secret upstream'); });
    await ui.window.openHumanHandoff({ switchToStaff: () => { switched = true; } });
    assert.equal(switched, false);
    assert.equal(ui.find(el => el.tag === 'textarea'), undefined);
    assert.doesNotMatch(ui.find(el => el.role === 'status').textContent, /secret upstream/);
    assert.ok(ui.find(el => el.tag === 'button'));
});

test('closing a pending preview prevents a late response from changing chat mode', async () => {
    let resolve;
    let switched = false;
    const ui = browser(() => new Promise(done => { resolve = done; }));
    const preview = ui.window.openHumanHandoff({ switchToStaff: () => { switched = true; } });
    ui.find(el => el.tag === 'button').onclick();
    resolve({ data: { success: true, data: { handoffId: 'h1', summary: 'Summary' } } });
    await preview;
    assert.equal(switched, false);
    assert.equal(ui.find(el => el.id === 'human-handoff-preview'), undefined);
});

test('send failure keeps preview available for retry without success event', async () => {
    const ui = browser(async url => {
        if (url.endsWith('/send')) throw new Error('network down');
        return { data: { success: true, data: { handoffId: 'h1', summary: 'Summary' } } };
    });
    await ui.window.openHumanHandoff();
    const send = ui.find(el => el.tag === 'button' && el.className.includes('btn-success'));
    await send.onclick();
    assert.equal(send.disabled, false);
    assert.equal(ui.find(el => el.tag === 'textarea').disabled, false);
    assert.deepEqual(ui.events, []);
});

test('both chat surfaces preserve handoff receipts and open confirmation before staff delivery', () => {
    for (const name of ['chat/index.ejs', 'layouts/main.ejs']) {
        const source = fs.readFileSync(path.join(__dirname, '../src/views', name), 'utf8');
        assert.match(source, /output\.type === 'handoff'/);
        assert.match(source, /handoffId: output\.handoffId/);
        assert.match(source, /window\.openHumanHandoff/);
    }
});
