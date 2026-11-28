(function (root) {
    'use strict';

    const MAX_HISTORY = 24;
    const MAX_TEXT = 2000;
    const histories = new Map();
    let activeConversationId = createConversationId();

    function createConversationId() {
        if (typeof root.crypto?.randomUUID === 'function') return root.crypto.randomUUID();
        const bytes = new Uint8Array(16);
        root.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    function conversationId() {
        return activeConversationId;
    }

    function conversationHeaders() {
        return { 'X-Agent-Conversation-ID': activeConversationId };
    }

    function beginConversation() {
        activeConversationId = createConversationId();
        return activeConversationId;
    }

    function historyKey(userId) {
        return String(userId || '').slice(0, 128);
    }

    function redactText(value) {
        return String(value || '')
            .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [đã ẩn]')
            .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{30,}|AKIA[A-Z0-9]{16})\b/g, '[đã ẩn]')
            .replace(/((?:api[_-]?key|token|password|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[đã ẩn]');
    }

    function cleanEntry(entry) {
        if (!entry || !['user', 'assistant'].includes(entry.role) || entry.loading) return null;
        return {
            role: entry.role,
            content: redactText(entry.content).slice(0, MAX_TEXT),
            citations: Array.isArray(entry.citations) ? entry.citations.slice(0, 8) : [],
            actions: Array.isArray(entry.actions) ? entry.actions.slice(0, 4) : [],
            preview: redactText(entry.preview).slice(0, 4400),
            reference: String(entry.reference || '').slice(0, 128),
            status: String(entry.status || '').slice(0, 40),
            options: Array.isArray(entry.options) ? entry.options.slice(0, 10) : [],
            allowFreeText: entry.allowFreeText !== false,
            confirmationId: String(entry.confirmationId || '').slice(0, 128),
            reviewReceipt: /^ar1\.[A-Za-z0-9_-]{40,1800}$/.test(String(entry.reviewReceipt || ''))
                ? entry.reviewReceipt : ''
        };
    }

    function load(userId) {
        if (!userId) return [];
        return [...(histories.get(historyKey(userId)) || [])];
    }

    function save(userId, messages) {
        if (!userId) return;
        const entries = messages.slice(-MAX_HISTORY).map(cleanEntry).filter(Boolean);
        histories.set(historyKey(userId), entries);
    }

    function clear(userId) {
        if (userId) histories.delete(historyKey(userId));
    }

    function project(output) {
        const type = String(output?.type || '');
        let content;
        if (type === 'clarification_required') {
            // A handoff review carries the exact summary the customer will send;
            // show it before the confirmation question.
            const summary = typeof output.summary === 'string' ? output.summary.trim() : '';
            const question = String(output.question || '');
            content = summary ? `${summary}\n\n${question}` : question;
        } else {
            content = String(output?.message || 'Trợ lý chưa thể trả lời bằng thông tin đã kiểm chứng.');
        }
        if (type === 'handoff' && !output?.reviewReceipt) {
            content += ' Mã bàn giao chưa khả dụng; hãy liên hệ nhân viên để được hỗ trợ trực tiếp.';
        }
        const actions = Array.isArray(output?.suggestedActions) ? [...output.suggestedActions] : [];
        if (type === 'temporarily_unavailable') {
            if (output.retryable) actions.push({ type: 'retry', label: 'Thử lại' });
            actions.push({ type: 'request_handoff', label: 'Chat nhân viên' });
        }
        if (type === 'handoff') {
            actions.push({ type: 'request_handoff', label: 'Liên hệ nhân viên' });
        }
        return {
            role: 'assistant',
            content,
            citations: type === 'answer' && Array.isArray(output.citations) ? output.citations : [],
            actions,
            preview: ['approval_pending', 'confirmation_required'].includes(type)
                ? String(output.actionPreview?.summary || '') : '',
            reference: type === 'action_completed' ? String(output.referenceId || '') : '',
            status: type,
            options: type === 'clarification_required' && Array.isArray(output.options)
                ? output.options.filter(option => typeof option === 'string' && option.trim() && option.length <= MAX_TEXT).slice(0, 10) : [],
            allowFreeText: output?.allowFreeText !== false,
            confirmationId: type === 'confirmation_required' ? String(output.confirmationId || '') : '',
            reviewReceipt: String(output?.reviewReceipt || '')
        };
    }

    function citationUrl(value) {
        const raw = String(value || '').trim();
        if (!raw || raw.startsWith('//') || raw.includes('\\')) return null;
        try {
            const url = new URL(raw, root.location.origin);
            if (url.username || url.password) return null;
            if (url.origin === root.location.origin) return `${url.pathname}${url.search}${url.hash}`;
            return url.protocol === 'https:' ? url.href : null;
        } catch (_) {
            return null;
        }
    }

    function handoffSummary(messages) {
        const turns = messages.filter(entry => !entry.loading && entry.content && ['user', 'assistant'].includes(entry.role)).slice(-4);
        const lines = turns.map(entry => `${entry.role === 'user' ? 'Khách' : 'Trợ lý'}: ${redactText(entry.content).replace(/\s+/g, ' ').slice(0, 150)}`);
        const summary = `Tôi muốn nhân viên tiếp tục hỗ trợ từ Trợ lý AI. ${lines.join(' | ')}`.slice(0, 700);
        const latestOutcome = [...messages].reverse().find(entry => entry.role === 'assistant' && entry.status);
        const receipt = ['approval_pending', 'handoff'].includes(latestOutcome?.status)
            ? latestOutcome.reviewReceipt : '';
        if (!receipt) return summary;
        const suffix = ` | Mã bàn giao AI: ${receipt}`;
        return `${summary.slice(0, Math.max(0, 2000 - suffix.length))}${suffix}`;
    }

    function choiceOnly(messages) {
        const last = messages[messages.length - 1];
        return last?.status === 'clarification_required' && last.allowFreeText === false && last.options?.length > 0;
    }

    function parseReschedulePreview(preview) {
        const text = String(preview || '').trim();
        if (!text) return null;
        return { content: text };
    }

    function openRescheduleDraftEditor({ preview = '', save = async () => null } = {}) {
        if (root.document.getElementById('reschedule-draft-editor')) return;
        const draft = parseReschedulePreview(preview);
        if (!draft) return;

        const panel = root.document.createElement('section');
        panel.id = 'reschedule-draft-editor';
        panel.className = 'bg-white border rounded-4 shadow p-3';
        panel.style.cssText = 'position:fixed;z-index:1100;top:50%;left:50%;transform:translate(-50%,-50%);width:min(94vw,620px);max-height:88vh;overflow:auto;color:#212529';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'reschedule-draft-title');

        const title = root.document.createElement('h2');
        title.id = 'reschedule-draft-title';
        title.className = 'h4 mb-2';
        title.textContent = 'Sửa nội dung yêu cầu';
        const help = root.document.createElement('p');
        help.className = 'text-muted mb-3';
        help.textContent = 'Bạn có thể chỉnh sửa toàn bộ nội dung trước khi lưu. Việc sửa bản nháp không thay đổi booking thật.';

        const contentLabel = root.document.createElement('label');
        contentLabel.htmlFor = 'reschedule-draft-content';
        contentLabel.className = 'form-label fw-semibold';
        contentLabel.textContent = 'Nội dung yêu cầu gửi cho nhân viên';
        const content = root.document.createElement('textarea');
        content.id = 'reschedule-draft-content';
        content.className = 'form-control mb-3';
        content.rows = 14;
        content.maxLength = 4000;
        content.required = true;
        content.value = draft.content;

        const status = root.document.createElement('p');
        status.className = 'small text-danger mb-2';
        status.setAttribute('role', 'status');
        const saveButton = root.document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'btn btn-success me-2';
        saveButton.textContent = 'Lưu thay đổi';
        const cancel = root.document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn btn-outline-secondary';
        cancel.textContent = 'Hủy chỉnh sửa';
        cancel.onclick = () => panel.remove();

        let editStarted = false;
        saveButton.onclick = async () => {
            const revisedContent = content.value.trim();
            if (!revisedContent) {
                status.textContent = 'Vui lòng nhập nội dung yêu cầu.';
                content.focus();
                return;
            }
            saveButton.disabled = true;
            cancel.disabled = true;
            content.disabled = true;
            status.className = 'small text-muted mb-2';
            status.textContent = 'Đang cập nhật bản nháp…';
            try {
                const progress = { editStarted };
                const result = await save(revisedContent, progress);
                editStarted = progress.editStarted;
                if (!result || result.type !== 'confirmation_required') throw new Error('DRAFT_EDIT_FAILED');
                panel.remove();
            } catch (_) {
                status.className = 'small text-danger mb-2';
                status.textContent = 'Chưa lưu được thay đổi. Nội dung vẫn được giữ lại; vui lòng thử lại.';
                saveButton.disabled = false;
                content.disabled = false;
                // Once the backend entered edit mode, closing would strand the
                // draft between two steps. Keep the dialog open for a safe retry.
                cancel.disabled = editStarted;
            }
        };

        panel.append(title, help, contentLabel, content, status, saveButton, cancel);
        root.document.body.append(panel);
        content.focus();
    }

    function appendTicketControls(bubble, entry, messages, pending, send) {
        let labels = [];
        if (entry.status === 'clarification_required') labels = entry.options || [];
        if (entry.status === 'confirmation_required' && entry.confirmationId) {
            labels = ['Xác nhận gửi', 'Sửa nội dung', 'Hủy'];
        }
        if (!labels.length) return;
        const controls = root.document.createElement('div');
        controls.className = 'd-flex flex-column gap-2 mt-3 p-2 bg-white border rounded-4 text-dark';
        controls.setAttribute('role', 'group');
        controls.setAttribute('aria-label', 'Trả lời yêu cầu hỗ trợ');
        labels.forEach((label, index) => {
            const button = root.document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-light border rounded-3 text-start w-100 px-3 py-2';
            button.style = 'min-height:44px;white-space:normal;overflow-wrap:anywhere';
            button.textContent = `${index + 1}. ${label}`;
            button.disabled = pending || messages[messages.length - 1] !== entry;
            button.addEventListener('click', async () => {
                if (button.disabled || messages[messages.length - 1] !== entry) return;
                if (label === 'Sửa nội dung' && parseReschedulePreview(entry.preview)) {
                    openRescheduleDraftEditor({
                        preview: entry.preview,
                        save: async (revisedRequest, progress) => {
                            if (!progress.editStarted) {
                                const edit = await send('Sửa toàn bộ nội dung', { hidden: true });
                                if (!edit || edit.type !== 'clarification_required') return null;
                                progress.editStarted = true;
                            }
                            return send(revisedRequest);
                        }
                    });
                    return;
                }
                Array.from(controls.children).forEach(control => { control.disabled = true; });
                await send(label);
            });
            controls.append(button);
        });
        bubble.append(controls);
    }

    root.HelpdeskAgentUI = {
        load, save, clear, project, citationUrl, handoffSummary, appendTicketControls, choiceOnly,
        conversationId, conversationHeaders, beginConversation, parseReschedulePreview,
        openRescheduleDraftEditor
    };
})(window);
