(() => {
    'use strict';

    const root = document.getElementById('personalization-page');
    if (!root) return;

    let english = document.documentElement.lang === 'en';
    try { english = localStorage.getItem('app_lang') === 'en'; } catch (_) {}

    const copy = english ? {
        profile: 'Traveler profile', eyebrow: 'Assistant memory', title: 'Personalization',
        intro: 'Choose what the assistant remembers and update it in natural language.',
        toggle: 'Personalize your experience',
        description: 'Allow the assistant to remember preferences from your conversations to offer more relevant suggestions.',
        summaryTitle: 'Memory summary',
        summaryDescription: 'The assistant uses only the parts relevant to your current question.',
        structuredData: 'Structured data', detailsTitle: 'Saved details', viewDetails: 'View details',
        reload: 'Refresh', clear: 'Delete all memory', save: 'Save changes', cancel: 'Cancel',
        edit: 'Edit', remove: 'Delete', closeDetails: 'Close details', menuLabel: 'Memory options',
        promptLabel: 'Ask or update saved information', promptPlaceholder: 'For example: I no longer eat vegetarian food.',
        promptHelp: 'Add, change, or remove a preference using a natural sentence.', send: 'Send update',
        emptyTitle: 'Nothing has been remembered yet',
        empty: 'Tell the assistant a lasting preference, such as the experiences or Shop products you usually like.',
        loading: 'Loading…', updating: 'Updating memory…', failure: 'Unable to save or load preferences. Please try again.',
        saved: 'Memory updated.', disabledPrompt: 'Turn on personalization to update memory.',
        disable: 'Turning this off deletes your remembered preferences and stops remembering new ones. Continue?',
        clearConfirm: 'Delete all remembered preferences? Personalization will keep its current setting.',
        removeConfirm: 'Delete this preference?', amount: 'Maximum budget', currency: 'Currency', unit: 'Budget unit',
        per_person: 'per person', per_night: 'per night', per_trip: 'per trip', language: 'Language', style: 'Answer style',
        concise: 'Concise', detailed: 'Detailed', expires: 'Expires', choose: 'Select at least one preference.',
        experienceSummary: 'Experiences', foodSummary: 'Food preferences', shopSummary: 'Shop products',
        planningSummary: 'Planning preferences', communicationSummary: 'How the assistant responds',
        preferExperiences: values => `You usually prefer ${values}.`,
        avoidExperiences: values => `You want to avoid ${values}.`,
        preferFood: values => `You usually prefer ${values}.`,
        avoidFood: values => `You want to avoid ${values}.`,
        preferShop: values => `When browsing the Shop, you are usually interested in ${values}.`,
        budgetSummary: value => `Your usual maximum budget is ${value}.`,
        communication: value => `You prefer responses in ${value}.`,
        rememberedCount: count => `${count} saved ${count === 1 ? 'item' : 'items'}`
    } : {
        profile: 'Hồ sơ du khách', eyebrow: 'Bộ nhớ của trợ lý', title: 'Cá nhân hóa',
        intro: 'Chọn điều trợ lý ghi nhớ và cập nhật bằng cách trò chuyện tự nhiên.',
        toggle: 'Cá nhân hóa trải nghiệm',
        description: 'Cho phép trợ lý ghi nhớ một số sở thích từ cuộc trò chuyện để đưa ra gợi ý phù hợp hơn.',
        summaryTitle: 'Tóm tắt thông tin đang ghi nhớ',
        summaryDescription: 'Trợ lý chỉ sử dụng những phần liên quan đến câu hỏi hiện tại.',
        structuredData: 'Dữ liệu có cấu trúc', detailsTitle: 'Chi tiết thông tin đã lưu', viewDetails: 'Xem chi tiết',
        reload: 'Tải lại', clear: 'Xóa toàn bộ thông tin', save: 'Lưu thay đổi', cancel: 'Hủy',
        edit: 'Sửa', remove: 'Xóa', closeDetails: 'Đóng chi tiết', menuLabel: 'Tùy chọn thông tin ghi nhớ',
        promptLabel: 'Hỏi hoặc cập nhật thông tin đang ghi nhớ', promptPlaceholder: 'Ví dụ: Tôi không còn ăn chay nữa.',
        promptHelp: 'Bạn có thể thêm, thay đổi hoặc xóa sở thích bằng một câu tự nhiên.', send: 'Gửi cập nhật',
        emptyTitle: 'Chưa có thông tin nào được ghi nhớ',
        empty: 'Hãy nói với trợ lý một sở thích lâu dài, chẳng hạn trải nghiệm hoặc sản phẩm Shop bạn thường thích.',
        loading: 'Đang tải…', updating: 'Đang cập nhật bộ nhớ…', failure: 'Chưa thể tải hoặc lưu thông tin. Bạn vui lòng thử lại.',
        saved: 'Đã cập nhật thông tin ghi nhớ.', disabledPrompt: 'Hãy bật cá nhân hóa để cập nhật bộ nhớ.',
        disable: 'Tắt sẽ xóa các sở thích đã lưu và ngừng ghi nhớ thông tin mới. Bạn muốn tiếp tục?',
        clearConfirm: 'Xóa toàn bộ thông tin đã lưu? Trạng thái cá nhân hóa sẽ được giữ nguyên.',
        removeConfirm: 'Xóa thông tin này?', amount: 'Ngân sách tối đa', currency: 'Tiền tệ', unit: 'Đơn vị ngân sách',
        per_person: 'mỗi người', per_night: 'mỗi đêm', per_trip: 'mỗi chuyến', language: 'Ngôn ngữ', style: 'Cách trả lời',
        concise: 'Ngắn gọn', detailed: 'Chi tiết', expires: 'Hết hạn', choose: 'Vui lòng chọn ít nhất một sở thích.',
        experienceSummary: 'Sở thích trải nghiệm', foodSummary: 'Ăn uống', shopSummary: 'Sản phẩm Shop',
        planningSummary: 'Cách lập kế hoạch', communicationSummary: 'Cách trợ lý phản hồi',
        preferExperiences: values => `Bạn thường ưu tiên ${values}.`,
        avoidExperiences: values => `Bạn muốn tránh ${values}.`,
        preferFood: values => `Bạn thường ưu tiên ${values}.`,
        avoidFood: values => `Bạn muốn tránh ${values}.`,
        preferShop: values => `Khi xem Shop, bạn thường quan tâm đến ${values}.`,
        budgetSummary: value => `Ngân sách tối đa bạn thường dùng là ${value}.`,
        communication: value => `Bạn muốn trợ lý phản hồi theo cách ${value}.`,
        rememberedCount: count => `${count} mục đang lưu`
    };

    const fieldNames = {
        preferred_experience_types: ['Trải nghiệm yêu thích', 'Preferred experiences'],
        avoided_experience_types: ['Trải nghiệm muốn tránh', 'Experiences to avoid'],
        dietary_preferences: ['Sở thích ăn uống', 'Dietary preferences'],
        food_avoidances: ['Món muốn tránh', 'Foods to avoid'],
        preferred_shop_products: ['Sản phẩm Shop yêu thích', 'Favorite Shop products'],
        typical_budget: ['Ngân sách thường dùng', 'Typical budget'],
        communication_preferences: ['Cách giao tiếp', 'Communication preferences']
    };
    const choices = {
        nature: ['Thiên nhiên', 'nature'], food: ['ẩm thực', 'food'], culture: ['văn hóa', 'culture'], craft: ['làng nghề', 'craft'],
        history: ['lịch sử', 'history'], adventure: ['mạo hiểm', 'adventure'], family: ['gia đình', 'family'], quiet: ['yên tĩnh', 'quiet places'],
        vegetarian: ['món chay', 'vegetarian food'], vegan: ['món thuần chay', 'vegan food'], local_food: ['món địa phương', 'local food'],
        seafood: ['hải sản', 'seafood'], meat: ['thịt', 'meat'], spicy: ['món cay', 'spicy food'],
        melon: ['dưa lưới', 'melon'], incense: ['nhang', 'incense'], tote_bag: ['túi tote', 'tote bags'],
        t_shirt: ['áo thun', 'T-shirts'], pin_badge: ['khuy cài áo', 'pin badges'],
        souvenir_cup: ['ly lưu niệm', 'souvenir cups'], ornamental_plant: ['cây cảnh', 'ornamental plants'],
        local_craft: ['sản phẩm thủ công địa phương', 'local crafts']
    };
    const experience = ['nature', 'food', 'culture', 'craft', 'history', 'adventure', 'family', 'quiet'];
    const allowed = {
        preferred_experience_types: experience,
        avoided_experience_types: experience,
        dietary_preferences: ['vegetarian', 'vegan', 'local_food'],
        food_avoidances: ['seafood', 'meat', 'spicy'],
        preferred_shop_products: ['melon', 'incense', 'tote_bag', 't_shirt', 'pin_badge', 'souvenir_cup', 'ornamental_plant', 'local_craft']
    };

    const label = entry => entry?.[english ? 1 : 0] || '';
    const valuesText = values => values.map(value => label(choices[value]) || value).join(', ');
    root.querySelectorAll('[data-copy]').forEach(node => { node.textContent = copy[node.dataset.copy]; });
    root.querySelectorAll('[data-copy-aria]').forEach(node => { node.setAttribute('aria-label', copy[node.dataset.copyAria]); });
    root.querySelectorAll('[data-copy-placeholder]').forEach(node => { node.placeholder = copy[node.dataset.copyPlaceholder]; });

    const status = document.getElementById('personalization-status');
    const toggle = document.getElementById('personalization-enabled');
    const summary = document.getElementById('personalization-memory-summary');
    const updated = document.getElementById('personalization-updated');
    const list = document.getElementById('personalization-items');
    const clear = document.getElementById('personalization-clear');
    const details = document.getElementById('personalization-details');
    const detailsDisclosure = document.getElementById('personalization-menu-trigger');
    const showDetails = document.getElementById('personalization-show-details');
    const menu = document.getElementById('personalization-menu');
    const editor = document.getElementById('personalization-editor');
    const editorError = document.getElementById('personalization-editor-error');
    const fields = document.getElementById('personalization-fields');
    const prompt = document.getElementById('personalization-prompt');
    const promptSubmit = document.getElementById('personalization-prompt-submit');
    let state = null;
    let editing = null;
    let busy = false;

    const scrollBehavior = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function describe(item) {
        if (Array.isArray(item.value)) return valuesText(item.value);
        if (item.key === 'typical_budget') {
            return `${Number(item.value.max_amount).toLocaleString(english ? 'en-US' : 'vi-VN')} ${item.value.currency} / ${copy[item.value.unit] || item.value.unit}`;
        }
        if (item.key === 'communication_preferences') {
            return [
                item.value.language ? (item.value.language === 'en' ? 'English' : 'Tiếng Việt') : '',
                copy[item.value.answer_style]
            ].filter(Boolean).join(' · ');
        }
        return '';
    }

    function renderSummary() {
        summary.replaceChildren();
        if (!state.items.length) {
            const empty = element('div', undefined, 'memory-empty');
            empty.append(element('strong', copy.emptyTitle), element('p', copy.empty));
            summary.append(empty);
            return;
        }

        const byKey = Object.fromEntries(state.items.map(item => [item.key, item]));
        const sections = [];
        const experiences = [];
        if (byKey.preferred_experience_types) experiences.push(copy.preferExperiences(describe(byKey.preferred_experience_types)));
        if (byKey.avoided_experience_types) experiences.push(copy.avoidExperiences(describe(byKey.avoided_experience_types)));
        if (experiences.length) sections.push([copy.experienceSummary, experiences]);

        const food = [];
        if (byKey.dietary_preferences) food.push(copy.preferFood(describe(byKey.dietary_preferences)));
        if (byKey.food_avoidances) food.push(copy.avoidFood(describe(byKey.food_avoidances)));
        if (food.length) sections.push([copy.foodSummary, food]);

        if (byKey.preferred_shop_products) {
            sections.push([copy.shopSummary, [copy.preferShop(describe(byKey.preferred_shop_products))]]);
        }
        if (byKey.typical_budget) {
            sections.push([copy.planningSummary, [copy.budgetSummary(describe(byKey.typical_budget))]]);
        }
        if (byKey.communication_preferences) {
            sections.push([copy.communicationSummary, [copy.communication(describe(byKey.communication_preferences))]]);
        }

        sections.forEach(([title, sentences]) => {
            const section = element('section', undefined, 'memory-summary-section');
            section.append(element('h3', title), element('p', sentences.join(' ')));
            summary.append(section);
        });
    }

    function renderDetails() {
        list.replaceChildren();
        if (!state.items.length) list.append(element('p', copy.empty, 'text-muted py-3 mb-0'));
        state.items.forEach(item => {
            const row = element('article', undefined, 'memory-detail-row');
            const info = element('div');
            info.append(element('h3', label(fieldNames[item.key]) || item.key), element('p', describe(item)));
            if (item.expires_at) {
                info.append(element('small', `${copy.expires} ${new Date(item.expires_at).toLocaleDateString(english ? 'en-US' : 'vi-VN')}`));
            }
            const actions = element('div', undefined, 'memory-detail-actions');
            const edit = element('button', copy.edit, 'btn btn-sm btn-outline-secondary');
            edit.type = 'button';
            edit.disabled = busy || !state.enabled;
            edit.onclick = () => openEditor(item);
            const remove = element('button', copy.remove, 'btn btn-sm btn-outline-danger');
            remove.type = 'button';
            remove.disabled = busy;
            remove.onclick = () => { if (confirm(copy.removeConfirm)) mutate(`/items/${encodeURIComponent(item.key)}`, 'DELETE'); };
            actions.append(edit, remove);
            row.append(info, actions);
            list.append(row);
        });
    }

    function render() {
        toggle.checked = state.enabled;
        toggle.disabled = busy;
        clear.disabled = busy || !state.items.length;
        prompt.disabled = busy || !state.enabled;
        promptSubmit.disabled = busy || !state.enabled || !prompt.value.trim();
        updated.textContent = copy.rememberedCount(state.items.length);
        renderSummary();
        renderDetails();
    }

    async function request(suffix = '', method = 'GET', payload) {
        const response = await fetch(`/api/me/personalization${suffix}`, {
            method,
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
        });
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error('request failed');
        return body.data;
    }

    async function load({ announce = true } = {}) {
        if (announce) status.textContent = copy.loading;
        try {
            state = await request();
            render();
            if (announce) status.textContent = '';
        } catch (_) {
            status.textContent = copy.failure;
        }
    }

    async function mutate(suffix, method, payload) {
        if (busy) return;
        busy = true;
        editor.hidden = true;
        render();
        try {
            await request(suffix, method, payload);
            state = await request();
            status.textContent = copy.saved;
        } catch (_) {
            status.textContent = copy.failure;
        } finally {
            busy = false;
            render();
        }
    }

    function input(name, title, value, options) {
        const wrapper = element('div', undefined, 'mb-3');
        const caption = element('label', title, 'form-label');
        caption.htmlFor = `memory-${name}`;
        const control = element(options ? 'select' : 'input', undefined, 'form-control');
        control.name = name;
        control.id = caption.htmlFor;
        if (options) {
            options.forEach(([key, text]) => {
                const option = element('option', text);
                option.value = key;
                control.append(option);
            });
        } else {
            control.type = 'number';
            control.min = '0.01';
            control.step = '0.01';
            control.required = true;
        }
        control.value = value ?? '';
        wrapper.append(caption, control);
        fields.append(wrapper);
    }

    function openEditor(item) {
        editing = item;
        fields.replaceChildren();
        editorError.textContent = '';
        document.getElementById('personalization-editor-title').textContent = label(fieldNames[item.key]);
        if (allowed[item.key]) {
            allowed[item.key].forEach(value => {
                const wrapper = element('label', undefined, 'memory-editor-option');
                const checkbox = element('input', undefined, 'form-check-input');
                checkbox.type = 'checkbox';
                checkbox.name = 'values';
                checkbox.value = value;
                checkbox.checked = item.value.includes(value);
                wrapper.append(checkbox, document.createTextNode(label(choices[value])));
                fields.append(wrapper);
            });
        } else if (item.key === 'typical_budget') {
            input('max_amount', copy.amount, item.value.max_amount);
            input('currency', copy.currency, item.value.currency, [['VND', 'VND'], ['USD', 'USD']]);
            input('unit', copy.unit, item.value.unit, ['per_person', 'per_night', 'per_trip'].map(unit => [unit, copy[unit]]));
        } else {
            input('language', copy.language, item.value.language, [['vi', 'Tiếng Việt'], ['en', 'English']]);
            input('answer_style', copy.style, item.value.answer_style, [['concise', copy.concise], ['detailed', copy.detailed]]);
        }
        editor.hidden = false;
        editor.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
        fields.querySelector('input,select')?.focus({ preventScroll: true });
    }

    document.getElementById('personalization-form').onsubmit = event => {
        event.preventDefault();
        const data = new FormData(event.target);
        let value;
        if (allowed[editing.key]) {
            value = data.getAll('values');
            if (!value.length) {
                editorError.textContent = copy.choose;
                const firstChoice = fields.querySelector('input[type="checkbox"]');
                firstChoice?.focus();
                return;
            }
        } else if (editing.key === 'typical_budget') {
            value = { max_amount: Number(data.get('max_amount')), currency: data.get('currency'), unit: data.get('unit') };
        } else {
            value = { language: data.get('language'), answer_style: data.get('answer_style') };
        }
        mutate(`/items/${encodeURIComponent(editing.key)}`, 'PATCH', { value });
    };

    document.getElementById('personalization-prompt-form').onsubmit = async event => {
        event.preventDefault();
        const message = prompt.value.trim();
        if (!message || busy) return;
        if (!state || !state.enabled) {
            status.textContent = copy.disabledPrompt;
            return;
        }
        busy = true;
        status.textContent = copy.updating;
        render();
        try {
            const response = await fetch('/api/agent/chat', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    requestId: globalThis.crypto?.randomUUID?.() || `memory-${Date.now()}`
                })
            });
            const body = await response.json();
            const output = body?.data?.output;
            if (!response.ok || body?.success !== true || !output) throw new Error('update failed');
            prompt.value = '';
            state = await request();
            status.textContent = output.message || output.question || copy.saved;
        } catch (_) {
            status.textContent = copy.failure;
        } finally {
            busy = false;
            render();
            prompt.style.height = '';
        }
    };

    prompt.addEventListener('input', () => {
        prompt.style.height = 'auto';
        prompt.style.height = `${Math.min(prompt.scrollHeight, 150)}px`;
        if (state) promptSubmit.disabled = busy || !state.enabled || !prompt.value.trim();
    });

    document.getElementById('personalization-cancel').onclick = () => { editor.hidden = true; };
    document.getElementById('personalization-reload').onclick = () => {
        menu.open = false;
        if (!busy) load();
    };
    showDetails.onclick = () => {
        menu.open = false;
        details.hidden = false;
        detailsDisclosure.setAttribute('aria-expanded', 'true');
        details.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    };
    document.getElementById('personalization-hide-details').onclick = () => {
        details.hidden = true;
        editor.hidden = true;
        detailsDisclosure.setAttribute('aria-expanded', 'false');
        detailsDisclosure.focus();
    };
    clear.onclick = () => {
        menu.open = false;
        if (confirm(copy.clearConfirm)) mutate('/items', 'DELETE');
    };
    toggle.onchange = () => {
        const enabled = toggle.checked;
        if (!enabled && !confirm(copy.disable)) {
            toggle.checked = state.enabled;
            return;
        }
        mutate('', 'PATCH', { enabled });
    };

    load();
})();
