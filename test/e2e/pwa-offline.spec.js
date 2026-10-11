const { test, expect } = require('@playwright/test');

// The main project blocks service workers to avoid state leaking between E2E
// cases. This isolated suite intentionally enables one so offline behavior is
// exercised separately from the ordinary UI suite.
test.use({ serviceWorkers: 'allow' });

test('the PWA serves an explicit recovery screen offline and the app health endpoint recovers online', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Service-worker acceptance is run once in Chromium.');

    await page.goto('/', { waitUntil: 'networkidle' });
    await expect.poll(() => page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        return Boolean(registration && registration.active);
    })).toBe(true);

    await context.setOffline(true);
    const offlineResponse = await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    expect(offlineResponse?.status()).toBe(503);
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('button.retry')).toBeVisible();

    await context.setOffline(false);
    const healthResponse = await page.request.get('/api/health');
    expect(healthResponse.status()).toBe(200);
    await expect.poll(() => healthResponse.json().then(body => body.status)).toBe('ok');
});
