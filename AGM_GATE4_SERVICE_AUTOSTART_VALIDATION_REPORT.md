# AGM Gate 4 service and autostart validation report

Date: 2026-07-28
Target: `agm-cloud-validation-01`
Mode: systemd and Docker metadata validation, read-only
Verdict: **FAIL / NOT READY — STOP at Gate 4**

## Validated operational components

### Docker

- `docker.service`: enabled and active
- `docker.socket`: enabled and active

### Production PostgreSQL

- container: `agm-postgres`
- classification: Production
- running: yes
- health: healthy
- restart policy: `unless-stopped`
- Compose project/service: `app` / `postgres`

The Docker restart policy provides automatic restart after Docker/host recovery unless
the container was explicitly stopped.

### Backup

- `agm-postgres-backup.timer`: enabled, active, waiting
- timer triggers: `agm-postgres-backup.service`
- loaded backup target: `agm-postgres`
- backup service dependency: `docker.service`
- service type: oneshot; inactive between executions
- service enablement: disabled, which is normal because it is timer-triggered
- service and timer `systemd-analyze verify`: PASS
- last controlled execution result from Gate 3: success

### Cloudflare

- `cloudflared.service`: enabled and active

No `ExecStart`, token, credential value or protected Cloudflare configuration was
printed during Gate 4.

## Blocking nonconformity

There is no installed Production API service identity:

- container named `agm-production-api`: 0
- systemd unit named `agm-production-api.service`: 0

The only running API container is:

- `cloud-api-1`
- Compose project: `cloud`
- Compose service: `api`
- classification: Validation
- restart policy: `unless-stopped`

It cannot be treated as the Production API service.

The locally prepared `deploy/production/compose.production.yml` is not installed and
remains prohibited from execution because its PostgreSQL names do not match the Gate
2 authoritative Production identity.

Therefore Gate 4 cannot confirm that an official Production API has an approved,
predictable startup and service-management mechanism.

## Stop and conservation

- No service or timer was started, stopped, enabled, disabled, reloaded or restarted.
- No systemd unit or Docker restart policy was modified.
- No container, image, network or volume was changed.
- No database access, migration, backup, restore or deployment occurred.
- No Cloudflare secret or command line was displayed.

## Required remediation

A separate mandate must authorize configuration alignment and installation preparation
without deploying the API:

1. align the Production service configuration with the official pair
   `agm-postgres` + `app_agm_postgres_data`;
2. ensure it does not create a second PostgreSQL container or volume;
3. fix the API image by the approved digest and prohibit `build`;
4. define the official API lifecycle mechanism (Compose with restart policy and/or a
   systemd wrapper);
5. validate dependencies on Docker, the official PostgreSQL health state and the
   protected Production env file;
6. run `docker compose config` and `systemd-analyze verify` on Ubuntu without starting
   the API;
7. rerun Gate 4 read-only.

