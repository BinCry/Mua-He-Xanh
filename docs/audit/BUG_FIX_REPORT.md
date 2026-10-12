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
| AUD-016 | Legacy `/create-workshop` aliases wrote a Shop catalogue record after the Shop/Workshop split | Retire ambiguous aliases with explicit 410; canonical Workshop management API remains scoped | API browser smoke + route regression PASS |
| AUD-017 | Invalid truthy/falsy payload could silently deactivate a Workshop/session | Strict boolean parser returns validation error for any other value | authenticated API smoke PASS |
| AUD-018 | Check-in/toast, manager booking and Studio fields interpolated dynamic data into HTML | DOM text nodes / attribute escaping at each dynamic sink | security regression PASS |
| AUD-019 | Browser/Studio used device-dependent font names; Vietnamese diacritics could fall back to mismatched glyphs | local Vietnamese brand-script asset, global safe stack, preload, and normalization of legacy Studio font selections | 103/103 unit/template regression PASS; browser retest remains blocked on audit DB |
| AUD-020 | Retired Shop booking/cancel/review paths and manager registration UI remained reachable after Shop was declared contact-only | Shop controller reduced to catalogue/contact; old mutation routes return 410; manager UI uses only Shop catalogue CRUD; legacy booking model removed | unit/template regression PASS; isolated PostgreSQL route verification remains blocked |
| AUD-021 | An old database-backed `session_uuid` could remain eligible for recovery beyond the browser cookie lifetime | Enforce a 30-day creation-time bound in every UUID recovery path and in journey creation; add explicit forward-only schema migration | 107/107 unit/template regression PASS; PostgreSQL expiry-path verification remains blocked |
| AUD-022 | Sitemap treated Shop and Workshop catalogue records as one type, producing invalid `/shops/:id` URLs for Workshops | Generate separate, type-filtered Shop and Workshop sitemap URLs | 107/107 unit/template regression PASS; browser/DB rerun remains blocked |
| AUD-023 | Public QR diagnostic endpoint exposed a production test surface and rendered stored destination names as raw HTML | Disable endpoint in production and HTML-escape diagnostic labels in non-production | 107/107 unit/template regression PASS |
