/**
 * Bình Lợi language switcher.
 *
 * Vietnamese is the source language. English is supplied by the opt-in Google
 * Translate widget, so the selector waits for that widget instead of reloading
 * and hoping that a translation cookie is noticed after navigation.
 */
(function () {
    var TRANSLATE_TIMEOUT_MS = 25000;
    var translateReadyPromise = null;
    var resolveTranslateReady = null;
    var rejectTranslateReady = null;
    var translateElementMounted = false;
    var translateTimeoutId = null;

    function hasCookieDomain(host) {
        return Boolean(host && host !== 'localhost' && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) && host.includes('.'));
    }

    function setCookie(name, value, days) {
        var expires = '';
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = '; expires=' + date.toUTCString();
        }

        var host = window.location.hostname;
        document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Lax';
        if (hasCookieDomain(host)) {
            document.cookie = name + '=' + (value || '') + expires + '; path=/; domain=' + host + '; SameSite=Lax';
            var domainPart = '.' + host.split('.').slice(-2).join('.');
            document.cookie = name + '=' + (value || '') + expires + '; path=/; domain=' + domainPart + '; SameSite=Lax';
        }
    }

    function eraseCookie(name) {
        var host = window.location.hostname;
        var domains = [''];
        if (hasCookieDomain(host)) {
            domains.push(host, '.' + host, '.' + host.split('.').slice(-2).join('.'));
        }
        domains.forEach(function (domain) {
            document.cookie = name + '=; Path=/' + (domain ? '; Domain=' + domain : '') + '; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
        });
    }

    function setSwitchStatus(message) {
        document.querySelectorAll('[data-language-switch-status]').forEach(function (status) {
            status.textContent = message || '';
        });
    }

    function setSwitchBusy(isBusy) {
        document.querySelectorAll('.lang-switch-group').forEach(function (group) {
            group.setAttribute('aria-busy', isBusy ? 'true' : 'false');
        });
        document.querySelectorAll('.lang-btn-vn, .lang-btn-en').forEach(function (button) {
            button.disabled = Boolean(isBusy);
        });
    }

    function updateLanguageUI(lang) {
        var english = lang === 'en';
        document.querySelectorAll('.lang-btn-vn').forEach(function (button) {
            button.style.setProperty('background', english ? 'transparent' : '#922724', 'important');
            button.style.setProperty('color', english ? '#64748b' : '#ffffff', 'important');
            button.style.setProperty('font-weight', english ? '600' : '800', 'important');
            button.style.setProperty('box-shadow', english ? 'none' : '0 1px 4px rgba(146, 39, 36, 0.4)', 'important');
            button.setAttribute('aria-pressed', english ? 'false' : 'true');
        });
        document.querySelectorAll('.lang-btn-en').forEach(function (button) {
            button.style.setProperty('background', english ? '#922724' : 'transparent', 'important');
            button.style.setProperty('color', english ? '#ffffff' : '#64748b', 'important');
            button.style.setProperty('font-weight', english ? '800' : '600', 'important');
            button.style.setProperty('box-shadow', english ? '0 1px 4px rgba(146, 39, 36, 0.4)' : 'none', 'important');
            button.setAttribute('aria-pressed', english ? 'true' : 'false');
        });
    }

    function getTranslateCombo() {
        return document.querySelector('.goog-te-combo');
    }

    function completeTranslateReady() {
        var combo = getTranslateCombo();
        if (!combo || !resolveTranslateReady) return false;
        window.clearTimeout(translateTimeoutId);
        translateTimeoutId = null;
        resolveTranslateReady(combo);
        resolveTranslateReady = null;
        rejectTranslateReady = null;
        return true;
    }

    function mountTranslateElement() {
        if (!window.google || !window.google.translate || !window.google.translate.TranslateElement) return false;
        if (!translateElementMounted) {
            new window.google.translate.TranslateElement({
                pageLanguage: 'vi',
                includedLanguages: 'en,vi',
                autoDisplay: false
            }, 'google_translate_element');
            translateElementMounted = true;
        }
        return completeTranslateReady();
    }

    function ensureGoogleTranslate() {
        var existingCombo = getTranslateCombo();
        if (existingCombo) return Promise.resolve(existingCombo);
        if (translateReadyPromise) return translateReadyPromise;

        translateReadyPromise = new Promise(function (resolve, reject) {
            resolveTranslateReady = resolve;
            rejectTranslateReady = reject;
            translateTimeoutId = window.setTimeout(function () {
                if (!rejectTranslateReady) return;
                rejectTranslateReady(new Error('Translation service did not become ready in time.'));
                resolveTranslateReady = null;
                rejectTranslateReady = null;
                translateReadyPromise = null;
            }, TRANSLATE_TIMEOUT_MS);

            if (mountTranslateElement()) return;
            var script = document.getElementById('google-translate-element-script');
            if (!script) {
                script = document.createElement('script');
                script.id = 'google-translate-element-script';
                script.async = true;
                script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
                script.onerror = function () {
                    if (!rejectTranslateReady) return;
                    window.clearTimeout(translateTimeoutId);
                    rejectTranslateReady(new Error('Translation service could not be loaded.'));
                    resolveTranslateReady = null;
                    rejectTranslateReady = null;
                    translateReadyPromise = null;
                };
                document.head.appendChild(script);
            }
        });
        return translateReadyPromise;
    }

    function chooseGoogleLanguage(language) {
        return ensureGoogleTranslate().then(function (combo) {
            if (combo.value !== language) {
                combo.value = language;
                combo.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return combo;
        });
    }

    function switchToEnglish() {
        setSwitchBusy(true);
        setSwitchStatus('Đang chuyển sang English…');
        setCookie('googtrans', '/vi/en', 30);
        chooseGoogleLanguage('en').then(function () {
            localStorage.setItem('app_lang', 'en');
            updateLanguageUI('en');
            setSwitchStatus('');
        }).catch(function () {
            // Never leave the selector claiming English when the external
            // provider is unavailable. A later click starts a clean retry.
            eraseCookie('googtrans');
            localStorage.setItem('app_lang', 'vi');
            updateLanguageUI('vi');
            setSwitchStatus('Không thể tải bản dịch English. Vui lòng thử lại.');
        }).finally(function () {
            setSwitchBusy(false);
        });
    }

    function switchToVietnamese() {
        eraseCookie('googtrans');
        localStorage.setItem('app_lang', 'vi');
        updateLanguageUI('vi');
        setSwitchStatus('');
        // Google Translate mutates the original DOM. Reloading is the only
        // reliable way to restore the Vietnamese source document.
        window.location.reload();
    }

    window.setAppLanguage = function (targetLang) {
        if (targetLang !== 'vi' && targetLang !== 'en') return;
        var currentLang = localStorage.getItem('app_lang') || 'vi';
        if (targetLang === 'vi' && currentLang === 'vi') return;
        if (targetLang === 'en') {
            // Retry if an earlier English attempt failed, rather than treating
            // a persisted visual state as proof that translation succeeded.
            switchToEnglish();
            return;
        }
        switchToVietnamese();
    };

    window.toggleLanguage = function () {
        var current = localStorage.getItem('app_lang') || 'vi';
        window.setAppLanguage(current === 'vi' ? 'en' : 'vi');
    };

    window.googleTranslateElementInit = function () {
        try {
            mountTranslateElement();
        } catch (error) {
            if (rejectTranslateReady) rejectTranslateReady(error);
            resolveTranslateReady = null;
            rejectTranslateReady = null;
            translateReadyPromise = null;
        }
    };

    function initializePersistedLanguage() {
        var language = localStorage.getItem('app_lang') || 'vi';
        if (language === 'en') {
            setCookie('googtrans', '/vi/en', 30);
            chooseGoogleLanguage('en').then(function () {
                updateLanguageUI('en');
                setSwitchStatus('');
            }).catch(function () {
                eraseCookie('googtrans');
                localStorage.setItem('app_lang', 'vi');
                updateLanguageUI('vi');
                setSwitchStatus('Không thể tải bản dịch English. Vui lòng thử lại.');
            });
        } else {
            eraseCookie('googtrans');
            updateLanguageUI('vi');
        }
    }

    function removeTranslateBanners() {
        document.querySelectorAll('iframe.goog-te-banner-frame, .VIpgJd-ZVi9od-ORHb-OEVmcd').forEach(function (frame) {
            frame.style.setProperty('display', 'none', 'important');
            frame.style.setProperty('visibility', 'hidden', 'important');
            frame.style.setProperty('height', '0px', 'important');
        });
        if (document.body && document.body.style.top && document.body.style.top !== '0px') {
            document.body.style.setProperty('top', '0px', 'important');
        }
    }

    if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(removeTranslateBanners);
        if (document.body) observer.observe(document.body, { attributes: true, childList: true, subtree: true });
        else document.addEventListener('DOMContentLoaded', function () {
            if (document.body) observer.observe(document.body, { attributes: true, childList: true, subtree: true });
        });
    }

    initializePersistedLanguage();
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) initializePersistedLanguage();
    });
})();
