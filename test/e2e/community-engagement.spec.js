const { test, expect } = require('@playwright/test');

const reviewId = 'e2000000-0000-4000-8000-000000000401';
const password = 'AuditE2E-only-2026';
const accountByProject = {
    chromium: 'e2e-tourist@example.test',
    firefox: 'e2e-journey@example.test',
    webkit: 'e2e-community@example.test'
};

async function login(page, email) {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('#unifiedLoginForm').evaluate(form => form.requestSubmit());
    await page.waitForURL(url => !url.pathname.startsWith('/auth/login'));
}

test('guest reaction is refused and the Community UI asks the visitor to sign in', async ({ page }) => {
    await page.goto('/reviews', { waitUntil: 'networkidle' });
    const api = await page.evaluate(async (id) => {
        const response = await fetch('/api/reviews/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ review_id: id })
        });
        return { status: response.status, body: await response.json() };
    }, reviewId);
    expect(api.status).toBe(401);
    expect(api.body.success).toBe(false);

    await page.locator(`[data-review-id="${reviewId}"] button[aria-label]`).click();
    await expect(page.locator('#appConfirmModal')).toBeVisible();
    await expect(page.locator('#appConfirmTitle')).toHaveText(/Đăng nhập/i);
});

test('a committed reaction updates Community and Home counters without a reload', async ({ page, context }, testInfo) => {
    const email = accountByProject[testInfo.project.name];
    await login(page, email);
    await page.goto('/reviews', { waitUntil: 'networkidle' });
    const card = page.locator(`[data-review-id="${reviewId}"]`);
    const like = card.locator('button[aria-label]');
    await expect(like).toHaveAttribute('aria-pressed', 'false');

    const home = await context.newPage();
    await home.goto('/', { waitUntil: 'networkidle' });
    const homeCard = home.locator(`[data-review-id="${reviewId}"]`);
    await expect(homeCard).toBeVisible();
    await expect.poll(() => home.evaluate(() => window.BinhLoiCommunityEngagement?.isLive())).toBe(true);
    const before = Number(await homeCard.locator('[data-engagement-count="likes"]').textContent());

    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('[data-engagement-count="likes"]')).toHaveText(String(before + 1));
    await expect(homeCard.locator('[data-engagement-count="likes"]')).toHaveText(String(before + 1));
    await home.close();
});
