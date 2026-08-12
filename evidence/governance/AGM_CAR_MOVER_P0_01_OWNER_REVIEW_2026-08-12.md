# AGM Car Mover — P0-01 Owner Review

Date: 2026-08-12  
Scope: Product boundary and class-agnostic manual Job intake/lifecycle foundation  
Production deployment: **NOT PERFORMED**

## Changes

- Added the isolated `agm-car-mover` / `jobs` / `CarMoverJob` product boundary.
- Added authenticated API routes for controlled manual intake, tenant-scoped listing, lifecycle transitions and read-only Job File projection.
- Added class-agnostic Vehicle Subject and Job aggregates.
- Extended the existing Operational EventStore and audit records with product/module/subject scope. Existing Cockpit records retain explicit defaults.
- Added an additive migration, append-only persistence-contract entry and a reversible rollback script.

## Schema

- `CarMoverVehicleSubject`: company, product, `vehicleClass`, extensible `vehicleType`, make, model, optional VIN/registration and JSON extensions.
- `CarMoverJob`: company, product, module, subject type, vehicle subject, pickup/destination snapshots, manual source, lifecycle version and actor references.
- EventStore and AuditEvent now carry `productId`, `moduleId`, `subjectType`, `subjectId`.
- No trailer, semitrailer, external photo archive, platform integration or Car Mover UI schema was introduced.

## Lifecycle

Happy path:

`DRAFT → READY → ASSIGNED → ACCEPTED → IN_PROGRESS → ARRIVED → HANDOVER_PENDING → COMPLETED`

Controlled terminal alternatives: `CANCELLED`, `BLOCKED`, `ESCALATED`. Lifecycle shortcuts and transitions out of terminal states are rejected. `ASSIGNED` requires a driver.

## Car test

`PASSENGER_CAR / hatchback` was created through the same manual intake service, stored as `DRAFT`, projected through Job File and isolated under `agm-car-mover`.

Result: **PASS**

## Truck test

`TRACTOR_UNIT / tractor-unit` was created through the identical intake service and traversed the full happy-path lifecycle to `COMPLETED`. Timeline and audit references were projected without passenger-car branching.

Result: **PASS**

## Isolation

- Product entitlement checked before persistence.
- Company is derived from authenticated request context, not payload.
- Job and Job File reads require matching company and product scope.
- EventStore and audit queries require company/product/subject scope.
- Cross-company read test returned not found/empty.

Result: **PASS**

## EventStore and audit

- Creation and every lifecycle transition append a scoped event.
- Aggregate version advances with lifecycle version.
- Each event records operation, correlation, actor and subject identifiers.
- Audit records preserve before/after snapshots and correlation data.
- Existing P1 EventStore idempotency/version/replay test remains PASS.

Result: **PASS**

## Job File

Read-only `car-mover-job-file.v1` projection aggregates Job identity, Vehicle Subject, pickup/destination snapshot, lifecycle, ordered timeline, evidence references and audit references.

Result: **PASS**

## Migration and rollback

- Additive migration applied successfully to local PostgreSQL only.
- `prisma migrate status`: database schema up to date (9 migrations).
- Rollback SQL was executed inside a PostgreSQL transaction; all P0-01 objects were verified absent, then the validation transaction was rolled back so the local migration remained applied.
- Persistence contract validates the migration name and SHA-256.

Result: **PASS**

## Tests

- Car Mover unit/domain/API-service tests: 4/4 PASS.
- Real local PostgreSQL car + truck + lifecycle + EventStore + audit + Job File: PASS; test data rolled back.
- Rollback execution: PASS; validation itself rolled back.
- Targeted Cockpit/Premium/persistence regression: 42/42 PASS.
- P1 EventStore idempotency/version/replay: PASS.
- API TypeScript compile: PASS.
- API Nest build: PASS.
- Scoped `git diff --check`: PASS.

Full API suite observation: 180/182 tests passed before the persistence contract was updated. The P0-created DATA-001 failure was corrected and independently revalidated PASS. The remaining unrelated pre-existing `image-security-boundary.spec.ts` failure is caused by an already registered `DashboardWarningAnalysisModule`; P0-01 did not add or modify that module.

## Known gaps (deliberately outside P0-01)

- No Car Mover dashboard or operational UI.
- No Onlogist/MOCCA/other platform integration.
- No Voice, Gmail or WhatsApp Car Mover integration.
- No invoicing, costs, payments or complex dispatch.
- No complete handover/takeover protocol.
- No trailer/semitrailer association.
- No Production deployment.

## Recommended verdict

**P0-01 — PASS / READY FOR PRODUCT OWNER REVIEW**

The foundation is vehicle-class agnostic and demonstrably supports both a passenger car and a tractor unit without importing Cockpit-specific tachograph, ADR, cargo or load-safety rules.
