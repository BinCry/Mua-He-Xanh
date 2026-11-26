const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

test('both chat views send reschedule actions through the current agent conversation', () => {
    for (const [view, sendName, pendingName] of [
        ['chat/index.ejs', 'sendAgentMessage', 'agentRequestPending'],
        ['layouts/main.ejs', 'sendFloatingAgentMessage', 'floatingAgentRequestPending']
    ]) {
        const source = fs.readFileSync(path.join(__dirname, '../src/views', view), 'utf8');
        const branch = source.match(/else if \(action\?\.type === 'request_reschedule_ticket'\) \{([\s\S]*?)\} else if/);
        assert.ok(branch, `${view} must render the reschedule action`);
        const sent = [];
        const buttons = [];
        const render = new Function('document', 'action', 'actionLabel', 'actions', sendName, pendingName, branch[1]);
        for (const pending of [false, true]) {
            let onClick;
            render({ createElement: () => ({ addEventListener: (_, callback) => { onClick = callback; } }) },
                { type: 'request_reschedule_ticket', label: 'Tạo yêu cầu đổi lịch' },
                'Tạo yêu cầu đổi lịch', { append: button => buttons.push(button) },
                message => sent.push(message), pending);
            assert.equal(buttons.at(-1).disabled, pending);
            if (!pending) onClick();
        }
        assert.deepEqual(sent, ['Tạo yêu cầu đổi lịch']);
    }
});
