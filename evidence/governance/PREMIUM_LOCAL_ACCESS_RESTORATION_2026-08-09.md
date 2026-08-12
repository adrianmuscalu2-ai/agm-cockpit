# Premium local access restoration

Date: 2026-08-09
Environment: LOCAL VALIDATION

## Identity

- Official local Product Owner: `agm.transporte.logistik@gmail.com`
- `adrianmuscalu2@gmail.com`: no local authentication account
- Official account status: Active
- Active roles: `company_owner`, `PREMIUM_ACCESS`
- Bootstrap placeholder `owner@agm.local`: preserved and unchanged
- Premium authentication uses the user-account bcrypt password; it does not use the Turn credential.

## Session

- Password was entered only through the masked PowerShell flow and stored only as a bcrypt cost-12 hash.
- No password or hash was printed in audit output.
- Successful login recorded at `2026-08-09T21:05:38.887Z`.
- Exactly one revocable refresh session was active.
- Session expiry: `2026-09-08T21:05:38.904Z`.
- Session reuse after browser reopen recorded at `2026-08-09T21:07:48.306Z`.
- Refresh material is stored only as a SHA-256 hash in PostgreSQL; the browser receives an HttpOnly, SameSite=Lax cookie.
- Access JWT remains session-scoped and is restored from the revocable cookie after reopen.

## Surfaces

- Premium root / HUB-00: rendered and visually evidenced by Product Owner.
- HUB-05 Email and WhatsApp: rendered and visually evidenced by Product Owner.
- Basic access remained available.
- No design or feature changes were made as part of the access validation.

## Recovery

- The pre-existing API on port 3000 used the old non-persistent auth runtime and could not be stopped by the current session.
- Rescue used validation-only API `3001` and Web `5175`.
- Local PostgreSQL read-only default was overridden only for the controlled API validation session.
- Cockpit `5174` and protected Fitness `5173` were not stopped or modified.

## Verdicts

- PREMIUM ACCOUNT IDENTITY — CONFIRMED
- PREMIUM LOCAL LOGIN — PASS
- PREMIUM SESSION PERSISTENCE — PASS
- PREMIUM HUB-00 — PASS
- PREMIUM HUB-05 — PASS
- BASIC ACCESS — PRESERVED
- NO OAUTH / PRODUCTION / BASIC / FITNESS CHANGE
