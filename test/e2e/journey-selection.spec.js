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

test('journey opens the tour catalogue and each tour exposes a detail page', async ({ page }) => {
    await login(page);
    await page.goto('/journey', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/journey\/tours/);
    const firstTour = page.locator('.tour-card').first();
    await expect(firstTour).toBeVisible();
    await firstTour.click();
    await expect(page).toHaveURL(/\/journey\/tours\//);
    await expect(page.locator('h2', { hasText: 'Nội dung hành trình' })).toBeVisible();
});
