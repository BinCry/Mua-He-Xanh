const { test, expect } = require('@playwright/test');

const users = {
    tourist: 'e2e-tourist@example.test',
    admin: 'e2e-admin@example.test'
};
const password = 'AuditE2E-only-2026';
// Shop is a direct-contact catalogue backed by products; Workshops have a
// separate catalogue and session identifier after the commerce split.
const shopItemId = 'e2000000-0000-4000-8000-000000000201';

test.describe.configure({ mode: 'serial' });

async function login(page, email, admin = false) {
    await page.goto(admin ? '/admin/login' : '/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator(admin ? '#adminLoginForm' : '#unifiedLoginForm').evaluate(form => form.requestSubmit());
    await page.waitForURL(url => !url.pathname.startsWith('/auth/login') && !url.pathname.startsWith('/admin/login'));
}

test('a tourist can open the established direct-contact Shop catalogue without creating an order', async ({ page }) => {
    await login(page, users.tourist);
    await page.goto('/shops/' + shopItemId, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: /Liên hệ Zalo/i })).toBeVisible();
    await expect(page.locator('#orderButton')).toHaveCount(0);
});

test('the retired online-order endpoint is explicit and never writes an order', async ({ page }) => {
    await login(page, users.tourist);
    const response = await page.evaluate(async () => {
        const result = await fetch('/api/products/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({ productId: 'e2000000-0000-4000-8000-000000000201', quantity: 1 })
        });
        return { status: result.status, payload: await result.json() };
    });
    expect(response.status).toBe(410);
    expect(response.payload.code).toBe('SHOP_CONTACT_ONLY');
});

test('an administrator can use the public festival preview and a saved retired-order link goes to Shop management', async ({ page }) => {
    await login(page, users.admin, true);
    await page.goto('/admin/product-orders', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/shops$/);
    await page.goto('/festivals', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/festivals$/);
});
