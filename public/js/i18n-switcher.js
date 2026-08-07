/**
 * BINH LOI HEALING - Explicit Dual-Button Language Switcher Engine (VN / EN)
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
            var host = window.location.hostname;
            document.cookie = name + "=" + (value || "") + expires + "; path=/; domain=" + host;
            if (host.includes('.')) {
                var domainPart = '.' + host.split('.').slice(-2).join('.');
                document.cookie = name + "=" + (value || "") + expires + "; path=/; domain=" + domainPart;
            }
        } catch (e) {}
    }

    function eraseCookie(name) {
        var host = window.location.hostname;
        var domains = ['', host, '.' + host];
        if (host.includes('.')) {
            domains.push('.' + host.split('.').slice(-2).join('.'));
        }
        var paths = ['/', '/auth', '/journey', '/onboarding', '/explore', '/admin', '/manager', '/profile'];
        
        domains.forEach(function(d) {
            paths.forEach(function(p) {
                document.cookie = name + '=; Path=' + p + (d ? '; Domain=' + d : '') + '; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            });
        });
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

    function updateLanguageUI(lang) {
        var vnButtons = document.querySelectorAll('.lang-btn-vn');
        var enButtons = document.querySelectorAll('.lang-btn-en');

        if (lang === 'en') {
            vnButtons.forEach(function(b) {
                b.style.background = 'transparent';
                b.style.color = '#64748b';
                b.style.fontWeight = '600';
            });
            enButtons.forEach(function(b) {
                b.style.background = '#922724';
                b.style.color = '#ffffff';
                b.style.fontWeight = '900';
                b.style.boxShadow = '0 2px 6px rgba(146, 39, 36, 0.4)';
            });
        } else {
            vnButtons.forEach(function(b) {
                b.style.background = '#922724';
                b.style.color = '#ffffff';
                b.style.fontWeight = '900';
                b.style.boxShadow = '0 2px 6px rgba(146, 39, 36, 0.4)';
            });
            enButtons.forEach(function(b) {
                b.style.background = 'transparent';
                b.style.color = '#64748b';
                b.style.fontWeight = '600';
            });
        }
    }

    window.setAppLanguage = function (targetLang) {
        var current = localStorage.getItem('app_lang') || 'vi';
        if (current === targetLang && getCookie('googtrans') === (targetLang === 'en' ? '/vi/en' : null)) {
            return;
        }

        localStorage.setItem('app_lang', targetLang);

        if (targetLang === 'en') {
            setCookie('googtrans', '/vi/en', 30);
        } else {
            eraseCookie('googtrans');
            eraseCookie('googtrans');
            setCookie('googtrans', '/vi/vi', -1);
        }

        updateLanguageUI(targetLang);
        location.reload();
    };

    window.toggleLanguage = function() {
        var current = localStorage.getItem('app_lang') || 'vi';
        window.setAppLanguage(current === 'vi' ? 'en' : 'vi');
    };

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

    window.googleTranslateElementInit = function () {
        var currentLang = localStorage.getItem('app_lang') || 'vi';
        if (currentLang === 'en' && window.google && window.google.translate) {
            new window.google.translate.TranslateElement({
                pageLanguage: 'vi',
                includedLanguages: 'en,vi',
                autoDisplay: false
            }, 'google_translate_element');
        }
    };

    function init() {
        var lang = localStorage.getItem('app_lang') || 'vi';
        
        if (lang === 'en') {
            if (getCookie('googtrans') !== '/vi/en') {
                setCookie('googtrans', '/vi/en', 30);
            }
        } else {
            eraseCookie('googtrans');
        }

        updateLanguageUI(lang);
        suppressGoogleTranslateBar();
        setInterval(suppressGoogleTranslateBar, 100);
        window.addEventListener('scroll', suppressGoogleTranslateBar, { passive: true });
        window.addEventListener('resize', suppressGoogleTranslateBar, { passive: true });
    }

    init();
    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) init();
    });
})();
