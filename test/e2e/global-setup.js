const path = require('path');
const { execFileSync } = require('child_process');

module.exports = async function globalSetup() {
    const baseUrl = String(process.env.E2E_BASE_URL || '').trim();
    const databaseUrl = String(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '').trim();
    if (!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(baseUrl)) {
        throw new Error('E2E global setup refuses any non-local base URL.');
    }
    if (!/(?:127\.0\.0\.1|localhost).*binh_loi_audit/i.test(databaseUrl)) {
        throw new Error('E2E global setup requires a local TEST_DATABASE_URL for binh_loi_audit.');
    }

    execFileSync(process.execPath, ['scripts/seed_audit_e2e.js'], {
        cwd: path.resolve(__dirname, '../..'),
        env: { ...process.env, TEST_DATABASE_URL: databaseUrl },
        stdio: 'inherit'
    });
};
