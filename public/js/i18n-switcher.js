/**
 * BINH LOI HEALING - Full-Site Automatic Translation Engine (Google Translate Engine Bridge)
 * Translates 100% of all page content, HTML tags, dynamic cards, modals & admin panels automatically.
 * Strictly preserves comments in original language and suppresses Google Translate top bar.
 */
(function () {
    function setCookie(name, value, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
        try {
            document.cookie = name + "=" + (value || "") + expires + "; path=/; domain=" + window.location.hostname;
        } catch (e) {}
    }

    function eraseCookie(name) {
        document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        try {
            document.cookie = name + '=; Path=/; Domain=' + window.location.hostname + '; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        } catch(e) {}
    }

    function getCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    function updateToggleButtons(lang) {
        var buttons = document.querySelectorAll('.lang-toggle-btn, #langToggleBtn, #langToggleBtnDesktop, #adminLangToggleBtn');
        buttons.forEach(function (btn) {
            btn.textContent = lang === 'en' ? 'VI' : 'EN';
            btn.setAttribute('title', lang === 'en' ? 'Chuyển sang Tiếng Việt' : 'Switch to English');
        });
    }

    // Continuously suppress Google Translate top bar & frame shifts
    function suppressGoogleTranslateBar() {
        if (document.body) {
            document.body.style.setProperty('top', '0px', 'important');
            document.body.style.setProperty('margin-top', '0px', 'important');
            document.body.style.setProperty('position', 'static', 'important');
            document.body.style.setProperty('transform', 'none', 'important');
            document.body.style.setProperty('-webkit-transform', 'none', 'important');
        }
        if (document.documentElement) {
            document.documentElement.style.setProperty('top', '0px', 'important');
            document.documentElement.style.setProperty('margin-top', '0px', 'important');
            document.documentElement.style.setProperty('transform', 'none', 'important');
            document.documentElement.style.setProperty('-webkit-transform', 'none', 'important');
        }
        var nav = document.querySelector('.navbar-premium');
        if (nav) {
            nav.style.setProperty('top', '0px', 'important');
            nav.style.setProperty('margin-top', '0px', 'important');
            nav.style.setProperty('transform', 'none', 'important');
            nav.style.setProperty('-webkit-transform', 'none', 'important');
        }
        var frames = document.querySelectorAll('.goog-te-banner-frame, iframe.goog-te-banner-frame, iframe.skiptranslate, .goog-te-balloon-frame, .VIpgJd-yDnbAf-xl0vld-ODZ2Z, .VIpgJd-yDnbAf-bN924e');
        frames.forEach(function (f) {
            f.style.setProperty('display', 'none', 'important');
            f.style.setProperty('visibility', 'hidden', 'important');
            f.style.setProperty('height', '0px', 'important');
            f.style.setProperty('width', '0px', 'important');
            f.style.setProperty('opacity', '0', 'important');
            f.style.setProperty('pointer-events', 'none', 'important');
        });
    }

    // Official Google Translate Element Init Callback
    window.googleTranslateElementInit = function () {
        if (window.google && window.google.translate) {
            new window.google.translate.TranslateElement({
                pageLanguage: 'vi',
                includedLanguages: 'en,vi',
                autoDisplay: false
            }, 'google_translate_element');
        }
    };

    window.toggleLanguage = function () {
        var current = localStorage.getItem('app_lang') || 'vi';
        var next = current === 'vi' ? 'en' : 'vi';

        localStorage.setItem('app_lang', next);

        if (next === 'en') {
            setCookie('googtrans', '/vi/en', 30);
        } else {
            eraseCookie('googtrans');
            setCookie('googtrans', '/vi/vi', 30);
        }

        updateToggleButtons(next);

        // Instant reload to apply native full-page auto translation engine
        location.reload();
    };

    function init() {
        var lang = localStorage.getItem('app_lang') || 'vi';
        
        if (lang === 'en') {
            if (getCookie('googtrans') !== '/vi/en') {
                setCookie('googtrans', '/vi/en', 30);
            }
        } else {
            if (getCookie('googtrans') === '/vi/en') {
                eraseCookie('googtrans');
                setCookie('googtrans', '/vi/vi', 30);
            }
        }

        updateToggleButtons(lang);
        suppressGoogleTranslateBar();
        setInterval(suppressGoogleTranslateBar, 100);
        window.addEventListener('scroll', suppressGoogleTranslateBar, { passive: true });
        window.addEventListener('resize', suppressGoogleTranslateBar, { passive: true });

        try {
            var observer = new MutationObserver(function () {
                suppressGoogleTranslateBar();
            });
            if (document.body) {
                observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
            }
            if (document.documentElement) {
                observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
            }
        } catch(e) {}
    }

    init();
    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) init();
    });
})();
