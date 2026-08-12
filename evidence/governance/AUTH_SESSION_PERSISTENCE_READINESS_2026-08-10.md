# Auth session persistence readiness

Date: 2026-08-10 (Europe/Berlin)

Scope: local audit and validation only. Production was not modified by this
readiness activity.

## Current Production

- Product Owner login and Premium access: PASS.
- API image: `cors-credentials-20260810`.
- Credentialed CORS: PASS.
- `/auth/refresh`: absent (404) in the Translator-era API base image.
- Production migration registry contains exactly five completed historical
  migrations through `20260726031500_add_pre_departure_sync`.

## Local implementation

- `AuthSession` stores only SHA-256 token hashes.
- Refresh tokens are generated from 48 cryptographically random bytes.
- Refresh rejects missing, unknown, revoked, expired and inactive-user
  sessions.
- Access tokens and active roles are regenerated from current persistence.
- Logout revokes the matching session idempotently.
- Cookie contract: HttpOnly, Secure in Production, SameSite=Lax, restricted to
  `/api/v1/auth`, 30-day maximum.
- Raw refresh token is removed from the API response.
- Web client stores only the short-lived access token in sessionStorage and
  restores through the HttpOnly cookie.

## Evidence

- API-002 targeted tests: 14/14 PASS.
- Premium access client contract: PASS.
- API build: PASS.
- Web build: PASS.

## Migration dependency blocker

The AuthSession migration is currently ordered after two unapplied Premium
migrations:

1. `20260809091500_add_operational_event_store`
2. `20260809113000_add_bidirectional_communications`
3. `20260809205500_add_auth_sessions`

Running the standard `prisma migrate deploy` would apply all three and exceed a
session-only mandate. It is therefore prohibited without either:

- a combined, explicitly authorized Premium backend migration/deployment; or
- a separately reviewed and authorized isolated AuthSession hotfix migration
  plus later Prisma reconciliation.

No migration was applied and no Production schema or registry was changed.

Verdicts:

- AUTH SESSION DOMAIN CONTRACT — PASS
- REFRESH / REVOCATION / EXPIRY — PASS
- COOKIE SECURITY CONTRACT — PASS
- LOGOUT INVALIDATION CONTRACT — PASS
- LOCAL BUILDS — PASS
- PRODUCTION MIGRATION — NOT AUTHORIZED / DEPENDENCY SCOPE CONFLICT
- ANDROID RESTART PERSISTENCE — PENDING PRODUCTION AUTH SESSION SUPPORT
