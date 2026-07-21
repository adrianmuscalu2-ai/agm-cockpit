# AGM Cloud Migration - Stage 5A Step 3 Backup Installation Report

Date: 2026-07-17
Status: PASS - OFFICIALLY VALIDATED
Environment: VALIDATION only
Production changes: none

## Authorized scope

- install the reviewed backup script and systemd units on the validation VPS;
- keep the timer disabled;
- execute exactly one manual PostgreSQL backup;
- validate integrity, structure, permissions, logs, and service health.

No production database, tunnel, DNS record, endpoint, APK, or traffic was changed.

## Installed artifacts

| Artifact | Owner | Mode | SHA-256 |
|---|---|---:|---|
| `/usr/local/sbin/agm-postgres-backup` | root:root | 0750 | `072d4797bd4bb417b6d5f3105fc5dff2a0ebc7024a0dcf19c21d82d843567341` |
| `/etc/systemd/system/agm-postgres-backup.service` | root:root | 0644 | `3d9105c47e0daf83f5a386d3f291e42d9f2aca18c88ab193def7e39f8920d9ca` |
| `/etc/systemd/system/agm-postgres-backup.timer` | root:root | 0644 | `d407c65259bbbe3c5b4efcb9eee054db6997b7775cd56ae689faea968203403d` |

Uploaded and repository hashes matched before installation. Bash syntax and installed
systemd unit validation passed.

## Manual execution

Exactly one manual service start was performed.

```text
Service result: success
Exit status: 0
Backup file: agm-postgres-20260717T194638Z.dump
Backup size: 48,744 bytes
SHA-256: d761ef790219fd6f8f8b74e6a4fcf7fec751a0b02c6f35b7635400d677d62cd8
```

The journal recorded one successful start and completion. No automatic retry or
second backup execution occurred.

## Independent validation

| Check | Result |
|---|---|
| Dump is non-empty | PASS |
| Dump mode is `0600` | PASS |
| Manifest mode is `0600` | PASS |
| Dump and manifest owner is root | PASS |
| Recomputed SHA-256 matches manifest | PASS |
| `pg_restore --list` reads the complete catalog | PASS |
| Temporary validation copy removed from container | PASS |
| PostgreSQL container health after backup | healthy |
| API container health after backup | healthy |
| External readiness after backup | ready |
| Database dependency after backup | available |
| Translation provider after backup | configured |

`pg_restore --list` is a structural dump validation. A full restore into a disposable
database remains a separate mandatory rehearsal and was not performed in this step.

## Timer state

```text
Installed: yes
Enabled: no
Active: no
Automatic backup executed: no
```

The timer remains `disabled/inactive` pending a separate approval.

## Observations

The protected backup directory correctly denied unprivileged traversal by `agmops`.
Validation continued through explicit `sudo`; this is expected access-control behavior,
not a backup defect.

## Decision

Technical result: **PASS**

Recommended decision: validate Stage 5A Step 3. Do not enable the timer until the next
explicit gate approves scheduling and a controlled timer test.

## Human validation

```text
Change Owner: AGM Project Owner
Inspector: AGM team
Decision: PASS - Stage 5A Step 3 officially validated
Validated at: 2026-07-17
```
