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
    var languageSwitchInProgress = false;
    var LANGUAGE_SCROLL_RESTORE_KEY = 'language_scroll_restore';

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

    function getViewportPosition() {
        return {
            x: window.scrollX || window.pageXOffset || 0,
            y: window.scrollY || window.pageYOffset || 0
        };
    }

    // Google Translate briefly writes a top offset to <body> while it mounts
    // its toolbar. Keep that chrome out of the layout before translation is
    // requested rather than correcting the resulting layout shift later.
    function keepTranslateChromeOutOfLayout() {
        if (!document.body) return;
        if (document.body.style.getPropertyValue('top') !== '0px' || document.body.style.getPropertyPriority('top') !== 'important') {
            document.body.style.setProperty('top', '0px', 'important');
        }
        if (document.body.style.getPropertyValue('margin-top') !== '0px' || document.body.style.getPropertyPriority('margin-top') !== 'important') {
            document.body.style.setProperty('margin-top', '0px', 'important');
        }
    }

    function beginLanguageLayoutTransition() {
        document.documentElement.classList.add('language-switching');
        keepTranslateChromeOutOfLayout();
        return getViewportPosition();
    }

    function settleLanguageLayout(viewport) {
        return new Promise(function (resolve) {
            // The widget changes text and body styles asynchronously after its
            // select change event. Settling across two frames preserves the
            // current reading position without animating a layout correction.
            window.setTimeout(function () {
                window.requestAnimationFrame(function () {
                    window.requestAnimationFrame(function () {
                        keepTranslateChromeOutOfLayout();
                        window.scrollTo(viewport.x, viewport.y);
                        document.documentElement.classList.remove('language-switching');
                        resolve();
                    });
                });
            }, 150);
        });
    }

    function persistViewportForReload() {
        try {
            sessionStorage.setItem(LANGUAGE_SCROLL_RESTORE_KEY, JSON.stringify(getViewportPosition()));
        } catch (error) {
            // Storage can be disabled. Native browser scroll restoration is a
            // safe fallback, so a storage failure must not block language use.
        }
    }

    function restoreViewportAfterReload() {
        var serialized;
        try {
            serialized = sessionStorage.getItem(LANGUAGE_SCROLL_RESTORE_KEY);
            sessionStorage.removeItem(LANGUAGE_SCROLL_RESTORE_KEY);
        } catch (error) {
            return;
        }
        if (!serialized) return;

        try {
            var viewport = JSON.parse(serialized);
            if (!Number.isFinite(viewport.x) || !Number.isFinite(viewport.y)) return;
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () {
                    window.scrollTo(viewport.x, viewport.y);
                });
            });
        } catch (error) {
            // Ignore malformed stale storage rather than impacting navigation.
        }
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
        if (languageSwitchInProgress) return;
        languageSwitchInProgress = true;
        var viewport = beginLanguageLayoutTransition();
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
        }).then(function () {
            return settleLanguageLayout(viewport);
        }).finally(function () {
            languageSwitchInProgress = false;
            setSwitchBusy(false);
        });
    }

    function switchToVietnamese() {
        if (languageSwitchInProgress) return;
        languageSwitchInProgress = true;
        keepTranslateChromeOutOfLayout();
        persistViewportForReload();
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
        if (targetLang === 'en' && currentLang === 'en') return;
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
            var viewport = beginLanguageLayoutTransition();
            setCookie('googtrans', '/vi/en', 30);
            chooseGoogleLanguage('en').then(function () {
                updateLanguageUI('en');
                setSwitchStatus('');
            }).catch(function () {
                eraseCookie('googtrans');
                localStorage.setItem('app_lang', 'vi');
                updateLanguageUI('vi');
                setSwitchStatus('Không thể tải bản dịch English. Vui lòng thử lại.');
            }).then(function () {
                return settleLanguageLayout(viewport);
            });
        } else {
            eraseCookie('googtrans');
            updateLanguageUI('vi');
        }
    }

    // Do not observe the whole document: Google Translate mutates many text
    // nodes, and a subtree observer turns a language change into needless
    // repeated DOM scans. CSS already hides all toolbar nodes; only guard the
    // inline body style that could move the page.
    if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(keepTranslateChromeOutOfLayout);
        if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
        else document.addEventListener('DOMContentLoaded', function () {
            if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
        });
    }

    restoreViewportAfterReload();
    initializePersistedLanguage();
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) initializePersistedLanguage();
    });
})();
