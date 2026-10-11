# Feature test matrix

| Area | Status | Evidence |
| --- | --- | --- |
| Unit/regression suite | PASS | 82/82 `npm test` |
| EJS views / JS syntax | PASS | 58 templates; 118 JS files |
| Journey criteria replacement and no stale chill fallback | PASS | unit + Chromium E2E |
| Journey stop IDOR | PASS | PostgreSQL integration |
| Locked-account session restore | PASS | PostgreSQL integration |
| Copied session UUID | PASS | PostgreSQL integration |
| Review parent ownership / XSS | PASS | unit + PostgreSQL integration |
| Inactive event direct URL | PASS | PostgreSQL integration |
| Product inventory/order state machine | PASS | PostgreSQL race tests + Chromium role E2E |
| Workshop session capacity/state machine | PASS | PostgreSQL final-seat contention; public cross-browser render |
| Festival ticket lifecycle/capacity | PASS | PostgreSQL idempotency and final-capacity race tests |
| Points ledger | PASS | PostgreSQL completion/cancellation race test |
| Chat manager destination ownership | PASS | PostgreSQL integration + route regression |
| Upload/review/comment/recall routing protection | PASS | route regression |
| Public Shop/Workshop/Festival responsive render | PASS | 15 browser cases |
| Dependency vulnerabilities | PASS | `npm audit --omit=dev`: 0 |
| Final responsive matrix | PASS | 24/24 cases, Chromium/Firefox/WebKit x 8 viewports; no retry |
| Final functional/a11y/commerce matrix | PASS | 54/54 cases, Chromium/Firefox/WebKit; no retry |
| Translation/font/cookie resilience | PASS | translation opt-in, local icon font and host-only cookies for IP/localhost |
| PWA offline/reconnect smoke | PASS | Chromium service-worker registration, offline recovery and reconnect health check |
| Local small-load smoke | PASS | health and explore endpoint checks under bounded local concurrency; production load test remains required |
| CI quality gate hosted execution | PASS | GitHub Actions run 38130954942 passed on clean Ubuntu/PostgreSQL 16 runner |
| Production historical reconciliation | BLOCKED | requires backed-up production extract and mapping approval |
| Migration rollback rehearsal | NOT TESTED | no production-like backup is in scope yet |
| OAuth/SMS sandbox | NOT TESTED | provider credentials/sandbox not supplied |
| PWA/offline/reconnect | NOT TESTED | dedicated suite not yet implemented |
| Load/latency and failure recovery | NOT TESTED | requires controlled operational environment |
