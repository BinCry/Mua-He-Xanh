const { test, expect } = require('@playwright/test');

const GOOGLE_TRANSLATE_WIDGET_STUB = `
    window.google = {
        translate: {
            TranslateElement: function (_options, targetId) {
                const select = document.createElement('select');
                select.className = 'goog-te-combo';
                select.innerHTML = '<option value="vi">Vietnamese</option><option value="en">English</option>';
                select.addEventListener('change', function () {
                    // Simulate the layout-affecting behavior of the real
                    // widget. The application must neutralize it without
                    // scanning every translated text-node mutation.
                    document.body.style.top = '40px';
                    document.documentElement.scrollTop = 0;
                    const banner = document.createElement('iframe');
                    banner.className = 'goog-te-banner-frame';
                    document.body.appendChild(banner);
                });
                document.getElementById(targetId).appendChild(select);
            }
        }
    };
    window.googleTranslateElementInit();
`;

test('VN/EN selector waits for the translation widget and restores Vietnamese safely', async ({ page }) => {
    await page.route('https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit', route => route.fulfill({
        contentType: 'application/javascript',
        body: GOOGLE_TRANSLATE_WIDGET_STUB
    }));

    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    const vietnamese = page.locator('.lang-btn-vn').first();
    const english = page.locator('.lang-btn-en').first();

    await expect(vietnamese).toHaveAttribute('aria-pressed', 'true');
    const viewportBeforeSwitch = await page.evaluate(() => {
        window.scrollTo(0, 180);
        return window.scrollY;
    });
    await english.click();

    await expect.poll(() => page.evaluate(() => localStorage.getItem('app_lang'))).toBe('en');
    await expect(page.locator('.goog-te-combo')).toHaveValue('en');
    await expect(english).toHaveAttribute('aria-pressed', 'true');
    await expect(vietnamese).toHaveAttribute('aria-pressed', 'false');
    await expect(english).toBeEnabled();
    await expect.poll(() => page.evaluate(() => document.body.style.top)).toBe('0px');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(viewportBeforeSwitch);
    await expect(page.locator('html')).not.toHaveClass(/language-switching/);

    await vietnamese.click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('app_lang'))).toBe('vi');
    await expect(vietnamese).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-language-switch-status]')).toHaveText('');
    await expect.poll(() => page.evaluate(() => document.cookie.includes('googtrans='))).toBe(false);
});
