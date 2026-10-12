# Release readiness checklist

- [x] Isolated audit data lives under `D:\Bình-Lợi\.tmp\audit`; no production database writes.
- [ ] Latest release candidate verification is incomplete: unit/template regression is 107/107, but the isolated PostgreSQL integration and browser checks must be rerun after search/font/session/sitemap changes once the audit database is available.
- [ ] Audit cleanup is incomplete: a temporary `D:\.bl-audit` junction points into this workspace. It holds no duplicate data, but must be removed before handover to satisfy the workspace-only artifact rule; the elevated audit runner was correctly prevented from deleting it automatically.
- [x] Product/Workshop reservation, idempotency and race invariants are tested.
- [x] Festival ticket/ledger/role and public responsive commerce evidence exists.
- [ ] Responsive/UI/a11y/role browser suite is not yet release-clean: one Chromium tablet run was flaky before its isolated rerun passed. Root cause must be eliminated or an approved exception recorded.
- [x] GitHub Actions quality gate passed on a clean PostgreSQL 16 runner (run 38130954942).
- [ ] Run read-only reconciliation against a backed-up production snapshot and approve mappings.
- [ ] Rehearse migration and rollback against a production-like backup; reconcile before/after IDs, points and balances.
- [ ] Include `npm run db:migrate:auth-sessions -- --dry-run` in the rehearsal, then apply the forward-only session-expiry schema migration only after backup approval.
- [ ] Complete provider sandbox, production-like load/latency and operational restart/failure tests; local small-load and PWA Chromium smoke are complete, but cross-browser/private-flow acceptance remains.
- [ ] Complete all remaining role/UI flows, keyboard/focus/modal and cross-tab acceptance.
- [x] Create verified pre-deploy backups, deployment plan and post-deploy health/readiness check. The application and PostgreSQL backups were verified before deployment.
- [x] Resolve VPS preflight blocker: untracked uploads/scripts were preserved in a verified archive before the fast-forward deployment. They remain untracked and require later product-owner classification; they did not block this release transaction.
- [x] Re-run Chromium, Firefox and WebKit browser suites after the Shop/Workshop split; browser assets remain isolated under `.tmp/audit`.

## Decision

**NOT READY.** Only change this to READY FOR HANDOVER after every unchecked item has direct evidence and the production backup/migration gate is accepted.
