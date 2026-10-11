const { defineConfig } = require('@playwright/test');
const path = require('path');

const baseURL = String(process.env.E2E_BASE_URL || '').trim();
if (!baseURL) {
    throw new Error('E2E_BASE_URL is required. Refusing to run browser tests against an implicit environment.');
}
if (/^https?:\/\/(?:www\.)?dulichbinhloi\.com/i.test(baseURL) && process.env.E2E_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing production E2E. Set E2E_ALLOW_PRODUCTION=true only for an approved read-only smoke test.');
}

module.exports = defineConfig({
    testDir: './test/e2e',
    timeout: 45_000,
    forbidOnly: Boolean(process.env.CI),
    fullyParallel: false,
    retries: 1,
    outputDir: path.join(__dirname, '.tmp', 'audit', 'playwright-results'),
    reporter: process.env.CI
        ? [['list'], ['html', { open: 'never', outputFolder: path.join(__dirname, '.tmp', 'audit', 'playwright-report') }]]
        : 'list',
    use: {
        baseURL,
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'off',
        serviceWorkers: 'block'
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium', channel: process.env.PW_CHANNEL || 'chrome' }
        },
        {
            name: 'firefox',
            use: { browserName: 'firefox' }
        },
        {
            name: 'webkit',
            use: { browserName: 'webkit' }
        }
    ]
});
