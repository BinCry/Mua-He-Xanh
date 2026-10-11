const { test, expect } = require('@playwright/test');

const email = 'e2e-journey@example.test';
const password = 'AuditE2E-only-2026';

async function login(page) {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('#unifiedLoginForm').evaluate(form => form.requestSubmit());
    await page.waitForURL(url => !url.pathname.startsWith('/auth/login'));
}

test('changing journey mood visibly clears Sống Chậm before selecting a different criterion', async ({ page }) => {
    await login(page);
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
    const chill = page.locator('[data-mood="chill"]');
    const culture = page.locator('[data-mood="culture"]');
    await chill.click();
    await expect(chill).toHaveClass(/selected/);
    await chill.click();
    await expect(chill).not.toHaveClass(/selected/);
    await culture.click();
    await expect(culture).toHaveClass(/selected/);
    await expect(chill).not.toHaveClass(/selected/);
});

