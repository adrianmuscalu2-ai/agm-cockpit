# Production CORS credentials controlled deployment

Change: `AGM-CHG-20260810-CORS-CREDENTIALS`

Authorized scope: add credentialed CORS support required by Product Owner
login/refresh. No Cloudflare, DNS, database schema, Basic or Fitness change.

## Preflight

- Previous image: `sha256:f781a66a0f2cf17c4360e0274ca124bf9a8a12e95d02bdeacfb81edd96933808`.
- Previous revision: `translator-wave1-1c3eeaf`.
- API live: PASS.
- API container and PostgreSQL: healthy.
- PostgreSQL volume: `app_agm_postgres_data`.
- API host binding: `127.0.0.1:3000` only.
- Confirmed defect: login OPTIONS allowed the canonical origin but omitted
  `Access-Control-Allow-Credentials`.

## Scope integrity

- Production bundle checksum:
  `68259b232c49030a86a9df0fc2e628a8cffde5d3b27e7c1205891638f22f77ec`.
- Locally compiled bundle, normalized by removing only
  `credentials: true`, produced the identical checksum.
- New bundle checksum:
  `fba60bca270a258aec675a34ec1a85ddd640b10bb22aec0b8198d83cf39a8717`.
- Derived image contains only this compiled-file replacement.

## Deployment

- New image ID:
  `sha256:ae6c95ab5489fa279159074980a2c9ecb267ff924c2953e281f59402f38485ba`.
- New tag/revision: `agm-api:cors-credentials-20260810` /
  `cors-credentials-20260810`.
- Compose and systemd candidates passed static verification.
- API was replaced only through `agm-production-api.service`.
- PostgreSQL was not stopped, recreated or modified.
- Previous config and unit are retained under
  `/opt/agm/production/rollback/AGM-CHG-20260810-CORS-CREDENTIALS/`.
- Previous image remains present for immediate rollback.

## Post-deployment

- systemd API service: active.
- API container: healthy and running the expected new image ID.
- `/health/live`: PASS.
- `/health/ready`: PASS; database available; translation provider configured.
- PostgreSQL: healthy; approved volume preserved.
- canonical origin: `https://app.agmcockpit.com`.
- `Access-Control-Allow-Credentials: true`: PASS.
- Android WebView synthetic login probe: PASS; invalid credentials now return
  controlled HTTP 401 with a readable CORS response instead of `Failed to fetch`.
- Product Owner login on Samsung SM-S931B: PASS.
- `/access` rendered `Acces Premium valid.` and cleared the credential fields.
- `Vezi Premium` navigated to `https://app.agmcockpit.com/premium`: PASS.
- Premium rendered the two approved workspaces: `Pre-Departure` and
  `Journey Operations Workspace`.
- Refresh-session endpoint remains absent from the deployed Translator-era
  backend (`/auth/refresh` returns 404). Session persistence after process
  restart was not claimed or deployed because it requires the separately
  developed auth-session backend and database migration, outside this
  CORS-only/no-schema-change mandate.

Verdicts:

- CONTROLLED API DEPLOYMENT — PASS
- CORS CREDENTIALS CONTRACT — PASS
- HEALTH / READY / DATABASE — PASS
- ROLLBACK READINESS — PASS
- ANDROID LOGIN / PREMIUM ACCESS — PASS
- ANDROID PROCESS-RESTART SESSION PERSISTENCE — PENDING SEPARATE AUTH-SESSIONS MANDATE
- CLOUDFLARE / DNS / DATABASE SCHEMA / BASIC / FITNESS — UNTOUCHED
