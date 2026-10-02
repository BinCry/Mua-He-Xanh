const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

for (const route of ['/', '/explore', '/map', '/reviews', '/auth/login']) {
    test(`no critical or serious accessibility violations on ${route}`, async ({ page }) => {
        await page.goto(route, { waitUntil: 'networkidle' });
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();
        const blocking = results.violations.filter(item => ['critical', 'serious'].includes(item.impact));
        expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
}
