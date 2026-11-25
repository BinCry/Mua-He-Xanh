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
        replaceChildren(...items) { this.children = []; this.append(...items); }
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
const summary = 'Bản tóm tắt sẽ gửi cho nhân viên:\n- Vấn đề: Đổi lịch booking';
const review = { status: 'preview', previewId: 'preview-1', summary, sendLabel: 'Gửi cho nhân viên' };
function greenButton(ui) { return ui.find(el => el.tag === 'button' && el.className.includes('btn-success')); }

test('preview uses one editable summary and sends it with the preview id', async () => {
    const calls = [];
    let switched = 0;
    const ui = browser(async (url, payload) => {
        calls.push({ url, payload });
        if (url.endsWith('/preview')) return { data: { success: true, data: review } };
        return { data: { success: true, data: { status: 'waiting_for_human', handoffId: 'handoff-1', previewId: 'preview-1', messageId: 'id-1' } } };
    });
    await ui.window.openHumanHandoff({ destinationId: 'dest-1', switchToStaff: () => switched++ });
    assert.deepEqual(JSON.parse(JSON.stringify(calls[0].payload)), {});
    const editor = ui.find(el => el.tag === 'textarea');
    assert.equal(editor.value, summary);
    assert.equal(ui.find(el => el.tag === 'img'), undefined);
    assert.equal(switched, 0);
    editor.value = 'Please help with this booking';
    await greenButton(ui).onclick();
    assert.deepEqual(JSON.parse(JSON.stringify(calls[1].payload)), {
        previewId: 'preview-1', summary: 'Please help with this booking', destinationId: 'dest-1'
    });
    assert.equal(switched, 1);
    assert.deepEqual(ui.events, ['human-handoff-sent']);
    assert.equal(greenButton(ui), undefined);
    assert.ok(ui.find(el => el.tag === 'button' && el.textContent === 'Vào chat nhân viên'));
});

test('recovered preview keeps the same editor and normal send action', async () => {
    const calls = [];
    const ui = browser(async (url, payload) => {
        calls.push({ url, payload });
        if (url.endsWith('/preview')) return { data: { success: true, data: { ...review, status: 'pending', written: false, handoffId: 'handoff-1' } } };
        return { data: { success: true, data: { status: 'waiting_for_human', handoffId: 'handoff-1', previewId: 'preview-1' } } };
    });
    await ui.window.openHumanHandoff({ handoffId: 'handoff-1' });
    assert.deepEqual(JSON.parse(JSON.stringify(calls[0].payload)), { handoffId: 'handoff-1' });
    assert.equal(ui.find(el => el.tag === 'textarea').value, summary);
    const send = greenButton(ui);
    assert.equal(send.textContent, 'Gửi cho nhân viên');
    assert.doesNotMatch(ui.find(el => el.role === 'status').textContent, /Lần gửi trước|thử lại/i);
    await send.onclick();
    assert.deepEqual(JSON.parse(JSON.stringify(calls[1].payload)), {
        previewId: 'preview-1', summary, destinationId: null
    });
});

test('a handoff whose message was already written only finishes the delivery step', async () => {
    const calls = [];
    const ui = browser(async (url, payload) => {
        calls.push({ url, payload });
        if (url.endsWith('/preview')) return { data: { success: true, data: { ...review, status: 'pending', written: true, handoffId: 'handoff-1' } } };
        return { data: { success: true, data: { status: 'sent', handoffId: 'handoff-1', previewId: 'preview-1' } } };
    });
    await ui.window.openHumanHandoff({ handoffId: 'handoff-1' });
    assert.equal(ui.find(el => el.tag === 'textarea').disabled, true);
    await greenButton(ui).onclick();
    assert.deepEqual(JSON.parse(JSON.stringify(calls[1].payload)), {
        previewId: 'preview-1', summary, destinationId: null
    });
    assert.equal(greenButton(ui), undefined);
});

test('an already sent handoff shows the sent state and lets the customer enter staff chat', async () => {
    let switched = 0;
    const ui = browser(async () => ({ data: { success: true, data: { ...review, status: 'sent', handoffId: 'handoff-1' } } }));
    await ui.window.openHumanHandoff({ handoffId: 'handoff-1', switchToStaff: () => switched++ });
    assert.equal(ui.find(el => el.role === 'status').textContent, 'Đã gửi bản tóm tắt cho nhân viên.');
    assert.equal(greenButton(ui), undefined);
    await ui.find(el => el.tag === 'button' && el.textContent === 'Vào chat nhân viên').onclick();
    assert.equal(switched, 1);
});

test('a changed review replaces the summary without sending', async () => {
    const calls = [];
    let switched = 0;
    const ui = browser(async (url, payload) => {
        calls.push({ url, payload });
        if (url.endsWith('/preview')) return { data: { success: true, data: review } };
        return { data: { success: true, data: { status: 'preview', previewId: 'preview-2', summary: 'Bản tóm tắt mới', sendLabel: 'Gửi cho nhân viên',
            message: 'Nội dung bản tóm tắt đã thay đổi. Vui lòng xem lại trước khi gửi.' } } };
    });
    await ui.window.openHumanHandoff({ switchToStaff: () => switched++ });
    await greenButton(ui).onclick();
    assert.equal(switched, 0);
    assert.equal(ui.find(el => el.tag === 'textarea').value, 'Bản tóm tắt mới');
    assert.equal(greenButton(ui).textContent, 'Gửi cho nhân viên');
    assert.equal(calls.length, 2);
});

test('duplicate preview clicks do not create duplicate requests or panels', async () => {
    let calls = 0;
    let resolve;
    const ui = browser(() => { calls++; return new Promise(done => { resolve = done; }); });
    const first = ui.window.openHumanHandoff();
    await ui.window.openHumanHandoff();
    assert.equal(calls, 1);
    resolve({ data: { success: true, data: review } });
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
    resolve({ data: { success: true, data: review } });
    await preview;
    assert.equal(switched, false);
    assert.equal(ui.find(el => el.id === 'human-handoff-preview'), undefined);
});

test('send failure keeps the reviewed summary available for retry without a success event', async () => {
    const ui = browser(async url => {
        if (url.endsWith('/send')) throw new Error('network down');
        return { data: { success: true, data: review } };
    });
    await ui.window.openHumanHandoff();
    const send = greenButton(ui);
    await send.onclick();
    assert.equal(send.disabled, false);
    assert.equal(ui.find(el => el.tag === 'textarea').disabled, false);
    assert.deepEqual(ui.events, []);
});

test('both chat surfaces open confirmation before staff delivery', () => {
    for (const name of ['chat/index.ejs', 'layouts/main.ejs']) {
        const source = fs.readFileSync(path.join(__dirname, '../src/views', name), 'utf8');
        assert.match(source, /output\.type === 'handoff'/);
        assert.match(source, /handoffId: output\.handoffId/);
        assert.match(source, /window\.openHumanHandoff/);
    }
});
