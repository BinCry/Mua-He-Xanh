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
        title.textContent = 'Thông tin gửi cho nhân viên';
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        status.textContent = 'Đang chuẩn bị bản tóm tắt…';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn btn-sm btn-outline-secondary';
        close.textContent = 'Đóng';
        close.onclick = () => panel.remove();
        panel.append(title, status, close);
        document.body.append(panel);
        try {
            const response = await axios.post('/api/agent/handoff/preview', { handoffId }, { timeout: 45000 });
            if (!panel.isConnected) return;
            const data = response.data?.data;
            if (!response.data?.success || !data?.handoffId || typeof data.summary !== 'string') throw new Error();
            switchToStaff();
            status.textContent = 'Bạn có thể bổ sung lời nhắn trước khi gửi.';
            const summary = document.createElement('div');
            summary.className = 'bg-light rounded p-3 mb-3';
            summary.style.whiteSpace = 'pre-wrap';
            summary.textContent = data.summary;
            const label = document.createElement('label');
            label.htmlFor = 'handoff-customer-note';
            label.textContent = 'Lời nhắn bổ sung (không bắt buộc)';
            const note = document.createElement('textarea');
            note.id = 'handoff-customer-note';
            note.className = 'form-control mb-3';
            note.maxLength = 300;
            const send = document.createElement('button');
            send.type = 'button';
            send.className = 'btn btn-success me-2';
            send.textContent = 'Gửi cho nhân viên';
            send.onclick = async () => {
                send.disabled = true;
                close.disabled = true;
                note.disabled = true;
                try {
                    const result = await axios.post('/api/agent/handoff/send', { handoffId: data.handoffId, note: note.value, destinationId }, { timeout: 15000 });
                    if (!result.data?.success) throw new Error();
                    status.textContent = 'Đã gửi yêu cầu cùng bản tóm tắt. Vui lòng chờ nhân viên tiếp nhận.';
                    send.remove();
                    window.dispatchEvent(new Event('human-handoff-sent'));
                } catch (_) {
                    status.textContent = 'Chưa gửi được yêu cầu. Vui lòng thử lại; nếu phiên hết hạn, hãy chuẩn bị lại bản tóm tắt.';
                    send.disabled = false;
                    note.disabled = false;
                } finally { close.disabled = false; }
            };
            panel.insertBefore(summary, close);
            panel.insertBefore(label, close);
            panel.insertBefore(note, close);
            panel.insertBefore(send, close);
            send.focus();
        } catch (_) {
            status.textContent = 'Chưa lấy được ngữ cảnh bàn giao. Bạn có thể đóng bảng này, chuyển sang chat nhân viên và nhập lại thông tin cần hỗ trợ.';
        } finally { busy = false; }
    };
})();
