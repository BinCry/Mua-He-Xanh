const { test, expect } = require('@playwright/test');

const email = 'e2e-tourist@example.test';
const password = 'AuditE2E-only-2026';

async function login(page) {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('#unifiedLoginForm').evaluate(form => form.requestSubmit());
    await page.waitForURL(url => !url.pathname.startsWith('/auth/login'));
}

test('an authenticated user restores history after reload and can start a new conversation', async ({ page }) => {
    await page.route('**/api/agent/chat/history', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            success: true,
            data: {
                messages: [
                    { messageId: 1, role: 'user', content: 'Gợi ý một nơi thiên nhiên' },
                    { messageId: 2, role: 'assistant', content: 'World Farm phù hợp.' }
                ],
                nextCursor: null
            }
        })
    }));
    await page.route('**/api/agent/chat/conversations', route => route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { messages: [], nextCursor: null } })
    }));

    await login(page);
    await page.goto('/chat', { waitUntil: 'domcontentloaded' });
    await page.locator('#agent-mode-toggle').click();
    await expect(page.locator('#chat-messages')).toContainText('Gợi ý một nơi thiên nhiên');
    await expect(page.locator('#chat-messages')).toContainText('World Farm phù hợp.');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#agent-mode-toggle').click();
    await expect(page.locator('#chat-messages')).toContainText('World Farm phù hợp.');

    await page.locator('#agent-new-conversation').click();
    await expect(page.locator('#chat-messages')).toContainText('Đã bắt đầu cuộc trò chuyện mới');
    await expect(page.locator('#chat-messages')).not.toContainText('World Farm phù hợp.');
});
