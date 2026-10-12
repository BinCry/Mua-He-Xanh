# Feature test matrix

| Area | Status | Evidence |
| --- | --- | --- |
| Unit/regression suite | PASS | 103/103 `npm test` (latest local run, 2026-10-12) |
| EJS views / JS syntax | PASS | 60 templates compile; `node --check` valid for 125 JS files (2026-10-12) |
| Journey criteria replacement and no stale chill fallback | PASS | unit + Chromium/Firefox/WebKit E2E |
| Journey stop IDOR | PASS | PostgreSQL integration |
| Locked-account session restore | PASS | PostgreSQL integration |
| Copied session UUID | PASS | PostgreSQL integration |
| Review parent ownership / XSS | PASS | unit + PostgreSQL integration |
| Inactive event direct URL | PASS | PostgreSQL integration |
| Shop direct-contact catalogue | PASS | public Shop flow, retired order API and role E2E across Chromium/Firefox/WebKit |
| Workshop session capacity/state machine | PASS | PostgreSQL final-seat contention; public cross-browser render |
| Festival ticket lifecycle/capacity | PASS | PostgreSQL idempotency and final-capacity race tests |
| Points ledger | PASS | PostgreSQL completion/cancellation race test |
| Chat manager destination ownership | PASS | PostgreSQL integration + route regression |
| Upload/review/comment/recall routing protection | PASS | route regression |
| Public Shop/Workshop/Festival responsive render | PASS | 15 browser cases |
| Dependency vulnerabilities | PASS | `npm audit --omit=dev`: 0 |
| Final responsive matrix | PASS | 24/24 cases, Chromium/Firefox/WebKit x 8 viewports; no retry |
| Final functional/a11y/commerce matrix | PASS | 54/54 cases, Chromium/Firefox/WebKit; no retry |
| Translation/font/cookie resilience | PASS | translation opt-in, local icon font, host-only cookies and bundled Vietnamese brand-script font |
| PWA offline/reconnect smoke | PASS | Chromium service-worker registration, offline recovery and reconnect health check |
| Local small-load smoke | PASS | health and explore endpoint checks under bounded local concurrency; production load test remains required |
| CI quality gate hosted execution | PASS | GitHub Actions run 38130954942 passed on clean Ubuntu/PostgreSQL 16 runner |
| Operational migration schema preflight | PASS | migration validates legacy tables and post-apply required columns before recording success |
| Shop/Workshop split contract | PASS | explicit `catalog_kind`, scoped Workshop API, rejected legacy aliases and strict status validation |
| Production historical reconciliation | BLOCKED | requires backed-up production extract and mapping approval |
| Migration rollback rehearsal | NOT TESTED | no production-like backup is in scope yet |
| OAuth/SMS sandbox | NOT TESTED | provider credentials/sandbox not supplied |
| PWA/offline/reconnect | PARTIAL | Chromium service-worker offline/reconnect smoke passes; private-flow and cross-browser acceptance remain outstanding |
| Load/latency and failure recovery | NOT TESTED | requires controlled operational environment |
