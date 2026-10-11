# Test execution report — 2026-10-11

Environment: isolated PostgreSQL 16 at `127.0.0.1:55432`; local app at `127.0.0.1:4311`; all generated data, browsers, npm cache and artifacts under `D:\Bình-Lợi\.tmp\audit`.

| Check | Result | Evidence |
| --- | --- | --- |
| Unit/regression | PASS | `npm test`: 82 passed, 0 failed |
| PostgreSQL integration | PASS | `TEST_DATABASE_URL=...binh_loi_audit npm run test:audit-db`: 12 passed, 0 failed |
| JavaScript syntax | PASS | `node --check` over 118 project JS files |
| EJS compilation | PASS | 58 templates compiled by `test/template-compile.test.js` |
| Dependency audit | PASS | `npm audit --omit=dev --json`: 0 vulnerabilities after UUID 11.1.1 upgrade/override |
| Diff whitespace | PASS | `git diff --check`; only Git CRLF notices |
| Public responsive commerce UI | PASS | 15 cases: Chromium, Firefox, WebKit × 320/390/768/1366/1440; no 5xx, page error or horizontal overflow |
| Authenticated Shop/UI/role workflow | PASS | Chromium: tourist order; tourist admin denial; wrong-manager denial; assigned-manager confirmation; admin completion — 5 passed |
| Journey selection regression | PASS | Chromium: select then clear `chill`, select `culture`; state is reflected in UI — 1 passed |

| Final cross-browser responsive suite | PASS | 24/24 cases, Chromium/Firefox/WebKit across 320, 375, 390, 412, 768, 1024, 1366 and 1440 px; retries disabled |
| Final cross-browser functional suite | PASS | 54/54 cases: a11y, commerce RBAC/lifecycle, Shop/Workshop, journey selection and legal navigation; retries disabled |
| Final browser total | PASS | 78/78 cases |
| PWA offline/reconnect smoke | PASS | Chromium: registered service worker, offline navigation returns recovery UI (503), reconnect health returns 200 |
| Browser hardening headers | PASS | Runtime response: nosniff, SAMEORIGIN frame policy, strict-origin referrer policy, same-origin opener policy |
| Local small-load smoke | PASS | `/api/health`: 60 requests, concurrency 10, p95 15.1 ms; `/explore`: 30 requests, concurrency 5, p95 45.8 ms; all 200 |
| CI quality gate hosted execution | PASS | GitHub Actions run 38130954942, commit `c067f3f`: isolated PostgreSQL, security/unit/integration and Chromium browser/a11y/PWA acceptance all pass |

## Verified invariants

- Database row locks prevent overselling the final product or workshop seat.
- Completion/cancellation contention commits exactly one state and one ledger award.
- Festival capacity contention, idempotency, draft rejection, ticket cancellation and one-time use are covered in PostgreSQL tests.
- Journey changes, copied session UUIDs, locked accounts, review parent ownership and manager cross-destination chat actions are denied.
- Production E2E is refused unless explicitly approved by `E2E_ALLOW_PRODUCTION=true`.
- Translation is opt-in; default Vietnamese pages do not request it. Bootstrap Icons are installed and served locally, so the primary UI does not depend on a CDN icon font.

## Not yet accepted

- Production-data reconciliation, migration rollback rehearsal, backup/restore, deploy health check, PWA/offline and load/latency testing.
- Full role E2E for every legacy feature, OAuth/SMS provider sandbox tests, and production-like operational failure testing.

These are release blockers. This report does not authorize deployment.
