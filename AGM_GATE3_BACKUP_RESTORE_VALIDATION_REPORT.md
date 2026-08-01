# AGM Gate 3 backup and restore validation report

Date: 2026-07-28
Target: `agm-cloud-validation-01`
Mode: backup procedure preflight, read-only
Verdict: **FAIL / NOT READY — STOP before backup execution**

## Official production target

- PostgreSQL container: `agm-postgres`
- PostgreSQL volume: `app_agm_postgres_data`

## Installed backup procedure

- Service: `agm-postgres-backup.service`
- Timer: `agm-postgres-backup.timer`
- Script: `/usr/local/sbin/agm-postgres-backup`
- Script owner/group/mode: `root:root / 0750`
- Script SHA-256:
  `072d4797bd4bb417b6d5f3105fc5dff2a0ebc7024a0dcf19c21d82d843567341`
- Backup directory: `/opt/agm/backups/daily`
- Directory owner/group/mode: `root:root / 0750`

## Blocking nonconformity

The installed systemd service defines:

`AGM_POSTGRES_CONTAINER=app-postgres-1`

The official Production container is:

`agm-postgres`

The configured target does not exist in the current container inventory and does not
match the Gate 2 authoritative Production identity.

Observed service state:

- `ActiveState=failed`
- `SubState=failed`
- `Result=exit-code`
- `ExecMainStatus=1`

Observed timer state:

- enabled: yes
- active: yes
- state: waiting
- last trigger: 2026-07-28 02:21:47 UTC
- next scheduled trigger: 2026-07-29 02:22:43 UTC

Without remediation, the next scheduled execution is expected to fail for the same
target mismatch.

## Historical backup files

Mode-0600 dump and SHA-256 files exist under `/opt/agm/backups/daily`, with timestamps
from 18–23 July 2026. They predate the current Gate 2 Production designation and do
not prove that the installed procedure can back up the official container now.

No historical dump was opened or restored during this gate.

## Stop decision

The Gate 3 procedure requires proving the backup target before database access.
Because the configured target is not the official Production container, the mandatory
STOP rule was applied before running the service.

Consequently:

- no new backup was executed;
- no database connection or `pg_dump` occurred;
- no checksum was generated for a new backup;
- no restore rehearsal was started;
- no disposable database/container/volume was created.

## Conservation

- No production data, schema or migration was read or modified.
- No service or timer was started, stopped, enabled, disabled or reloaded.
- No unit, script, container, volume or backup file was modified.
- No deployment, transfer, image rebuild or artefact change occurred.

## Required remediation

A separate Turn Command Center mandate must authorize:

1. changing the installed backup target from `app-postgres-1` to `agm-postgres`;
2. validating the updated systemd unit;
3. reloading systemd without restarting PostgreSQL;
4. running one controlled backup;
5. verifying dump mode, SHA-256 and `pg_restore --list`;
6. restoring the dump only into an isolated disposable target;
7. removing the disposable restore target after evidence collection.

