# Release readiness checklist

- [x] Isolated audit data lives under `D:\Bình-Lợi\.tmp\audit`; no production database writes.
- [x] Unit/regression (82/82), PostgreSQL integration (12/12), JS syntax, EJS compilation and dependency audit pass.
- [x] Product/Workshop reservation, idempotency and race invariants are tested.
- [x] Festival ticket/ledger/role and public responsive commerce evidence exists.
- [x] Responsive/UI/a11y/role browser suite has 78/78 Chromium, Firefox and WebKit cases passing without retry.
- [x] GitHub Actions quality gate passed on a clean PostgreSQL 16 runner (run 38130954942).
- [ ] Run read-only reconciliation against a backed-up production snapshot and approve mappings.
- [ ] Rehearse migration and rollback against a production-like backup; reconcile before/after IDs, points and balances.
- [ ] Complete provider sandbox, production-like load/latency and operational restart/failure tests; local small-load and PWA Chromium smoke are complete, but cross-browser/private-flow acceptance remains.
- [ ] Complete all remaining role/UI flows, keyboard/focus/modal and cross-tab acceptance.
- [ ] Create verified backup, deployment plan, approved change record and post-deploy health/readiness plan.

## Decision

**NOT READY.** Only change this to READY FOR HANDOVER after every unchecked item has direct evidence and the production backup/migration gate is accepted.
