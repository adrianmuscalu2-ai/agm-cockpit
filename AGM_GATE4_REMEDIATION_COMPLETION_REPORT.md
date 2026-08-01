# AGM Gate 4 remediation completion report

Date: 2026-07-28
Target: `agm-cloud-validation-01`
Verdict: **PASS / REMEDIATED**

## Official API lifecycle identity

- API container: `agm-production-api`
- API image:
  `agm-api@sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`
- OCI revision:
  `9956eb188fdd988bf0d7af93241c3c43962d9b39`
- systemd unit: `agm-production-api.service`
- Compose project: `agm-production`
- Production PostgreSQL: `agm-postgres`
- Production volume: `app_agm_postgres_data`
- external network: `app_default`
- database DNS alias used by the protected env: `postgres`

The official PostgreSQL container exposes both `agm-postgres` and `postgres` aliases
on `app_default`.

## Installed configuration

- `/opt/agm/production/compose.production.yml`
- `/etc/systemd/system/agm-production-api.service`
- `/opt/agm/production/API_LIFECYCLE_RUNBOOK.md`

Hashes:

- Compose:
  `d846006a6b24711976d3b5503d400323de125f073b0a42e1f604a15e410d4448`
- systemd unit:
  `52873bfe099b8e1cdeb2a243956b43b47eb08223c3bc4ac2a780c53660500c94`
- lifecycle runbook:
  `4107ff06614ccd3bcce5d8b496a008430eda15ae52b69f30c2a9edb28fe4a646`

Installation manifest:

`/opt/agm/change-backups/gate4-lifecycle-20260728/manifest.txt`

## Compose validation

- `docker compose config`: PASS
- services: `api` only
- `build` directive: absent
- image: exact approved digest
- `pull_policy`: `never`
- official container name: `agm-production-api`
- restart policy: `unless-stopped`
- host binding: `127.0.0.1:3000`
- external network key: `agm_production_database`
- external network name: `app_default`
- PostgreSQL service declarations: zero
- volume declarations: zero

The configuration cannot create a second PostgreSQL container or data volume.

## systemd lifecycle

- `systemd-analyze verify`: PASS
- dependency: `docker.service`
- start preflight: approved image digest must exist
- start preflight: `agm-postgres` must exist
- start: Compose `up --detach --no-build --no-deps api`
- stop: Compose stop of API only, with 30-second timeout
- reload: controlled restart of `agm-production-api`
- unit state: disabled
- active state: inactive
- API container count: zero

The unit intentionally remains disabled and inactive. Enabling or starting it requires
a separate deployment mandate.

## Production conservation

- `agm-postgres` ID remained:
  `415b23fe8f85080d82d90337c3d9c84c5727a4c0963b44bb9a3d5ace255d3c06`
- health remained: healthy
- start time remained:
  `2026-07-27T19:00:56.076568599Z`
- PostgreSQL was not restarted.
- No API container was created.
- No database access or migration occurred.
- No image was built, loaded, pulled or modified.
- No deployment occurred.

Gate 4 is closed with PASS for lifecycle definition, static installation and autostart
readiness. Activation remains prohibited until the deployment gate explicitly
authorizes it.

