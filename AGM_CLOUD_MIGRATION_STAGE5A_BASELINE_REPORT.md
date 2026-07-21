# AGM Cloud Migration - Stage 5A Backup and Logging Baseline

Date: 2026-07-17
Status: INVENTORY PASS - BACKUP AUTOMATION NOT YET IMPLEMENTED
Production changes: none

## Scope

This was a read-only inventory of the validation VPS. No service, timer, database,
tunnel, DNS record, production endpoint, or application configuration was changed.

## Capacity

```text
Root filesystem: 75 GiB
Used: 6.1 GiB (9%)
Available: 66 GiB
Inode usage: 4%
RAM available at check: 3.1 GiB
Swap: 2.0 GiB, unused
```

The VPS has sufficient local capacity for initial database backup rehearsals. Local
capacity alone is not a complete backup strategy.

## PostgreSQL

```text
Image: postgres:16-alpine
Container health: healthy
Restart policy: unless-stopped
pg_dump: 16.14
pg_restore: 16.14
Volume: app_agm_validation_postgres
Volume host path: /var/lib/docker/volumes/app_agm_validation_postgres/_data
```

Logical backups must use `pg_dump` from the running PostgreSQL container. Directly
copying the live Docker volume is not an approved consistent database backup method.

## Current backup state

```text
Directory: /opt/agm/backups
Owner: root:root
Mode: 0750
Existing backup: agm-stage0-20260717-161358.dump
Existing backup mode: 0600
Existing backup size: approximately 47 KiB
AGM backup systemd timer: absent
AGM backup cron job: absent
Automated retention: absent
Automated checksum verification: absent
Automated restore verification: absent
Off-site backup: absent
```

Finding: the Stage 0 dump is a verified migration artifact, but it is the only database
copy on the VPS disk. It does not provide operational backup coverage.

## Logging state

```text
Docker logging driver: json-file
Maximum Docker log file: 10 MiB
Rotated Docker files per container: 5
systemd journal storage: persistent
Journal disk usage observed: 41 MiB
```

API and PostgreSQL logs persist on the host and Docker rotation limits are active.
Cloudflared logs persist in the systemd journal.

Remaining logging work:

- define retention for the systemd journal;
- include backup success/failure in the journal;
- verify logs remain available after a controlled container restart;
- define off-host log or incident evidence retention for the migration window;
- connect failures to an external alert channel.

## Risk assessment

| Risk | Current level | Required control |
|---|---|---|
| VPS disk failure removes database and local backup | High | encrypted off-site copy |
| Backup silently fails | High | systemd failure status and external alert |
| Invalid dump remains undiscovered | High | automated checksum plus restore rehearsal |
| Disk fills with retained backups | Medium | retention and free-space gate |
| Backup contains personal or operational data | High | encryption, restricted access, retention |
| Docker logs rotate before incident review | Medium | evidence collection during cutover window |

## Recommended backup design

Initial validation implementation:

```text
Method: PostgreSQL custom-format logical dump
Scheduler: systemd service and timer
Frequency: daily during validation
Local retention: 7 daily copies
Integrity: SHA-256 manifest generated after every successful dump
Validation: pg_restore --list after every dump
Permissions: root:root, directory 0750, files 0600
Failure behavior: non-zero service exit and journal entry
Concurrency: lock prevents overlapping backup runs
Disk gate: refuse backup below an approved free-space threshold
```

Before production cutover:

```text
Off-site destination: mandatory, provider to be approved
Encryption: mandatory before transfer
Restore rehearsal: mandatory into a disposable database
Alert delivery: mandatory through a channel independent of AGM
Retention: approve daily/weekly policy and deletion audit
Recovery evidence: record restore time, schema, migrations, and row counts
```

Secrets must be read from the protected validation environment at runtime and must
never be copied into the backup script, timer, Git, reports, or command output.

## Decision

Stage 5A inventory result: **PASS**

Backup readiness result: **NO-GO until automation, off-site protection, alerting, and
restore rehearsal are implemented and validated**.

Recommended next single step: prepare the local-only backup script and systemd units
in the repository for review. Do not install or enable them on the VPS until that
review passes.
