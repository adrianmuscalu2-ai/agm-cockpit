# AGM Hetzner — Production Target Contract

Date: 2026-07-27  
Status: proposed; no production change authorized

## 1. Target architecture

```text
Browser / Android
        |
        v
https://api.agmcockpit.com/api/v1
        |
        v
Cloudflare named production tunnel
        |
        v
Hetzner cloudflared systemd service
        |
        v
127.0.0.1:3000 -> AGM API container
        |
        v
private Docker network -> one PostgreSQL container/volume
```

- Frontend remains on Cloudflare Pages:
  - `https://app.agmcockpit.com`
  - `https://agm-cockpit.pages.dev`
- The API is built from one approved Git commit and immutable image digest.
- API port 3000 remains loopback-only.
- PostgreSQL has no host port publication.
- Cloudflare is the only public API ingress.
- SSH is key-only and operational access is through `agmops` plus controlled `sudo`.
- Backups are local plus encrypted off-site, with independent failure alerting.

## 2. Database source of truth

Before cutover, the current PC production PostgreSQL database remains authoritative.

At the cutover transaction:

1. writes to the PC API are quiesced or placed behind a controlled maintenance gate;
2. a final consistent `pg_dump` is produced;
3. its SHA-256 is recorded;
4. it is restored into the approved Hetzner production database;
5. migrations are applied once;
6. row counts and integrity checks pass;
7. only then may the public route move to Hetzner.

After route validation and explicit declaration, Hetzner becomes authoritative. The PC
database is retained read-only for rollback and must not accept independent writes.

Dual-write is not approved because AGM has no implemented conflict-resolution contract
for two production PostgreSQL primaries.

## 3. Transfer contract

1. Baseline dump from PC for rehearsal.
2. SHA-256 before transfer.
3. Encrypted transport through SSH/SCP.
4. SHA-256 after transfer.
5. Restore into a disposable Hetzner database.
6. `pg_restore --list`, migrations, schema and row-count validation.
7. Functional API tests against the disposable copy.
8. Pre-cutover backup of both PC and Hetzner.
9. Final quiesced PC dump.
10. Restore into the empty approved Hetzner production database.
11. Final validation and route change.

No live Docker volume copy is permitted.

## 4. Required variable names

API/runtime:

- `NODE_ENV`
- `PORT`
- `API_HOST`
- `TRUST_PROXY_HOPS`
- `CORS_ALLOWED_ORIGINS`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `OPENAI_API_KEY`
- `OPENAI_TRANSLATION_MODEL`
- `OPENAI_TRANSLATION_TIMEOUT_MS`
- `AGM_TURN_ADMIN_PIN_HASH`

Database:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

Seed variables are not required for a restored production database and must not run
automatically:

- `DEFAULT_COMPANY_NAME`
- `DEFAULT_COMPANY_COUNTRY`
- `DEFAULT_CURRENCY`
- `SEED_OWNER_EMAIL`
- `SEED_OWNER_PASSWORD`
- `SEED_OWNER_NAME`

Operational names to define in production units:

- `AGM_POSTGRES_CONTAINER`
- `AGM_BACKUP_DIR`
- `AGM_BACKUP_RETENTION_COUNT`
- `AGM_BACKUP_MINIMUM_FREE_KIB`
- variables required by the approved independent alert channel

## 5. Domains and routes

Remain unchanged before approval:

- `app.agmcockpit.com` -> Cloudflare Pages;
- `agm-cockpit.pages.dev` -> Cloudflare Pages;
- `api.agmcockpit.com` -> current Windows production tunnel/origin;
- `validation-api.agmcockpit.com` -> Hetzner staging.

Cutover changes only the origin/route serving `api.agmcockpit.com`. Browser and Android
must keep the same public API base URL, so no emergency APK endpoint change is required.

The validation hostname must remain available until production PASS and rollback
closure.

## 6. Mandatory PASS gates

All must pass against the proposed production image and restored production copy:

- `/health/live`;
- `/health/ready`, including database;
- login and `/auth/me`;
- one controlled real translation;
- Turn Admin unlock/validate/change-PIN contract without changing the real PIN during
  smoke testing;
- incident create/read/resolve on dedicated test data;
- audit and validation-report creation;
- Pre-departure create/get/update/idempotency;
- Browser direct route, refresh, translation and Turn;
- Android translation, Turn and Pre-departure;
- API/PostgreSQL/cloudflared restart recovery;
- successful backup with checksum and `pg_restore --list`;
- complete restore into a disposable database;
- CORS for both public frontend origins;
- no public TCP access to PostgreSQL or API port 3000;
- no secrets in image, logs or reports.

## 7. Release identity

Production requires:

- Git commit SHA;
- clean release source or approved patch manifest;
- image digest;
- Prisma migration list;
- build/test evidence;
- database dump SHA-256;
- deployment timestamp;
- operator and validator approval;
- rollback target.

HEAD `9956eb1` cannot yet be the release identity while required local runtime changes
remain outside Git. A release checkpoint decision is required first.
