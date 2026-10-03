const { test, expect } = require('@playwright/test');

for (const viewport of [
    { name: 'mobile', width: 320, height: 568 },
    { name: 'laptop', width: 1366, height: 768 }
]) {
    test(`legal pages fit ${viewport.name} and preserve safe navigation`, async ({ page }) => {
        await page.setViewportSize(viewport);

        await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
        await page.locator('main a[href="/dieu-khoan-dich-vu"]').click();
        await expect(page).toHaveURL(/\/dieu-khoan-dich-vu$/);
        await expect(page.getByRole('heading', { name: 'Điều khoản dịch vụ' })).toBeVisible();
        await page.locator('#legalBackButton').click();
        await expect(page).toHaveURL(/\/auth\/login$/);

        await page.goto('/chinh-sach-bao-mat', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'Chính sách bảo mật' })).toBeVisible();
        await expect(page.getByRole('link', { name: /Mở Gmail/ })).toHaveAttribute('href', /mail\.google\.com\/mail\/\?view=cm&fs=1&to=binhloi\.travel%40gmail\.com/);
        const layout = await page.evaluate(() => ({
            viewport: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth
        }));
        expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport + 1);
        expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewport + 1);

        for (const [route, heading] of [
            ['/huong-dan', 'Hướng dẫn sử dụng'],
            ['/cau-hoi-thuong-gap', 'Câu hỏi thường gặp'],
            ['/lien-he', 'Liên hệ']
        ]) {
            await page.goto(route, { waitUntil: 'domcontentloaded' });
            await expect(page.getByRole('heading', { name: heading })).toBeVisible();
            const supportLayout = await page.evaluate(() => ({
                viewport: window.innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                bodyScrollWidth: document.body.scrollWidth
            }));
            expect(supportLayout.scrollWidth).toBeLessThanOrEqual(supportLayout.viewport + 1);
            expect(supportLayout.bodyScrollWidth).toBeLessThanOrEqual(supportLayout.viewport + 1);
        }
    });
}
