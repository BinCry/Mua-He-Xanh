(() => {
    'use strict';
    const root = document.getElementById('personalization-page');
    if (!root) return;
    let english = document.documentElement.lang === 'en';
    try { english = localStorage.getItem('app_lang') === 'en'; } catch (_) {}
    const copy = english ? {
        profile: 'Traveler profile', title: 'Personalization', toggle: 'Personalize your experience',
        description: 'Allow the assistant to remember preferences from your conversations to offer more relevant suggestions.',
        remembered: 'Remembered preferences', reload: 'Refresh', clear: 'Delete all remembered preferences',
        save: 'Save', cancel: 'Cancel', edit: 'Edit', remove: 'Delete', empty: 'No preferences remembered yet.',
        loading: 'Loading…', failure: 'Unable to save or load preferences. Please try again.', saved: 'Preferences updated.',
        disable: 'Turning this off deletes your remembered preferences and stops remembering new ones. Continue?',
        clearConfirm: 'Delete all remembered preferences? Personalization will keep its current setting.',
        removeConfirm: 'Delete this preference?', amount: 'Maximum budget', currency: 'Currency', unit: 'Budget unit',
        per_person: 'Per person', per_night: 'Per night', per_trip: 'Per trip', language: 'Language', style: 'Answer style',
        concise: 'Concise', detailed: 'Detailed', expires: 'Expires', choose: 'Select at least one preference.'
    } : {
        profile: 'Hồ sơ du khách', title: 'Cá nhân hóa', toggle: 'Cá nhân hóa trải nghiệm',
        description: 'Cho phép trợ lý ghi nhớ một số sở thích từ cuộc trò chuyện để đưa ra gợi ý phù hợp hơn.',
        remembered: 'Thông tin đang ghi nhớ', reload: 'Tải lại', clear: 'Xóa toàn bộ thông tin đã ghi nhớ',
        save: 'Lưu', cancel: 'Hủy', edit: 'Sửa', remove: 'Xóa', empty: 'Chưa có sở thích nào được ghi nhớ.',
        loading: 'Đang tải…', failure: 'Chưa thể tải hoặc lưu sở thích. Bạn vui lòng thử lại.', saved: 'Đã cập nhật sở thích.',
        disable: 'Tắt sẽ xóa các sở thích đã lưu và ngừng ghi nhớ thông tin mới. Bạn muốn tiếp tục?',
        clearConfirm: 'Xóa toàn bộ sở thích đã lưu? Trạng thái cá nhân hóa sẽ được giữ nguyên.',
        removeConfirm: 'Xóa sở thích này?', amount: 'Ngân sách tối đa', currency: 'Tiền tệ', unit: 'Đơn vị ngân sách',
        per_person: 'Mỗi người', per_night: 'Mỗi đêm', per_trip: 'Mỗi chuyến', language: 'Ngôn ngữ', style: 'Cách trả lời',
        concise: 'Ngắn gọn', detailed: 'Chi tiết', expires: 'Hết hạn', choose: 'Vui lòng chọn ít nhất một sở thích.'
    };
    const fieldNames = {
        preferred_experience_types: ['Trải nghiệm yêu thích', 'Preferred experiences'],
        avoided_experience_types: ['Trải nghiệm muốn tránh', 'Experiences to avoid'],
        dietary_preferences: ['Sở thích ăn uống', 'Dietary preferences'], food_avoidances: ['Món muốn tránh', 'Foods to avoid'],
        typical_budget: ['Ngân sách thường dùng', 'Typical budget'], communication_preferences: ['Cách giao tiếp', 'Communication preferences']
    };
    const choices = {
        nature: ['Thiên nhiên', 'Nature'], food: ['Ẩm thực', 'Food'], culture: ['Văn hóa', 'Culture'], craft: ['Làng nghề', 'Craft'],
        history: ['Lịch sử', 'History'], adventure: ['Mạo hiểm', 'Adventure'], family: ['Gia đình', 'Family'], quiet: ['Yên tĩnh', 'Quiet'],
        vegetarian: ['Ăn chay', 'Vegetarian'], vegan: ['Thuần chay', 'Vegan'], local_food: ['Món địa phương', 'Local food'],
        seafood: ['Hải sản', 'Seafood'], meat: ['Thịt', 'Meat'], spicy: ['Cay', 'Spicy']
    };
    const experience = ['nature', 'food', 'culture', 'craft', 'history', 'adventure', 'family', 'quiet'];
    const allowed = { preferred_experience_types: experience, avoided_experience_types: experience,
        dietary_preferences: ['vegetarian', 'vegan', 'local_food'], food_avoidances: ['seafood', 'meat', 'spicy'] };
    const label = (entry) => entry?.[english ? 1 : 0] || '';
    root.querySelectorAll('[data-copy]').forEach(node => { node.textContent = copy[node.dataset.copy]; });
    const status = document.getElementById('personalization-status');
    const toggle = document.getElementById('personalization-enabled');
    const list = document.getElementById('personalization-items');
    const clear = document.getElementById('personalization-clear');
    const editor = document.getElementById('personalization-editor');
    const fields = document.getElementById('personalization-fields');
    let state = null;
    let editing = null;
    let busy = false;
    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    }
    function describe(item) {
        if (Array.isArray(item.value)) return item.value.map(value => label(choices[value]) || value).join(', ');
        if (item.key === 'typical_budget') return `${Number(item.value.max_amount).toLocaleString(english ? 'en-US' : 'vi-VN')} ${item.value.currency} / ${copy[item.value.unit] || item.value.unit}`;
        if (item.key === 'communication_preferences') return [item.value.language ? (item.value.language === 'en' ? 'English' : 'Tiếng Việt') : '', copy[item.value.answer_style]].filter(Boolean).join(' · ');
        return '';
    }
    function render() {
        toggle.checked = state.enabled;
        toggle.disabled = busy;
        clear.disabled = busy || !state.items.length;
        list.replaceChildren();
        if (!state.items.length) list.append(element('p', copy.empty, 'text-muted mb-0'));
        state.items.forEach(item => {
            const row = element('div', undefined, 'd-flex flex-wrap gap-3 align-items-center justify-content-between py-3 border-bottom');
            const info = element('div');
            info.append(element('div', label(fieldNames[item.key]) || item.key, 'fw-semibold'), element('div', describe(item), 'text-muted'));
            if (item.expires_at) info.append(element('small', `${copy.expires} ${new Date(item.expires_at).toLocaleDateString(english ? 'en-US' : 'vi-VN')}`, 'text-muted'));
            const actions = element('div', undefined, 'd-flex gap-2');
            const edit = element('button', copy.edit, 'btn btn-sm btn-outline-secondary');
            edit.type = 'button'; edit.disabled = busy || !state.enabled; edit.onclick = () => openEditor(item);
            const remove = element('button', copy.remove, 'btn btn-sm btn-outline-danger');
            remove.type = 'button'; remove.disabled = busy;
            remove.onclick = () => { if (confirm(copy.removeConfirm)) mutate(`/items/${encodeURIComponent(item.key)}`, 'DELETE'); };
            actions.append(edit, remove); row.append(info, actions); list.append(row);
        });
    }
    async function request(suffix = '', method = 'GET', payload) {
        const response = await fetch(`/api/me/personalization${suffix}`, {
            method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
        });
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error('request failed');
        return body.data;
    }
    async function load() {
        status.textContent = copy.loading;
        try { state = await request(); render(); status.textContent = ''; }
        catch (_) { status.textContent = copy.failure; }
    }
    async function mutate(suffix, method, payload) {
        if (busy) return;
        busy = true; editor.hidden = true; render();
        try {
            await request(suffix, method, payload);
            state = await request(); status.textContent = copy.saved;
        } catch (_) { status.textContent = copy.failure; }
        finally { busy = false; render(); }
    }
    function input(name, title, value, options) {
        const wrapper = element('div', undefined, 'mb-3');
        const caption = element('label', title, 'form-label');
        caption.htmlFor = `memory-${name}`;
        const control = element(options ? 'select' : 'input', undefined, 'form-control');
        control.name = name; control.id = caption.htmlFor;
        if (options) options.forEach(([key, text]) => { const option = element('option', text); option.value = key; control.append(option); });
        else { control.type = 'number'; control.min = '0.01'; control.step = '0.01'; control.required = true; }
        control.value = value ?? '';
        wrapper.append(caption, control); fields.append(wrapper);
    }
    function openEditor(item) {
        editing = item; fields.replaceChildren();
        document.getElementById('personalization-editor-title').textContent = label(fieldNames[item.key]);
        if (allowed[item.key]) {
            allowed[item.key].forEach(value => {
                const wrapper = element('label', undefined, 'd-block mb-2');
                const checkbox = element('input', undefined, 'form-check-input me-2');
                checkbox.type = 'checkbox'; checkbox.name = 'values'; checkbox.value = value; checkbox.checked = item.value.includes(value);
                wrapper.append(checkbox, document.createTextNode(label(choices[value]))); fields.append(wrapper);
            });
        } else if (item.key === 'typical_budget') {
            input('max_amount', copy.amount, item.value.max_amount);
            input('currency', copy.currency, item.value.currency, [['VND', 'VND'], ['USD', 'USD']]);
            input('unit', copy.unit, item.value.unit, ['per_person', 'per_night', 'per_trip'].map(unit => [unit, copy[unit]]));
        } else {
            input('language', copy.language, item.value.language, [['vi', 'Tiếng Việt'], ['en', 'English']]);
            input('answer_style', copy.style, item.value.answer_style, [['concise', copy.concise], ['detailed', copy.detailed]]);
        }
        editor.hidden = false; fields.querySelector('input,select')?.focus();
    }
    document.getElementById('personalization-form').onsubmit = event => {
        event.preventDefault();
        const data = new FormData(event.target);
        let value;
        if (allowed[editing.key]) {
            value = data.getAll('values');
            if (!value.length) { status.textContent = copy.choose; return; }
        } else if (editing.key === 'typical_budget') value = { max_amount: Number(data.get('max_amount')), currency: data.get('currency'), unit: data.get('unit') };
        else value = { language: data.get('language'), answer_style: data.get('answer_style') };
        mutate(`/items/${encodeURIComponent(editing.key)}`, 'PATCH', { value });
    };
    document.getElementById('personalization-cancel').onclick = () => { editor.hidden = true; };
    document.getElementById('personalization-reload').onclick = () => { if (!busy) load(); };
    clear.onclick = () => { if (confirm(copy.clearConfirm)) mutate('/items', 'DELETE'); };
    toggle.onchange = () => {
        const enabled = toggle.checked;
        if (!enabled && !confirm(copy.disable)) { toggle.checked = state.enabled; return; }
        mutate('', 'PATCH', { enabled });
    };
    load();
})();
