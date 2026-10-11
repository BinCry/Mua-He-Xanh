const { test, expect } = require('@playwright/test');

const viewports = [
    { name: 'mobile-320', width: 320, height: 568 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'laptop-1366', width: 1366, height: 768 },
    { name: 'desktop-1440', width: 1440, height: 900 }
];
const routes = ['/shops', '/workshops', '/festivals'];

for (const viewport of viewports) {
    test('commerce public pages render without horizontal overflow on ' + viewport.name, async ({ page }) => {
        await page.setViewportSize(viewport);
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        for (const route of routes) {
            const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
            expect(response?.status(), route + ' must not fail').toBeLessThan(500);
            const layout = await page.evaluate(() => ({
                viewport: window.innerWidth,
                documentWidth: document.documentElement.scrollWidth,
                bodyWidth: document.body.scrollWidth
            }));
            expect(layout.documentWidth, route + ' document width').toBeLessThanOrEqual(layout.viewport + 1);
            expect(layout.bodyWidth, route + ' body width').toBeLessThanOrEqual(layout.viewport + 1);
        }
        expect(pageErrors).toEqual([]);
    });
}
