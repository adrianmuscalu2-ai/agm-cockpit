# Existing Production Owner identity audit

Date: 2026-08-09
Mode: read-only identity audit

## Identity

- Exact email (explicitly authorized for this report): `owner@agm.local`
- Display identity: `AGM Owner`
- Account status: `Active`
- Created: `2026-07-02T17:16:06.338Z`
- Updated: `2026-07-02T17:16:06.338Z`
- `lastLoginAt`: `NULL`

This address is neither of the two identities confirmed by the Product Owner.

## Origin

The account matches the bootstrap defaults in `prisma/seed/seed.ts`, introduced
by commit `f23dc741130d84d0fdecf913d2b7456c91412ffe` (`Release v0.1.0 - AGM backend
foundation`, authored 2026-07-02). The seed creates/upserts the bootstrap
company, the `company_owner` role, the bootstrap Owner user and its `UserRole`.

Production timing corroborates that origin:

- initial migration started `2026-07-02T17:15:28.763845Z`;
- initial migration finished `2026-07-02T17:15:29.382272Z`;
- Owner role created `2026-07-02T17:16:05.841Z`;
- account created `2026-07-02T17:16:06.338Z`;
- Owner assignment created `2026-07-02T17:16:06.390Z`.

The repository exposes the official seed command as `pnpm db:seed`. No durable
Production execution record identifies the human shell actor who invoked it;
the creating process is nevertheless identified by exact data/timestamp/code
correlation as the bootstrap seed.

## Classification

`owner@agm.local` / `AGM Owner` is a bootstrap placeholder account that was
carried into Production. It is not a verified real Product Owner identity.
Its continued interpretation as the official Product Owner was a configuration
and identity-governance error.

## Role and entitlement provenance

- `company_owner` role created `2026-07-02T17:16:05.841Z` and assigned
  `2026-07-02T17:16:06.390Z` by the bootstrap seed. `assignedByUserId` points to
  the same bootstrap account, matching the seed implementation.
- `PREMIUM_ACCESS` role and assignment were created
  `2026-08-09T08:09:42.117Z` by the controlled Product Owner entitlement action
  in the current session. That action selected the sole active Owner without
  first reconciling its email against the identities later confirmed by the
  Product Owner. This was an identity-selection error. No rollback or other
  account change is performed by this audit.

## Authentication and sessions

- `lastLoginAt` is null.
- zero matching login/auth `AuditEvent` records exist.
- zero occurrences of the account email exist in the currently available API
  container logs.
- the authentication implementation does not update `lastLoginAt`, so absence
  of that value alone cannot prove the account was never used.
- Production has no user-auth session or refresh-token table. The only table
  whose name contains `Session` is `PreDepartureSession`, which is unrelated to
  authentication.
- access tokens are stateless JWTs (default lifetime one hour). Consequently,
  the system cannot enumerate whether a still-valid token exists and cannot
  prove `0 active tokens` from database state. Current token status is
  `NOT ENUMERABLE / NO USAGE EVIDENCE`.

## Change control

No user, password, role, entitlement, token, session or database record was
changed during this audit.

## Verdicts

- EXISTING OWNER IDENTITY — IDENTIFIED
- ACCOUNT ORIGIN — IDENTIFIED
- REAL / TEST / PLACEHOLDER / ERROR — PLACEHOLDER / PRODUCTION IDENTITY ERROR
- PREMIUM ENTITLEMENT ORIGIN — IDENTIFIED
- AUTHENTICATION USE — NOT EVIDENCED; HISTORICAL USE CANNOT BE PROVEN NEGATIVE
- ACTIVE TOKENS — NOT ENUMERABLE WITH CURRENT STATELESS JWT ARCHITECTURE
- NO ACCOUNT CHANGE
