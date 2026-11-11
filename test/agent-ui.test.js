const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function agentUi() {
    const window = {
        location: { origin: 'https://www.dulichbinhloi.com' }
    };
    const source = fs.readFileSync(path.join(__dirname, '../public/js/agent-chat-ui.js'), 'utf8');
    vm.runInNewContext(source, { window, URL });
    return window.HelpdeskAgentUI;
}

test('agent UI projects approval, completion and recoverable errors', () => {
    const ui = agentUi();
    const approval = ui.project({
        type: 'approval_pending', message: 'Chờ duyệt',
        actionPreview: { summary: 'Đơn giao thiếu hàng' }
    });
    assert.equal(approval.preview, 'Đơn giao thiếu hàng');
    assert.equal(approval.actions[0].type, 'request_handoff');

    const completed = ui.project({ type: 'action_completed', message: 'Đã tạo', referenceId: 'ticket-123' });
    assert.equal(completed.reference, 'ticket-123');

    const retry = ui.project({ type: 'temporarily_unavailable', message: 'Thử lại sau', retryable: true });
    assert.deepEqual(Array.from(retry.actions, action => action.type), ['retry', 'request_handoff']);
    const terminal = ui.project({ type: 'temporarily_unavailable', message: 'Tạm dừng', retryable: false });
    assert.deepEqual(Array.from(terminal.actions, action => action.type), ['request_handoff']);
});

test('citation links allow safe source URLs and refuse unsafe schemes', () => {
    const ui = agentUi();
    assert.equal(ui.citationUrl('/explore/binh-loi'), '/explore/binh-loi');
    assert.equal(ui.citationUrl('https://example.org/reference'), 'https://example.org/reference');
    assert.equal(ui.citationUrl('javascript:alert(1)'), null);
    assert.equal(ui.citationUrl('http://example.org/reference'), null);
    assert.equal(ui.citationUrl('//example.org/reference'), null);
    assert.equal(ui.citationUrl('https://user:pass@example.org/reference'), null);
});

test('history is scoped to a user, omits loading messages and bounds handoff text', () => {
    const ui = agentUi();
    ui.save('customer-1', [
        { role: 'user', content: 'Tôi cần giúp về đơn hàng' },
        { role: 'assistant', loading: true },
        { role: 'assistant', content: 'Tôi sẽ chuyển nhân viên.' }
    ]);
    assert.equal(ui.load('customer-1').length, 2);
    assert.equal(ui.load('customer-2').length, 0);
    const summary = ui.handoffSummary(ui.load('customer-1'));
    assert.match(summary, /Khách: Tôi cần giúp về đơn hàng/);
    assert.ok(summary.length <= 700);
});

test('page memory and staff handoff redact common credential patterns', () => {
    const ui = agentUi();
    const secret = 'sk-1234567890abcdefghijklmnop';
    const messages = [{ role: 'user', content: `Token: ${secret} và Bearer sample-private-token` }];
    ui.save('customer-1', messages);
    assert.doesNotMatch(JSON.stringify(ui.load('customer-1')), /sk-123456|sample-private-token/);
    assert.doesNotMatch(ui.handoffSummary(messages), /sk-123456|sample-private-token/);
});

test('handoff preserves an intact review receipt and clear removes local transcript', () => {
    const ui = agentUi();
    const receipt = `ar1.${'A'.repeat(1200)}`;
    const messages = [
        { role: 'user', content: 'Tôi cần tạo phiếu hỗ trợ' },
        ui.project({ type: 'approval_pending', message: 'Chờ duyệt', approvalId: 'pause-1',
            actionPreview: { summary: 'Tạo phiếu' }, reviewReceipt: receipt })
    ];
    ui.save('customer-1', messages);
    const summary = ui.handoffSummary(ui.load('customer-1'));
    assert.ok(summary.endsWith(receipt));
    assert.ok(summary.length <= 2000);
    ui.clear('customer-1');
    assert.equal(ui.load('customer-1').length, 0);
});
