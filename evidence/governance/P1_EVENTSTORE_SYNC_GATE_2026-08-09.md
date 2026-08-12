# P1 EventStore server and synchronization gate

Date: 2026-08-09
Scope: local development and validation only; no deployment.

## Implemented

- PostgreSQL append-only `OperationalEventStream` / `OperationalEvent` models;
- `operational-event.v1` validation and event-version enforcement;
- tenant-scoped idempotency and optimistic stream concurrency;
- chain validation through `previousEventId`;
- authenticated sync and replay API routes;
- canonical common projection `operational-projection.v1`;
- web sync adapter with bounded retry, reconnect, acknowledgement and conflict detection;
- explicit retry-local and accept-server conflict resolution; accepted server
  conflicts retain the rejected local event in a separate resolution archive;
- append-only migration and DATA-001 registry update.

## Evidence

- Prisma schema validation — PASS.
- API TypeScript/Nest build — PASS.
- Web TypeScript/Vite build — PASS.
- PostgreSQL migration — PASS on local `agm` only. Session-local override of
  `default_transaction_read_only` was used; no server setting was persisted.
- PostgreSQL append/idempotency/replay E2E — PASS; test stream removed in
  `finally`.
- In-memory server contract append/version/replay — PASS.
- Online/offline/reconnect/conflict/resolution web E2E — PASS.
- SR-10 common outbox identity/order/retry/conflict/acknowledgement — PASS.
- Premium operational context and foundation regressions — PASS.
- DATA-001 migration integrity — PASS (5/5).
- Full API suite — 164/166 PASS. The two initial failures were reconciled as:
  DATA-001 updated and now PASS; the remaining Dashboard Warning NO-GO mismatch
  predates P1 and is outside this gate.

## Isolation

- Production, Cloudflare and DNS were not touched.
- AGM Fitness and port 5173 were not touched.
- Cockpit remained on port 5174.
- Basic field-test artifact/source reference remains frozen:
  `08B4C32401EE2B70EC2ADA7EAF35BE5D98BFEFF2DB925F4D6A6D883434DF0A49`,
  source reference `b241722e879bd68ee2f7367cb3338d854d00b54b`.

## Gate

- EVENTSTORE SERVER — PASS
- EVENT VERSIONING — PASS
- SYNC / CONFLICT / RECOVERY — PASS
- OUTBOX — PASS
- COMMON UI PROJECTION — PASS
- E2E ONLINE / OFFLINE / RECONNECT — PASS
- NO DATA LOSS / NO DUPLICATION — PASS

P2 entry is authorized by the Product Owner's sequential mandate.
