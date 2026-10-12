const { test, expect } = require('@playwright/test');

const users = {
    tourist: 'e2e-tourist@example.test',
    admin: 'e2e-admin@example.test',
    managerOne: 'e2e-manager-one@example.test'
};
const password = 'AuditE2E-only-2026';
// Shop is a direct-contact catalogue backed by products; Workshops have a
// separate catalogue and session identifier after the commerce split.
const shopItemId = 'e2000000-0000-4000-8000-000000000201';

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

test('Workshop management UI scopes a manager to the assigned destination', async ({ page }) => {
    const otherDestinationId = 'e2000000-0000-4000-8000-000000000002';

    await login(page, users.managerOne);
    // A manager-supplied destination query must not widen the server-side
    // scope. The fixture has a Workshop only at destination 1.
    await page.goto(`/manager/workshops?destination=${otherDestinationId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Workshop E2E', exact: true })).toBeVisible();
    await expect(page.getByRole('article').getByText('Dia diem E2E 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Dia diem E2E 2', { exact: true })).toHaveCount(0);
    await expect(page.locator('select#destination')).toHaveCount(0);
});

test('Workshop management UI lets an administrator choose each destination', async ({ page }) => {
    const destinationOneId = 'e2000000-0000-4000-8000-000000000001';
    const destinationTwoId = 'e2000000-0000-4000-8000-000000000002';

    await login(page, users.admin, true);
    // An administrator is allowed to manage every active destination, but the
    // active filter must be explicit: a catalogue item at destination one is
    // not expected to appear while destination two is selected.
    await page.goto(`/admin/workshops?destination=${destinationOneId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Workshop E2E', exact: true })).toBeVisible();
    await expect(page.locator('select#destination')).toContainText('Dia diem E2E 1');
    await expect(page.locator('select#destination')).toContainText('Dia diem E2E 2');

    await page.selectOption('select#destination', destinationTwoId);
    await page.waitForURL(new RegExp(`destination=${destinationTwoId}`));
    await expect(page.locator('select#destination')).toHaveValue(destinationTwoId);
    await expect(page.getByRole('heading', { name: 'Workshop E2E', exact: true })).toHaveCount(0);
});
