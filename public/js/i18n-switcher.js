/**
 * BINH LOI - Explicit Dual-Button Language Switcher Engine (VN / EN)
 * Completely eliminates layout shifts, jumping, and redundant reloads.
 */
(function () {
    function hasCookieDomain(host) {
        // Browsers reject Domain attributes for localhost and numeric IP hosts.
        // A host-only cookie is sufficient there and avoids console errors.
        return Boolean(host && host !== 'localhost' && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) && host.includes('.'));
    }

    function setCookie(name, value, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        var host = window.location.hostname;
        document.cookie = name + "=" + (value || "") + expires + "; path=/;";
        if (hasCookieDomain(host)) {
            document.cookie = name + "=" + (value || "") + expires + "; path=/; domain=" + host;
            var domainPart = '.' + host.split('.').slice(-2).join('.');
            document.cookie = name + "=" + (value || "") + expires + "; path=/; domain=" + domainPart;
        }
    }

    function eraseCookie(name) {
        var host = window.location.hostname;
        var domains = [''];
        if (hasCookieDomain(host)) {
            domains.push(host, '.' + host);
            domains.push('.' + host.split('.').slice(-2).join('.'));
        }
        var paths = ['/', '/auth', '/journey', '/onboarding', '/explore', '/admin', '/manager', '/profile', '/shops', '/reviews'];
        
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
                b.style.setProperty('background', 'transparent', 'important');
                b.style.setProperty('color', '#64748b', 'important');
                b.style.setProperty('font-weight', '600', 'important');
                b.style.setProperty('box-shadow', 'none', 'important');
            });
            enButtons.forEach(function(b) {
                b.style.setProperty('background', '#922724', 'important');
                b.style.setProperty('color', '#ffffff', 'important');
                b.style.setProperty('font-weight', '800', 'important');
                b.style.setProperty('box-shadow', '0 1px 4px rgba(146, 39, 36, 0.4)', 'important');
            });
        } else {
            vnButtons.forEach(function(b) {
                b.style.setProperty('background', '#922724', 'important');
                b.style.setProperty('color', '#ffffff', 'important');
                b.style.setProperty('font-weight', '800', 'important');
                b.style.setProperty('box-shadow', '0 1px 4px rgba(146, 39, 36, 0.4)', 'important');
            });
            enButtons.forEach(function(b) {
                b.style.setProperty('background', 'transparent', 'important');
                b.style.setProperty('color', '#64748b', 'important');
                b.style.setProperty('font-weight', '600', 'important');
                b.style.setProperty('box-shadow', 'none', 'important');
            });
        }
    }

    window.setAppLanguage = function (targetLang) {
        var currentLang = localStorage.getItem('app_lang') || 'vi';
        
        // If clicking the currently active language, do nothing!
        if (targetLang === currentLang) {
            return;
        }

        localStorage.setItem('app_lang', targetLang);
        updateLanguageUI(targetLang);

        if (targetLang === 'en') {
            setCookie('googtrans', '/vi/en', 30);
            var combo = document.querySelector('.goog-te-combo');
            if (combo) {
                combo.value = 'en';
                combo.dispatchEvent(new Event('change'));
                return;
            }
        } else {
            eraseCookie('googtrans');
            document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            var combo = document.querySelector('.goog-te-combo');
            if (combo) {
                window.location.reload();
                return;
            }
        }

        window.location.reload();
    };

    window.toggleLanguage = function() {
        var current = localStorage.getItem('app_lang') || 'vi';
        window.setAppLanguage(current === 'vi' ? 'en' : 'vi');
    };

    window.googleTranslateElementInit = function () {
        if (window.google && window.google.translate) {
            new window.google.translate.TranslateElement({
                pageLanguage: 'vi',
                includedLanguages: 'en,vi',
                autoDisplay: false
            }, 'google_translate_element');
        }
    };

    // Machine translation is optional. Loading it on every Vietnamese page made
    // the primary journey depend on an external script and caused avoidable 429
    // errors. Load it only after the visitor has explicitly selected English.
    function loadGoogleTranslateForEnglish() {
        if (document.getElementById('google-translate-element-script') ||
            (window.google && window.google.translate)) {
            return;
        }
        var script = document.createElement('script');
        script.id = 'google-translate-element-script';
        script.async = true;
        script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        document.head.appendChild(script);
    }

    function init() {
        var lang = localStorage.getItem('app_lang') || 'vi';
        
        if (lang === 'en') {
            if (getCookie('googtrans') !== '/vi/en') {
                setCookie('googtrans', '/vi/en', 30);
            }
            loadGoogleTranslateForEnglish();
        } else {
            eraseCookie('googtrans');
        }

        updateLanguageUI(lang);
    }

    // Passive MutationObserver + Interval to completely prevent Google Translate banner
    function removeTranslateBanners() {
        var iframes = document.querySelectorAll('iframe.goog-te-banner-frame, .VIpgJd-ZVi9od-ORHb-OEVmcd, .skiptranslate');
        iframes.forEach(function(el) {
            if (el.tagName === 'IFRAME' || el.classList.contains('VIpgJd-ZVi9od-ORHb-OEVmcd')) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('height', '0px', 'important');
            }
        });
        if (document.body && document.body.style.top && document.body.style.top !== '0px') {
            document.body.style.setProperty('top', '0px', 'important');
        }
    }

    if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(removeTranslateBanners);
        if (document.body) {
            observer.observe(document.body, { attributes: true, childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                if (document.body) observer.observe(document.body, { attributes: true, childList: true, subtree: true });
            });
        }
    } else {
        setInterval(removeTranslateBanners, 200);
    }

    init();
    document.addEventListener('DOMContentLoaded', init);
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) init();
    });
})();
