# AGM Production pre-change checklist

Status: mandatory template. Completion does not authorize deployment.

## Change control

- [ ] Change ID and UTC window recorded.
- [ ] Gate 6 final verdict is GO / READY.
- [ ] Separate deployment/routing mandate attached.
- [ ] Command Lead on-duty identity and acknowledgement recorded.
- [ ] Independent Validator identity/session recorded and distinct from executor.
- [ ] Fallback Responsible identity and acknowledgement recorded.
- [ ] Rollback Responsible identity/session and acknowledgement recorded.
- [ ] STOP channel tested.

## Immutable identities

- [ ] Image ID equals
  `sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`.
- [ ] OCI revision equals
  `9956eb188fdd988bf0d7af93241c3c43962d9b39`.
- [ ] API container is `agm-production-api`.
- [ ] PostgreSQL container is `agm-postgres`.
- [ ] PostgreSQL volume is `app_agm_postgres_data`.
- [ ] Production tunnel ID is
  `1c7d88b4-f2bb-40bb-82b0-37da35ee30a9`.
- [ ] Production hostname is `api.agmcockpit.com`.

## Fallback capture

- [ ] Windows `Cloudflared` service is running and its start mode is recorded.
- [ ] Windows configuration checksum is recorded without exposing credentials.
- [ ] Active Production connector is exactly one `windows_amd64` connector.
- [ ] Fallback API live and ready pass.
- [ ] Fallback PostgreSQL is healthy.
- [ ] Unique public correlation request appears only in fallback API logs.
- [ ] Exact restart command and authorized operator are recorded.

## Hetzner target

- [ ] Approved image is loaded and independently verified.
- [ ] Compose hash and systemd unit hash match approved evidence.
- [ ] Protected environment integrity, owner and mode pass.
- [ ] `agm-postgres` is healthy and the only approved Production database container.
- [ ] Hetzner Production cloudflared config hash matches approved evidence.
- [ ] Hetzner Production connector and API remain inactive before the authorized
  transition.

## Data and migration

- [ ] Gate 6D is PASS.
- [ ] Approved source database and target database are identified.
- [ ] Final source dump and transferred dump checksums match.
- [ ] Restore, schema, row-count and integrity checks pass.
- [ ] Write freeze and single-writer control are active.
- [ ] Reconciliation owner and procedure are recorded.

## Rollback readiness

- [ ] Gate 6A runbook checksum matches approved evidence.
- [ ] Gate 6B role document checksum matches approved evidence.
- [ ] Gate 6C connector rollback plan checksum matches approved evidence.
- [ ] Rollback commands reviewed by Independent Validator.
- [ ] Abort triggers and SP0–SP5 acknowledged.
- [ ] Evidence directory and timestamp source are ready.

Any unchecked mandatory item is an automatic NO-GO.
