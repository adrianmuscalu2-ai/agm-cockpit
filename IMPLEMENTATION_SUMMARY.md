# Implementation Summary

## Release

Version: `v0.1.0`

Scope: Milestone 1 and Milestone 2 frozen checkpoint before Milestone 3.

## What Was Created

- A NestJS API application under `apps/api`.
- A PostgreSQL-backed Prisma data model under `prisma/schema.prisma`.
- An initial Prisma migration under `prisma/migrations/20260702171528_init`.
- Docker Compose configuration for the local PostgreSQL database.
- Seed data for:
  - AGM company
  - company owner role
  - seeded owner user
  - transport lifecycle states
- Authentication with JWT login and authenticated current-user lookup.
- Transport creation, retrieval, listing, and lifecycle transition APIs.
- Audit event recording for transport operations.
- Business validation reports for lifecycle decisions.
- Transport state history entries for completed transitions.
- Financial ledger creation when payment is registered.

## What Was Validated

Milestone 1 was validated through real HTTP requests:

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/transports`
- `GET /api/v1/transports`
- `POST /api/v1/transports/{id}/actions/accept`

Milestone 2 was validated through a complete real HTTP lifecycle:

1. Create transport
2. Accept
3. Arrive at pickup
4. Complete pickup
5. Start mission
6. Arrive at delivery
7. Complete delivery
8. Submit documents
9. Register payment
10. Close transport
11. Archive transport

The validated final state was `Archived`, with the transport marked as archived and with history, validation reports, audit events, and one financial ledger entry present.

## How To Run

Start Docker Desktop first, then run:

```powershell
corepack pnpm db:up
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

The API listens on:

```text
http://localhost:3000
```

All application routes use the global prefix:

```text
/api/v1
```

Development seed credentials:

```text
email: owner@agm.local
password: ChangeMe123!
```

If a local shell cannot find `pnpm` inside package scripts, enable the Corepack shim:

```powershell
corepack enable pnpm
```

## Known Limitations

- No frontend application is included in v0.1.0.
- No root API route is defined for `/`; use `/api/v1/health` for a health check.
- Evidence management, incident management, AI recommendation review, and extra human approval workflows are not implemented as separate runtime modules yet.
- Seeded credentials and JWT secret values are development defaults and must be changed for non-local environments.
- This workspace was not detected as a Git repository during checkpoint creation, so the frozen checkpoint is represented by the generated files and validated local state rather than a Git commit.
