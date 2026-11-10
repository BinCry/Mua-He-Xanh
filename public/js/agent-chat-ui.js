(function (root) {
    'use strict';

    const MAX_HISTORY = 24;
    const MAX_TEXT = 2000;
    const histories = new Map();

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
            preview: redactText(entry.preview).slice(0, 500),
            reference: String(entry.reference || '').slice(0, 128),
            status: String(entry.status || '').slice(0, 40),
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
        let content = type === 'clarification_required'
            ? String(output.question || '')
            : String(output?.message || 'Trợ lý chưa thể trả lời bằng thông tin đã kiểm chứng.');
        if (['approval_pending', 'handoff'].includes(type) && !output?.reviewReceipt) {
            content += ' Mã bàn giao chưa khả dụng; hãy liên hệ nhân viên để được hỗ trợ trực tiếp.';
        }
        const actions = Array.isArray(output?.suggestedActions) ? [...output.suggestedActions] : [];
        if (type === 'temporarily_unavailable') {
            if (output.retryable) actions.push({ type: 'retry', label: 'Thử lại' });
            actions.push({ type: 'request_handoff', label: 'Chat nhân viên' });
        }
        if (['handoff', 'approval_pending', 'confirmation_required'].includes(type)) {
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

    root.HelpdeskAgentUI = { load, save, clear, project, citationUrl, handoffSummary };
})(window);
