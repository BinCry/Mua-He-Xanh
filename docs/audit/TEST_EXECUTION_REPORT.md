# Test execution report — 2026-10-11

Environment: isolated PostgreSQL 16 at `127.0.0.1:55432`; local app at `127.0.0.1:4311`; all generated data, browsers, npm cache and artifacts under `D:\Bình-Lợi\.tmp\audit`.

## Latest local regression update — 2026-10-12

| Check | Result | Evidence |
| --- | --- | --- |
| Unit/regression + template compile | PASS | `npm test`: 107 passed, 0 failed; includes tokenized search, Studio legacy-font normalization, bundled Vietnamese-script-font checks, UUID-expiry recovery/migration, separated sitemap URLs and production diagnostic-route hardening |
| JavaScript syntax | PASS | `node --check` succeeded for all 125 current project JS files (2026-10-12) |
| Runtime brand-font check | PASS | Existing Chrome, isolated app with audit DB unreachable: local font returned 200 `font/ttf`; `document.fonts` ready; computed tagline font was `BinhLoi Script`; no horizontal overflow at 1366px. |
| PostgreSQL integration after latest search changes | BLOCKED | Fresh `npm run test:audit-db` attempted all 15 PostgreSQL integration cases (including expired-UUID recovery) and could not connect to `127.0.0.1:55432` (`ECONNREFUSED`). It cannot be restarted under the elevated runner because PostgreSQL refuses administrator execution; no production database was substituted. |
| Production dependency audit | PASS | `npm audit --omit=dev --json`: 0 vulnerabilities |
| Chromium / Firefox / WebKit UI suite | PASS | 25 tests per browser; Chromium includes PWA smoke, Firefox/WebKit intentionally skip the Chromium-only service-worker case |
| Workshop API guards | PASS | authenticated browser smoke: legacy aliases return 410; invalid boolean status returns 400 |
| Responsive rerun | CONDITIONAL | 25 Chromium cases were rerun in bounded groups. One tablet run failed before passing when isolated; treat this as flaky until a repeatable root cause is removed. |
| Browser verification after latest search/font changes | BLOCKED | Requires the isolated PostgreSQL audit instance to be restored; historical browser results are retained as evidence only, not used to approve this change. |
| PostgreSQL UUID-expiry and catalogue sitemap verification | BLOCKED | Requires the isolated PostgreSQL audit instance; no production database was used as a substitute. |

Firefox and WebKit browser binaries were installed only below `.tmp\audit\ms-playwright`; no browser assets were placed on the system drive.

| Check | Result | Evidence |
| --- | --- | --- |
| Unit/regression | PASS | `npm test`: 83 passed, 0 failed |
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
| Operational migration preflight | PASS | Dry-run against audit DB confirms applied schema; incompatible existing look-alike tables now fail before a migration record is written |

## Verified invariants

- Database row locks prevent overselling the final product or workshop seat.
- Completion/cancellation contention commits exactly one state and one ledger award.
- Festival capacity contention, idempotency, draft rejection, ticket cancellation and one-time use are covered in PostgreSQL tests.
- Journey changes, copied session UUIDs, locked accounts, review parent ownership and manager cross-destination chat actions are denied.
- Production E2E is refused unless explicitly approved by `E2E_ALLOW_PRODUCTION=true`.
- Translation is opt-in; default Vietnamese pages do not request it. Bootstrap Icons are installed and served locally, so the primary UI does not depend on a CDN icon font.

## Not yet accepted

- Production-data reconciliation, migration rollback rehearsal, PWA/offline and load/latency testing. Pre-deploy application/database backups and post-deploy health/readiness checks are complete.
- Full role E2E for every legacy feature, OAuth/SMS provider sandbox tests, and production-like operational failure testing.
- VPS preflight found commit `699334c` and an untracked working tree. The files were archived and checksum-verified; the server was upgraded to `7b17a3f`, migrations were confirmed, PM2 restarted, and health/readiness and public-route smoke checks passed.

These are release blockers. This report does not authorize deployment.
