/* Shared by the full chat and floating chat. All summary text comes from the server. */
(() => {
    let busy = false;
    window.openHumanHandoff = async ({ handoffId = '', destinationId = null, switchToStaff = () => {} } = {}) => {
        if (busy || document.getElementById('human-handoff-preview')) return;
        busy = true;
        const panel = document.createElement('section');
        panel.id = 'human-handoff-preview';
        panel.className = 'bg-white border rounded-4 shadow p-3';
        panel.style.cssText = 'position:fixed;z-index:1090;bottom:20px;left:50%;transform:translateX(-50%);width:min(94vw,540px);max-height:80vh;overflow:auto;color:#212529';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Bàn giao cho nhân viên');
        const title = document.createElement('h2');
        title.className = 'h5';
        title.textContent = 'Gửi yêu cầu cho nhân viên';
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        status.textContent = 'Đang chuẩn bị bản tóm tắt…';
        const content = document.createElement('div');
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn btn-sm btn-outline-secondary';
        close.textContent = 'Hủy';
        close.onclick = () => panel.remove();
        panel.append(title, status, content, close);
        document.body.append(panel);

        function render(data) {
            content.replaceChildren();
            const summaryText = typeof data.summary === 'string' ? data.summary : '';
            const written = data.status === 'pending' && data.written === true;
            status.textContent = data.message
                || (data.status === 'sent' ? 'Đã gửi bản tóm tắt cho nhân viên.'
                    : written ? 'Nội dung đã được lưu. Xác nhận để hoàn tất chuyển sang chat nhân viên.'
                        : 'Kiểm tra và chỉnh sửa nội dung trước khi gửi.');
            if (data.status === 'sent' && summaryText) {
                const summary = document.createElement('div');
                summary.className = 'bg-light rounded p-3 mb-3';
                summary.style.whiteSpace = 'pre-wrap';
                summary.textContent = summaryText;
                content.append(summary);
            }
            if (data.status === 'sent') {
                close.textContent = 'Đóng';
                const go = document.createElement('button');
                go.type = 'button';
                go.className = 'btn btn-outline-success';
                go.textContent = 'Vào chat nhân viên';
                go.onclick = () => { panel.remove(); switchToStaff(); };
                content.append(go);
                return;
            }
            close.textContent = 'Hủy';
            const label = document.createElement('label');
            label.htmlFor = 'handoff-summary-editor';
            label.textContent = 'Nội dung gửi cho nhân viên';
            const editor = document.createElement('textarea');
            editor.id = 'handoff-summary-editor';
            editor.className = 'form-control mb-3';
            editor.maxLength = 1400;
            editor.rows = 8;
            editor.required = true;
            editor.value = summaryText;
            editor.disabled = written;
            content.append(label, editor);
            const send = document.createElement('button');
            send.type = 'button';
            send.className = 'btn btn-success me-2';
            send.textContent = typeof data.sendLabel === 'string' && data.sendLabel.trim()
                ? data.sendLabel.trim()
                : 'Gửi cho nhân viên';
            send.onclick = async () => {
                const editedSummary = editor.value.trim();
                if (!editedSummary) {
                    status.textContent = 'Vui lòng nhập nội dung cần gửi cho nhân viên.';
                    editor.focus();
                    return;
                }
                send.disabled = true;
                close.disabled = true;
                editor.disabled = true;
                try {
                    const result = await axios.post('/api/agent/handoff/send', {
                        previewId: data.previewId,
                        summary: editedSummary,
                        destinationId
                    }, { timeout: 15000 });
                    if (!result.data?.success || !result.data?.data) throw new Error();
                    const next = result.data.data;
                    const delivered = next.status === 'waiting_for_human';
                    if (delivered || next.status === 'sent') {
                        next.status = 'sent';
                        next.summary = next.summary || data.summary;
                    }
                    render(next);
                    if (delivered) {
                        switchToStaff();
                        window.dispatchEvent(new Event('human-handoff-sent'));
                    }
                } catch (_) {
                    status.textContent = 'Chưa gửi được yêu cầu. Nội dung vẫn được giữ lại; vui lòng gửi lại.';
                    send.disabled = false;
                    editor.disabled = written;
                } finally {
                    close.disabled = false;
                }
            };
            content.append(send);
            send.focus();
        }

        try {
            const response = await axios.post('/api/agent/handoff/preview', handoffId ? { handoffId } : {}, { timeout: 45000 });
            if (!panel.isConnected) return;
            const data = response.data?.data;
            if (!response.data?.success || !data || !['preview', 'pending', 'sent'].includes(data.status)) throw new Error();
            render(data);
        } catch (_) {
            status.textContent = 'Chưa lấy được ngữ cảnh bàn giao. Bạn có thể đóng bảng này, chuyển sang chat nhân viên và nhập lại thông tin cần hỗ trợ.';
        } finally { busy = false; }
    };
})();
