const { test, expect } = require('@playwright/test');

const viewports = [
    { name: 'mobile-320', width: 320, height: 568 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'mobile-412', width: 412, height: 915 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'laptop', width: 1366, height: 768 },
    { name: 'desktop', width: 1440, height: 900 }
];
const publicRoutes = ['/', '/explore', '/map', '/reviews', '/auth/login'];

for (const viewport of viewports) {
    test(`public pages fit ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const consoleErrors = [];
        page.on('console', message => {
            if (message.type() === 'error') consoleErrors.push(message.text());
        });

        for (const route of publicRoutes) {
            const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
            expect(response?.status(), `${route} must load`).toBeLessThan(500);
            await page.waitForTimeout(300);

            const layout = await page.evaluate(() => ({
                viewport: window.innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                bodyScrollWidth: document.body.scrollWidth,
                brokenImages: [...document.images]
                    .filter(image => image.complete && image.naturalWidth === 0 && image.currentSrc)
                    .map(image => image.currentSrc)
            }));
            expect(layout.scrollWidth, `${route} document must not overflow horizontally`).toBeLessThanOrEqual(layout.viewport + 1);
            expect(layout.bodyScrollWidth, `${route} body must not overflow horizontally`).toBeLessThanOrEqual(layout.viewport + 1);
            expect(layout.brokenImages, `${route} has broken images`).toEqual([]);
        }

        const relevantErrors = consoleErrors.filter(error => !/favicon|ERR_BLOCKED_BY_CLIENT/i.test(error));
        expect(relevantErrors, 'public routes must not emit console errors').toEqual([]);
    });
}
