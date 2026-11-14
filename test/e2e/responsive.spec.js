const { test, expect } = require('@playwright/test');

test.setTimeout(120_000);

const viewports = [
    { name: 'mobile-320', width: 320, height: 568 },
    { name: 'mobile-375', width: 375, height: 667 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'mobile-412', width: 412, height: 915 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'tablet-landscape', width: 1024, height: 768 },
    { name: 'laptop', width: 1366, height: 768 },
    { name: 'desktop', width: 1440, height: 900 }
];
const publicRoutes = ['/', '/explore', '/map', '/reviews', '/reviews/video-editor', '/auth/login', '/dieu-khoan-dich-vu', '/chinh-sach-bao-mat', '/huong-dan', '/cau-hoi-thuong-gap', '/lien-he'];
// The full intro MP4 is deliberately installed only on the production VPS.
// Keep responsive CI focused on layout and resource failures owned by this
// checkout without committing a multi-gigabyte production media asset.
const INTRO_VIDEO_PATH = '/videos/thuc-giac-tap-dac-biet.mp4';
const e2eOrigin = new URL(process.env.E2E_BASE_URL).origin;

function isProductionIntroVideo(url) {
    const requestedUrl = new URL(url);
    return requestedUrl.origin === e2eOrigin && requestedUrl.pathname === INTRO_VIDEO_PATH;
}

for (const viewport of viewports) {
    test(`public pages fit ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const consoleErrors = [];
        const failedResources = [];
        page.on('console', message => {
            if (message.type() === 'error') consoleErrors.push(message.text());
        });
        page.on('response', response => {
            if (response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`);
        });
        await page.route(isProductionIntroVideo, route => route.fulfill({
            status: 200,
            contentType: 'video/mp4',
            body: Buffer.alloc(0)
        }));

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
        expect({ consoleErrors: relevantErrors, failedResources }, 'public routes must not emit console errors or load failing resources').toEqual({ consoleErrors: [], failedResources: [] });
    });
}
