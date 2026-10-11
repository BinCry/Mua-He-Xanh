const { test, expect } = require('@playwright/test');

const users = {
    tourist: 'e2e-tourist@example.test',
    managerOne: 'e2e-manager-one@example.test',
    managerTwo: 'e2e-manager-two@example.test',
    admin: 'e2e-admin@example.test'
};
const password = 'AuditE2E-only-2026';
const productId = 'e2000000-0000-4000-8000-000000000201';
let orderId;

test.describe.configure({ mode: 'serial' });

async function login(page, email, admin = false) {
    await page.goto(admin ? '/admin/login' : '/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator(admin ? '#adminLoginForm' : '#unifiedLoginForm').evaluate(form => form.requestSubmit());
    await page.waitForURL(url => !url.pathname.startsWith('/auth/login') && !url.pathname.startsWith('/admin/login'));
}

test('a tourist can log in and create an order through the product UI', async ({ page }) => {
    await login(page, users.tourist);
    await page.goto('/shops/' + productId, { waitUntil: 'domcontentloaded' });
    const responsePromise = page.waitForResponse(response =>
        response.url().endsWith('/api/products/orders') && response.request().method() === 'POST'
    );
    await page.locator('#orderButton').click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.order.status).toBe('pending');
    orderId = payload.order.id;
    await expect(page.locator('#orderFeedback')).toContainText(/Đơn hàng đã được ghi nhận/);
});

test('a tourist cannot access the administrator order screen', async ({ page }) => {
    await login(page, users.tourist);
    const response = await page.goto('/admin/product-orders', { waitUntil: 'domcontentloaded' });
    expect(response.status()).toBe(403);
    await expect(page.getByRole('heading', { name: /Truy cập bị chặn/ })).toBeVisible();
});

test('a manager cannot transition an order outside the assigned destination', async ({ page }) => {
    expect(orderId).toBeTruthy();
    await login(page, users.managerTwo);
    const response = await page.evaluate(async id => {
        const result = await fetch('/api/products/orders/' + encodeURIComponent(id) + '/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'e2e-wrong-manager-' + crypto.randomUUID() },
            body: JSON.stringify({ status: 'confirmed' })
        });
        return { status: result.status, payload: await result.json() };
    }, orderId);
    expect(response.status).toBe(403);
    expect(response.payload.code).toBe('COMMERCE_RECORD_FORBIDDEN');
});

test('the assigned manager can confirm the order', async ({ page }) => {
    expect(orderId).toBeTruthy();
    await login(page, users.managerOne);
    const response = await page.evaluate(async id => {
        const result = await fetch('/api/products/orders/' + encodeURIComponent(id) + '/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'e2e-own-manager-' + crypto.randomUUID() },
            body: JSON.stringify({ status: 'confirmed' })
        });
        return { status: result.status, payload: await result.json() };
    }, orderId);
    expect(response.status).toBe(200);
    expect(response.payload.status).toBe('confirmed');
});

test('an administrator completes the confirmed order from the operations UI', async ({ page }) => {
    expect(orderId).toBeTruthy();
    await login(page, users.admin, true);
    await page.goto('/admin/product-orders', { waitUntil: 'domcontentloaded' });
    const complete = page.locator('[data-order-id="' + orderId + '"][data-status="completed"]');
    await expect(complete).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await complete.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('tr[data-order-id="' + orderId + '"]')).toContainText('completed');
});

