const { test, expect } = require('@playwright/test');

async function searchAsYouType(page, path, query) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const input = page.locator('form[data-live-catalog-search] input[name="q"]');
    await input.fill(query);
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(query);
    await expect(input).toHaveValue(query);
}

async function clearSearchAndRestoreCatalogue(page, path, expectedResult) {
    await page.goto(`${path}?q=khong-co-ket-qua`, { waitUntil: 'domcontentloaded' });
    const input = page.locator('form[data-live-catalog-search] input[name="q"]');
    await input.fill('');
    await expect.poll(() => new URL(page.url()).searchParams.has('q')).toBe(false);
    await expect(page.locator('[data-catalog-results]')).toContainText(expectedResult);
}

test('Explore, Shop and Workshop refresh search results while a visitor types an incomplete query', async ({ page }) => {
    await searchAsYouType(page, '/explore', 'diem e');
    await expect(page.locator('[data-catalog-results]')).toContainText('Dia diem E2E 1');

    await searchAsYouType(page, '/shops', 'san pham');
    await expect(page.locator('[data-catalog-results]')).toContainText('Sản phẩm Shop E2E');

    await searchAsYouType(page, '/workshops', 'workshop e');
    await expect(page.locator('[data-catalog-results]')).toContainText('Workshop E2E');
});

test('Explore, Shop and Workshop restore the full catalogue when the query is cleared', async ({ page }) => {
    await clearSearchAndRestoreCatalogue(page, '/explore', 'Dia diem E2E 1');
    await clearSearchAndRestoreCatalogue(page, '/shops', 'Sản phẩm Shop E2E');
    await clearSearchAndRestoreCatalogue(page, '/workshops', 'Workshop E2E');
});
