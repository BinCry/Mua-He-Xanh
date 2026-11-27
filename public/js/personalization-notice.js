(() => {
    'use strict';
    const script = document.querySelector('script[src="/js/personalization-notice.js"]');
    if (!script?.dataset.userId) return;
    const storageKey = `personalization-notice-v1:${script.dataset.userId}`;
    let shown = false;
    window.showPersonalizationNotice = async containerId => {
        if (shown) return;
        try { if (localStorage.getItem(storageKey)) return; } catch (_) {}
        const messages = document.getElementById(containerId);
        if (!messages) return;
        shown = true;
        try {
            const response = await fetch('/api/me/personalization', { credentials: 'same-origin' });
            const body = await response.json();
            if (!response.ok || !body.success || !body.data.enabled) { shown = false; return; }
        } catch (_) { shown = false; return; }
        let english = document.documentElement.lang === 'en';
        try { english = localStorage.getItem('app_lang') === 'en'; } catch (_) {}
        const banner = document.createElement('aside');
        banner.className = 'small p-3 bg-light border-bottom';
        banner.setAttribute('role', 'status');
        banner.append(document.createTextNode(english
            ? 'Personalization is on. Your assistant can remember travel preferences. '
            : 'Cá nhân hóa đang bật. Trợ lý có thể ghi nhớ sở thích du lịch của bạn. '));
        const manage = document.createElement('a');
        manage.href = '/personalization';
        manage.textContent = english ? 'Manage personalization' : 'Quản lý cá nhân hóa';
        const dismiss = document.createElement('button');
        dismiss.type = 'button'; dismiss.className = 'btn btn-sm btn-link';
        dismiss.textContent = english ? 'Dismiss' : 'Đã hiểu';
        dismiss.onclick = () => {
            try { localStorage.setItem(storageKey, '1'); } catch (_) {}
            banner.remove();
        };
        banner.append(manage, dismiss);
        messages.before(banner);
    };
})();
