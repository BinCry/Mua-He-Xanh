# Business logic audit

## Enforced and tested

- Authenticated account, ownership and current active status are checked server-side for journeys, check-in, commerce, ticket and staff operations.
- Login rotates the account UUID binding; logout detaches the current binding; a URL UUID is not a session credential.
- Product and workshop reservations are transactionally locked. Cancellation releases once; completion consumes the reservation; only destination-assigned staff or admin can progress staff states.
- Completion award is sourced from a unique immutable ledger row and account balance updates inside the transaction.
- Festival tickets are account-owned, idempotent, capacity-limited, cancellable and usable once by admin.
- A manager cannot reply, delete or recall chat content outside the assigned destination.
- Journey suggestions derive from the saved current criteria; empty criteria redirects to onboarding; there is no generic `Sống Chậm` fallback and no unsupported shortest-route claim.

## Deliberately unresolved

- Legacy Shop/Workshop history is not auto-classified from names or inferred capacity. The reconciliation command is read-only and waits for approved mapping from a production backup.
- A release cannot presume historic reward state: missing evidence is recorded for reconciliation instead of changing balances automatically.
- PWA, provider integration, operational restart and production database migration still need environment-specific acceptance evidence.
