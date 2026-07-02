# Architecture Status

## Release Scope

Release `v0.1.0` is the frozen checkpoint for Milestone 1 and Milestone 2 before Milestone 3.

The implemented surface is a backend API for authenticated transport lifecycle management.

## Runtime Architecture

- API framework: NestJS.
- Runtime: Node.js.
- Database: PostgreSQL 16 via Docker Compose.
- ORM and migrations: Prisma.
- Authentication: JWT with Passport strategy.
- Validation: NestJS global `ValidationPipe` with whitelist, forbidden non-whitelisted fields, and transform enabled.
- Route prefix: `/api/v1`.

## Modules

- `AuthModule`
  - Login.
  - JWT validation.
  - Current authenticated user context.
- `UsersModule`
  - User lookup and credential support for authentication.
- `TransportsModule`
  - Transport creation, lookup, listing, and lifecycle actions.
- `LifecycleModule`
  - Lifecycle state lookup by company and state code.
- `AuditModule`
  - Audit event creation for business actions.
- `ValidationReportsModule`
  - Business validation report creation.
- `PrismaModule`
  - Shared Prisma client integration.
- `HealthController`
  - Health response at `/api/v1/health`.

## Domain Model Status

Implemented Prisma models:

- `Company`
- `User`
- `Role`
- `UserRole`
- `LifecycleState`
- `TransportJob`
- `TransportJobStateHistory`
- `BusinessValidationReport`
- `AuditEvent`
- `FinancialLedger`

The model preserves company scoping, lifecycle state tracking, validation reporting, audit event linkage, and financial ledger linkage.

## Lifecycle Status

Validated v0.1.0 lifecycle:

```text
Imported
Accepted
AtPickup
PickupCompleted
InTransport
AtDelivery
DeliveryCompleted
DocumentsSubmitted
Paid
Closed
Archived
```

Seeded but not yet active in the primary validated happy path:

```text
MissionPaused
IncidentReported
Cancelled
```

## Data Integrity and Traceability

Current implementation creates:

- An audit event when a transport is created.
- A validation report for each lifecycle action.
- An audit event for each lifecycle action.
- A state history entry for each successful lifecycle transition.
- A financial ledger entry when payment is registered.

Invalid transitions are rejected with a validation report and audit event.

## Build and Run Status

Expected local startup:

```powershell
corepack pnpm db:up
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

Expected local build:

```powershell
corepack pnpm build
```

## Known Architecture Gaps Before Milestone 3

- No frontend application is implemented.
- No separate evidence storage subsystem is implemented.
- No incident management subsystem is implemented.
- No AI recommendation subsystem is implemented.
- No additional human approval workflow subsystem is implemented.
- No production secrets management is configured.
- No automated end-to-end test suite is committed for the HTTP validation flows yet.
- No root route is defined for `/`; `/api/v1/health` is the health endpoint.

## Frozen Checkpoint Notes

- Business logic was not modified while creating release documentation.
- v0.1.0 documents the current validated backend checkpoint.
- This checkpoint should be treated as the baseline for Milestone 3 work.
