const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './test/e2e',
    timeout: 45_000,
    forbidOnly: Boolean(process.env.CI),
    fullyParallel: false,
    retries: 1,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: process.env.E2E_BASE_URL || 'https://www.dulichbinhloi.com',
        channel: process.env.PW_CHANNEL || 'chrome',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'off',
        serviceWorkers: 'block'
    }
});
