# System audit report — 2026-10-11

Environment: local isolated PostgreSQL 16; no production database writes, production E2E, Git push or VPS deployment were performed.

## Material fixes verified

- Journey stop IDOR, copied session UUID access and locked-account restoration are rejected.
- Login UUID rotation and logout DB revocation are enforced.
- RBAC uses persisted role/role ID, never an email substring.
- Shop is a direct-contact catalogue; Workshop is a distinct session-reservation domain with idempotency, state transitions and a point ledger.
- Festival tickets are account-owned and capacity-safe; drafts are not public.
- Chat upload/recall/moderation routes are authenticated; managers are constrained to their assigned destination.
- Stored review content/comments use escaped or text-node output; unsafe upload MIME is rejected.
- Startup does not execute legacy schema mutations unless explicitly opted into local development.
- Journey UI no longer falls back to `Sống Chậm`, repeats a generic route, fabricates a 5 km template distance, or claims uncomputed route optimization.
- Dependency audit is clean after UUID 11.1.1 remediation.
- Inline script values and chat media are serialized/validated safely; chat text is bounded server-side.
- Translation is opt-in, cookie domain handling supports localhost/IP hosts, and Bootstrap Icons are served locally rather than from a runtime CDN.
- Shop/Workshop split now uses an explicit `catalog_kind`; legacy Workshop write aliases return 410 rather than silently creating Shop records. Invalid Workshop status values are rejected.
- Dynamic check-in, administrator toast, manager booking and Studio slot values use escaped text/attributes rather than inserting untrusted values as markup.
- Final local evidence: 83/83 unit/regression, 12/12 PostgreSQL integration and 78/78 cross-browser E2E cases pass; Chromium PWA offline/reconnect smoke passes. GitHub Actions run 38130954942 independently passed the CI quality gate on a clean PostgreSQL 16 runner. Operational migration now rejects incompatible legacy schema before recording success.

## Release decision

**NOT READY FOR HANDOVER OR PRODUCTION DEPLOYMENT.**

## VPS preflight and controlled deployment — 2026-10-11

Read-only SSH verification initially found PM2 `binh-loi` online and both `/api/health` and `/api/ready` returning 200. The server was on commit `699334c` and had untracked uploads/scripts. Before changing the release, the untracked files and PostgreSQL database were backed up and checksum-verified. The repository was then fast-forwarded to `7b17a3f`, both operational migrations were applied, dependencies installed and PM2 restarted with updated environment values.

Post-deploy verification: PM2 is online; `/api/health` and `/api/ready` return 200; `/`, `/explore`, `/shops`, `/workshops`, `/map` and `/reviews` return 200; `/journey` redirects unauthenticated users with 302 as designed. Both migration IDs and all required operational tables were confirmed. The server uses a self-signed PostgreSQL certificate, so its existing explicit `DATABASE_SSL_REJECT_UNAUTHORIZED=false` compatibility setting was retained and must be replaced with a trusted certificate before a future security release.

The code evidence is materially stronger, but handover acceptance remains incomplete: production-data reconciliation and migration rollback rehearsal, PWA/offline, provider sandbox, load/failure testing and full role/UI acceptance. The deployment is a verified controlled release, not an authorization to label the system READY FOR HANDOVER.
