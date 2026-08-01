# AGM Gate 3 remediation completion report

Date: 2026-07-28
Target: `agm-cloud-validation-01`
Verdict: **PASS / REMEDIATED**

## Backup target remediation

Installed unit:

`/etc/systemd/system/agm-postgres-backup.service`

Target changed:

- before: `app-postgres-1`
- after: `agm-postgres`

Validation:

- official Production container healthy before change: PASS
- original target occurred exactly once: PASS
- old target absent after change: PASS
- `systemd-analyze verify`: PASS
- `systemctl daemon-reload`: PASS
- loaded environment contains `AGM_POSTGRES_CONTAINER=agm-postgres`: PASS
- unit owner/group/mode: `root:root / 0644`

Unit hashes:

- before:
  `3d9105c47e0daf83f5a386d3f291e42d9f2aca18c88ab193def7e39f8920d9ca`
- after:
  `a20f41a2c2737377148a2a0f454e01879306fa62c3dd989f8b830cc49c5a1b93`

Conservation evidence:

`/opt/agm/change-backups/gate3-backup-remediation-20260728`

The directory contains root-only before/after copies and a change manifest.

## Controlled production backup

- Service result: success
- Main process status: 0
- Target: `agm-postgres`
- Timer state after remediation: active
- Dump:
  `/opt/agm/backups/daily/agm-postgres-20260728T082500Z.dump`
- Manifest:
  `/opt/agm/backups/daily/agm-postgres-20260728T082500Z.sha256`
- Dump size: 796 bytes
- Dump mode: `0600`
- Manifest mode: `0600`
- SHA-256:
  `6996143d68adb4bfcc914ddd52a2d1a1349d8020adbdd17a675bf5e3de425f5f`
- Manifest comparison: PASS
- `pg_restore --list`: PASS

The backup procedure used `pg_dump` and did not write to the Production database.

## Restore rehearsal

Disposable resources:

- network: `agm-gate3-restore-network-20260728`
- volume: `agm-gate3-restore-data-20260728`
- container: `agm-gate3-restore-postgres-20260728`
- container ID:
  `1b94ebf6a3d72c13c49232e50a071a045e2d37f01f8150feeb1655fcfb26e2c3`

Validation:

- new disposable volume: PASS
- PostgreSQL health: healthy
- host port bindings: none
- restore exit status: 0
- restored database connectivity: PASS
- restored user-table count: 0
- disposable cleanup: PASS
- remaining disposable containers: 0
- remaining disposable volumes: 0
- remaining disposable networks: 0

The zero-table result confirms that the designated Production infrastructure currently
contains no user schema in this backup. It does not invalidate backup/restore
mechanics, but it must be considered by later data-readiness and migration gates.

## Production conservation

- Production container ID remained:
  `415b23fe8f85080d82d90337c3d9c84c5727a4c0963b44bb9a3d5ace255d3c06`
- Production health remained: healthy
- Production start time remained:
  `2026-07-27T19:00:56.076568599Z`
- PostgreSQL was not restarted.
- No Production schema or data was modified.
- No deployment, image rebuild, image transfer or migration occurred.

Gate 3 is closed with PASS for backup and restore procedure validation.

