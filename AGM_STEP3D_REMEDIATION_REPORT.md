# AGM Step 3D remediation report

Date: 2026-07-28
Mode: local preparation and isolated rehearsal
Result: **PARTIAL PASS / NOT READY FOR STEP 3C RE-AUDIT**

## Artefact conservation

- Approved image:
  `agm-api@sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`
- Effective local runtime Image ID:
  `sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`
- OCI revision:
  `9956eb188fdd988bf0d7af93241c3c43962d9b39`
- The API image was not rebuilt or modified.

## Files prepared

- `deploy/production/compose.production.yml`
- `deploy/production/production.env.template`
- `deploy/production/backup-postgres.sh`
- `deploy/production/restore-rehearsal.sh`
- `deploy/production/agm-production-backup.service`
- `deploy/production/agm-production-backup.timer`
- `deploy/production/ROLLBACK_RUNBOOK.md`
- `deploy/production/POST_DEPLOYMENT_CHECKLIST.md`
- `AGM_STEP3D_OPERATIONAL_MATRIX.md`

## Static validation

- API `build` key absent.
- API image fixed by approved digest.
- PostgreSQL image fixed by digest.
- Pull policy set to `never`.
- One PostgreSQL service.
- One named data volume: `agm-production-postgres-data`.
- PostgreSQL host ports: none.
- API host binding: loopback only.
- One private Docker network.
- DATABASE_URL resolves through the `postgres` service name.
- Backup and restore script syntax: PASS.

## Local isolated rehearsal

- API health: healthy.
- PostgreSQL health: healthy.
- API Image ID: exact approved ID.
- PostgreSQL host port: none.
- Complete migrations: 5.
- Incomplete migrations: 0.
- Backup result: success.
- Dump size: 47,137 bytes.
- Dump SHA-256:
  `038bb5e86420f3ab1a8ec02a567b31a058e67abaa713288a95eb01c50737cee3`.
- SHA-256 manifest comparison: PASS.
- Disposable restore: PASS.
- Restored migrations: 5 complete, 0 incomplete.
- Fallback ready before candidate stop: PASS.
- Fallback ready while candidate stopped: PASS.
- PostgreSQL remained healthy: PASS.
- Candidate recovery: PASS.
- Candidate restart migration result: no pending migrations.

All database operations in this rehearsal targeted a new disposable local Docker
volume. No PC or Hetzner database was accessed.

## Remaining target-side gates

The following cannot be closed without a separately approved, read-only or controlled
Hetzner validation:

1. Install and validate the actual protected production environment file.
2. Confirm mode 0600 and required variable names without printing values.
3. Re-inventory existing Hetzner databases and volumes.
4. Select exactly one production database/volume and prove legacy stacks are not used.
5. Install and run the remediated backup unit.
6. Perform a target backup and disposable restore.
7. Validate the systemd unit on Ubuntu.
8. Save and checksum the current Cloudflare route.
9. Nominate the rollback commander and rehearse the target route rollback under
   separate approval.

Step 3D must remain open until these target-side gates have evidence. No deployment,
transfer, Cloudflare change or Hetzner mutation was performed.

