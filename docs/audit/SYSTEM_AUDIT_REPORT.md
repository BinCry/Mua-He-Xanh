# System audit report — 2026-10-11

Environment: local isolated PostgreSQL 16; no production database writes, production E2E, Git push or VPS deployment were performed.

## Material fixes verified

- Journey stop IDOR, copied session UUID access and locked-account restoration are rejected.
- Login UUID rotation and logout DB revocation are enforced.
- RBAC uses persisted role/role ID, never an email substring.
- Product and Workshop are distinct public domains with reservations, idempotency, state machines and a point ledger.
- Festival tickets are account-owned and capacity-safe; drafts are not public.
- Chat upload/recall/moderation routes are authenticated; managers are constrained to their assigned destination.
- Stored review content/comments use escaped or text-node output; unsafe upload MIME is rejected.
- Startup does not execute legacy schema mutations unless explicitly opted into local development.
- Journey UI no longer falls back to `Sống Chậm`, repeats a generic route, fabricates a 5 km template distance, or claims uncomputed route optimization.
- Dependency audit is clean after UUID 11.1.1 remediation.
- Inline script values and chat media are serialized/validated safely; chat text is bounded server-side.
- Translation is opt-in, cookie domain handling supports localhost/IP hosts, and Bootstrap Icons are served locally rather than from a runtime CDN.
- Final local evidence: 82/82 unit/regression, 12/12 PostgreSQL integration and 78/78 cross-browser E2E cases pass; Chromium PWA offline/reconnect smoke passes. A CI gate is present but has not yet had hosted execution evidence.

## Release decision

**NOT READY FOR HANDOVER OR PRODUCTION DEPLOYMENT.**

The code evidence is materially stronger, but operational acceptance remains incomplete: backed-up production reconciliation and migration rollback, PWA/offline, provider sandbox, load/failure testing, full role/UI coverage, backup/restore and deployment readiness. Do not deploy on the strength of local tests alone.
