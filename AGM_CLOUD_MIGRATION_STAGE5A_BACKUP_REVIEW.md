# AGM Cloud Migration - Stage 5A Backup Automation Review

Date: 2026-07-17
Status: STATIC REVIEW PASS - NOT INSTALLED
Production changes: none
Validation database backup executed: no

## Prepared artifacts

```text
deploy/cloud/backup-postgres.sh
deploy/cloud/agm-postgres-backup.service
deploy/cloud/agm-postgres-backup.timer
```

## Implemented controls

- PostgreSQL custom-format logical dump;
- atomic publication through temporary files and rename;
- restrictive process umask and output permissions;
- PostgreSQL container existence and health gate;
- database identity read from the running container without printing the password;
- approved backup-root path check;
- minimum free-space gate of 1 GiB;
- non-overlapping execution through `flock`;
- non-empty dump check;
- structural validation through `pg_restore --list`;
- SHA-256 sidecar manifest;
- seven-copy local retention;
- fixed UTC schedule with randomized delay;
- persistent systemd timer behavior after downtime;
- systemd filesystem and privilege hardening.

## Static validation

| Check | Result |
|---|---|
| Bash syntax on Ubuntu VPS | PASS |
| Git whitespace validation | PASS |
| Secret or production-route references | NONE |
| systemd directives parsed | PASS |
| Installed executable present | EXPECTED NO |
| Backup service installed | NO |
| Backup timer installed | NO |
| Backup timer active | NO |
| Temporary review files removed | YES |
| Database dump executed | NO |

`systemd-analyze verify` reported that
`/usr/local/sbin/agm-postgres-backup` does not exist. This is the expected result for
repository-only review and proves that the executable was not installed. No unknown
unit directive or unit syntax error was reported before that deployment dependency.

## Remaining gates

- human approval of the script, retention count, schedule, and free-space threshold;
- controlled installation on the validation VPS;
- one manually triggered validation backup;
- checksum and `pg_restore --list` evidence;
- second run to verify naming and concurrency behavior;
- controlled retention test using disposable files only;
- timer activation and next-run verification;
- restore rehearsal into a disposable PostgreSQL database;
- encrypted off-site destination and external failure alerting.

## Decision

Repository preparation result: **PASS**

Installation and execution remain **NOT AUTHORIZED** until the next explicit approval.
