# Bug fix report

| ID | Root cause | Fix | Verification |
| --- | --- | --- | --- |
| AUD-001 | Journey stop update had no account ownership join | Locked ownership check | PostgreSQL IDOR test PASS |
| AUD-002 | Login/logout UUID lifecycle was replayable | Rotate and revoke account binding | locked-session integration PASS |
| AUD-003 | Public event URL ignored publication state | Public active-state filter | integration PASS |
| AUD-004 | Review content could reach unsafe HTML sinks | escaped/text-node rendering and validation | regression PASS |
| AUD-005 | Product/Workshop could oversell | row locks, reservations and idempotency | final-unit/final-seat races PASS |
| AUD-006 | Completion/cancellation could double mutate points | state machine and unique ledger source | concurrency PASS |
| AUD-007 | Festival could issue draft/over-capacity tickets | ticket state/capacity transaction | integration races PASS |
| AUD-008 | Admin authority could be inferred from email | persisted role-only checks | regression PASS |
| AUD-009 | Managers could operate chat outside destination | route auth and destination ownership checks | integration PASS |
| AUD-010 | Upload, recall and comment deletion routes lacked routing protection | authenticated middleware | regression PASS |
| AUD-011 | URL UUID could read/write another visitor session | bind UUID to HttpOnly cookie | integration PASS |
| AUD-012 | Journey could visually/logically fall back to Sống Chậm and claim unsupported optimization | criteria-required redirect, truthful suggestion copy and no fake distance | unit + Chromium E2E PASS |
| AUD-013 | UUID advisory remained in dependency graph | UUID 11.1.1 direct dependency and override | `npm audit --omit=dev` 0 vulnerabilities |
| AUD-014 | Every public page auto-loaded Google Translate, producing HTTP 429 and flaky browser failures | Load translation only after an explicit EN choice | 78/78 final browser cases PASS |
| AUD-015 | Cookie domain writes on IP hosts and icon fonts from CDN produced Firefox console errors | Host-only cookie handling for IP/localhost; local Bootstrap Icons production dependency | Firefox no-retry responsive PASS; 24/24 responsive PASS |
