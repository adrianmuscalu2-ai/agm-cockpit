# Premium Foundation Production deployment — 2026-08-10

## Scope

- Additive Prisma migrations: Operational EventStore, bidirectional Communications, AuthSession.
- API runtime promotion only.
- No Cloudflare, DNS, Basic, Fitness, web bundle, or WhatsApp activation change.
- `Vorbește cu AGM` remains disabled and user-invisible; its local contract requires Premium entitlement.

## Backup and rollback

- Rollback directory: `/opt/agm/production/rollback/AGM-CHG-20260810-PREMIUM-FOUNDATION/`.
- Logical PostgreSQL dump validated by `pg_restore --list` and SHA-256 verification.
- Previous Compose configuration and systemd unit preserved.
- Previous CORS API image retained.

## Migrations

- `20260809091500_add_operational_event_store` — applied.
- `20260809113000_add_bidirectional_communications` — applied.
- `20260809205500_add_auth_sessions` — applied.
- `prisma migrate status` — database schema up to date.

## Runtime

- Active image: `sha256:7de033cfd5d9a800353f4a662960fbd9f648f7e7f2fb5ec5aae57f0379795f9e`.
- Revision: `premium-foundation-20260810-r3`.
- systemd: active / enabled.
- Container health: healthy.
- Public ready: ready; database available; translation provider configured.
- CORS credentials: PASS.

## Compatibility correction

The initial r2 entitlement response exposed the future capability ID
`premium.voice-assistant`. The currently deployed web bundle correctly failed closed
because it did not yet know that ID, but presented the Product Owner as Basic. r3
stages the capability rollout: the voice module remains Premium-only and disabled in
the new web source, while the API does not advertise the new ID until the matching web
bundle is deployed. No database or account change was required.

## Regression and session evidence

- Translator Production RO/DE/EN/FR/NL/RU/PL/TR/SQ — 9/9 PASS with real OpenAI results.
- Login issued `agm_refresh` with HttpOnly, Secure, SameSite=Lax and restricted auth path.
- Android force-stop/relaunch started with empty sessionStorage.
- `/access` restored the access token from the refresh cookie without another login.
- Entitlement state after restart: premium.
- Premium link navigated to `https://app.agmcockpit.com/premium`.

## Verdicts

- PREMIUM FOUNDATION PRODUCTION — PASS
- AUTHSESSION LOGIN / REFRESH — PASS
- ANDROID PROCESS-RESTART PERSISTENCE — PASS
- PREMIUM ACCESS — PASS
- TRANSLATOR REGRESSION — 9/9 PASS
- WHATSAPP — UNCHANGED / EXTERNAL REVIEW PENDING
- VOICE ASSISTANT — PREMIUM-ONLY / DISABLED UNTIL JOINT VALIDATION
