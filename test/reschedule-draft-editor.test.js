const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const preview = [
    'Yêu cầu: Đổi lịch workshop',
    '',
    'Lịch mong muốn: Ngày 15/12/2026 lúc 09:00',
    '',
    'Thông tin đặt workshop:',
    'Mã đặt workshop: BK-920BD5487DC9',
    'Workshop: Trải nghiệm làm nhang',
    'Lịch hiện tại: 07:00–09:00 ngày 31/12/2026, giờ Việt Nam',
    'Số chỗ: 1',
    'Trạng thái: Chờ xác nhận'
].join('\n');

function browser() {
    class Element {
        constructor(tag) {
            this.tag = tag;
            this.children = [];
            this.style = {};
            this.value = '';
            this.disabled = false;
        }
        get isConnected() {
            return this.tag === 'body' || Boolean(this.parent?.isConnected);
        }
        append(...items) {
            items.forEach(item => {
                item.parent = this;
                this.children.push(item);
            });
        }
        remove() {
            if (this.parent) this.parent.children = this.parent.children.filter(item => item !== this);
        }
        setAttribute(key, value) { this[key] = value; }
        addEventListener(type, callback) { this[`on${type}`] = callback; }
        focus() { this.focused = true; }
    }
    const body = new Element('body');
    function find(predicate, element = body) {
        if (predicate(element)) return element;
        for (const child of element.children) {
            const result = find(predicate, child);
            if (result) return result;
        }
    }
    const document = {
        body,
        createElement: tag => new Element(tag),
        getElementById: id => find(element => element.id === id)
    };
    const window = {
        document,
        crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' },
        location: { origin: 'https://example.test' }
    };
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '../public/js/agent-chat-ui.js'), 'utf8'),
        { window, URL }
    );
    return { ui: window.HelpdeskAgentUI, find, body };
}

test('reschedule popup allows editing the complete draft', async () => {
    const { ui, find } = browser();
    const saved = [];
    ui.openRescheduleDraftEditor({
        preview,
        save: async value => {
            saved.push(value);
            return { type: 'confirmation_required' };
        }
    });

    assert.equal(find(element => element.id === 'reschedule-draft-content').value, preview);
    find(element => element.id === 'reschedule-draft-content').value =
        'Ngày 16/12/2026 lúc 10:00. Ghi chú: Ưu tiên buổi sáng';
    await find(element => element.textContent === 'Lưu thay đổi').onclick();

    assert.deepEqual(saved, [
        'Ngày 16/12/2026 lúc 10:00. Ghi chú: Ưu tiên buổi sáng'
    ]);
    assert.equal(find(element => element.id === 'reschedule-draft-editor'), undefined);
});

test('cancel closes popup without changing the agent draft', () => {
    const { ui, find } = browser();
    let saved = false;
    ui.openRescheduleDraftEditor({ preview, save: async () => { saved = true; } });
    find(element => element.textContent === 'Hủy chỉnh sửa').onclick();
    assert.equal(saved, false);
    assert.equal(find(element => element.id === 'reschedule-draft-editor'), undefined);
});

test('ticket edit control opens popup then saves through the existing conversation', async () => {
    const { ui, find, body } = browser();
    const entry = {
        role: 'assistant',
        status: 'confirmation_required',
        confirmationId: 'confirmation-1',
        preview
    };
    const messages = [entry];
    const sent = [];
    const send = async (message, options = {}) => {
        sent.push({ message, options });
        return {
            type: message === 'Sửa toàn bộ nội dung'
                ? 'clarification_required'
                : 'confirmation_required'
        };
    };
    ui.appendTicketControls(body, entry, messages, false, send);

    await find(element => element.textContent === '2. Sửa nội dung').onclick();
    assert.deepEqual(sent, []);
    find(element => element.id === 'reschedule-draft-content').value =
        'Ngày 16/12/2026 lúc 10:00. Ghi chú: Ưu tiên buổi sáng';
    await find(element => element.textContent === 'Lưu thay đổi').onclick();

    assert.equal(sent.length, 2);
    assert.equal(sent[0].message, 'Sửa toàn bộ nội dung');
    assert.equal(sent[0].options.hidden, true);
    assert.equal(
        sent[1].message,
        'Ngày 16/12/2026 lúc 10:00. Ghi chú: Ưu tiên buổi sáng'
    );
    assert.equal(Object.keys(sent[1].options).length, 0);
});
