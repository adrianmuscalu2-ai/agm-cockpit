# AGM Cloud Migration - Stage 5 Production Cutover Readiness Plan

Date opened: 2026-07-17
Status: PLANNING ONLY - NO PRODUCTION CHANGE AUTHORIZED
Current primary: local infrastructure
Current validation: Hetzner VPS

## Objective

Prepare, rehearse, and validate every control required for a future production
cutover. Stage 5 planning does not authorize DNS, tunnel, database-write, APK, or
production traffic changes.

## Non-negotiable controls

- exactly one writable production database at any time;
- no sustained overlap between connectors backed by different databases;
- no production credential in Git, reports, screenshots, or chat;
- no cutover without a final consistent database backup and verified restore;
- no cutover without working monitoring and external alert delivery;
- no cutover without a timed rollback rehearsal;
- the Change Owner records an explicit GO before execution;
- any failed mandatory gate produces NO-GO.

## Stage structure

### Stage 5A - Readiness evidence

Allowed: read-only audits, validation-host tests, scripts, documentation, monitoring
preparation, and non-production backup rehearsals.

Required evidence:

1. Validation API remains continuously ready for at least 60 minutes.
2. API and security test suites pass against the approved release.
3. All six RO/DE/EN translation directions pass.
4. Short and maximum-approved-length texts pass.
5. OCR handoff, dictation, playback, and Email Assistant pass.
6. Android passes on Wi-Fi and 4G/5G on at least two devices.
7. Browser passes on Wi-Fi and mobile data.
8. API, PostgreSQL, and tunnel restart recovery pass.
9. Logs persist across container restart.
10. Automated backup, checksum, retention, and restore rehearsal pass.
11. Monitoring and external alert delivery are demonstrated.
12. No unresolved Critical or Major incident exists.

Stage 4 remains closed. Items not evidenced during Stage 4 are pre-cutover gates here,
not retroactive changes to the Stage 4 decision.

### Stage 5B - Non-production cutover rehearsal

The rehearsal must not use `api.agmcockpit.com` or the production tunnel.

Required sequence:

1. Record start time, operators, validators, and rollback authority.
2. Create a fresh local database dump in a controlled test window.
3. Record SHA-256, size, schema version, migration count, and per-table row counts.
4. Restore into a disposable VPS rehearsal database.
5. Run `prisma migrate status` or the equivalent approved migration check.
6. Compare all table counts and integrity controls.
7. Start a rehearsal API against only the disposable restored database.
8. Validate health, authentication, translation, and representative database reads.
9. Simulate connector stop/start using only the validation hostname.
10. Simulate rollback to the prior validation database.
11. Measure backup, restore, validation, switch, and rollback durations.
12. Preserve logs and record PASS or NO-GO.

Rehearsal acceptance targets:

```text
Target cutover interruption: 5-15 minutes
Maximum cutover decision window: 30 minutes
Rollback RTO target: 15 minutes
Maximum rollback target: 30 minutes
Data loss target: 0 acknowledged production writes
```

### Stage 5C - GO/NO-GO review

Named roles must be recorded:

| Role | Assignment |
|---|---|
| Change Owner | pending |
| Atlas / Technical Coordinator | Atlas |
| Infrastructure Operator | pending |
| Inspector / Independent Validator | pending |
| Application Validator | pending |
| Data Custodian | pending |
| Primary On-call | pending |
| Backup On-call | pending |

The review must approve:

- exact date, start time, timezone, and maintenance window;
- approved source release and image digest;
- production backup destination and retention;
- final row-count and schema controls;
- monitoring dashboard and alert recipients;
- communication message before and after cutover;
- exact cutover commands;
- exact rollback commands;
- conditions for cloud acceptance;
- conditions for mandatory rollback.

Only a written Stage 5C `GO` authorizes opening the cutover execution stage.

### Stage 5D - Controlled production cutover

Stage 5D remains locked until Stage 5A, 5B, and 5C pass.

Planned order:

1. Open the change record and confirm every assigned role is available.
2. Validate local production readiness and one real translation.
3. Enable the approved maintenance/write freeze.
4. Create the final PostgreSQL dump and evidence bundle.
5. Restore the final dump to cloud PostgreSQL.
6. Verify schema, migrations, row counts, and database target.
7. Verify cloud API privately.
8. Associate the cloud connector with the approved production tunnel.
9. Stop the local production connector before normal writes resume.
10. Test public readiness, translation, OCR, Android mobile data, and browser access.
11. Confirm public requests and writes reach only cloud.
12. Record ACCEPT or execute rollback.

There is no APK endpoint change in this plan. The public contract remains:

```text
https://api.agmcockpit.com/api/v1
```

## Monitoring gate

Minimum signals:

- public live and readiness every minute;
- synthetic translation every 5-15 minutes;
- HTTP 5xx and translation-unavailable rate;
- translation p50 and p95 latency;
- tunnel, API, and container restart counts;
- PostgreSQL availability and connection count;
- host CPU, RAM, disk, and clock;
- latest backup age and checksum result;
- OpenAI errors, timeout rate, and spending threshold.

Required observation windows:

```text
Intensive monitoring: first 2 hours
Heightened monitoring: first 24 hours
Migration acceptance: 72 hours without unresolved Major incident
```

Alerts must use an external channel that does not depend on AGM. Email is mandatory
for the initial migration; SMS or push is recommended for Critical alerts.

## Rollback triggers

- public API or readiness unavailable continuously for 5 minutes;
- translation failure rate above 20% over 10 minutes, excluding a confirmed provider
  outage affecting both environments;
- missing or corrupt data, schema mismatch, or wrong database target;
- suspected credential exposure or unauthorized access;
- failed recovery after one controlled cloud restart;
- unavailable monitoring, logs, or backups;
- a critical Android regression reproduced on two devices or networks;
- Inspector or Data Custodian blocks acceptance.

## Rollback principles

1. Stop cloud writes and the cloud production connector.
2. Determine whether any production write reached the cloud after final synchronization.
3. Never overwrite the local database blindly.
4. If cloud writes exist, export and validate the delta before local writes resume.
5. Verify local Docker, PostgreSQL, API, disk, clock, and private readiness.
6. Start the local connector only after Data Custodian approval.
7. Validate public readiness, translation, OCR, Android mobile data, and browser.
8. Confirm routing reaches only local infrastructure.
9. Preserve cloud logs and disks for investigation.

If reconciliation cannot be completed safely within 30 minutes, remain in controlled
maintenance. Two independent writable databases are never enabled as a shortcut.

## Initial gap register

| Required control | Current evidence | Gate |
|---|---|---|
| Dedicated cloud validation route | PASS | complete |
| External health and RO-DE translation | PASS | complete |
| Six translation directions | not yet recorded | 5A |
| Complete Android/browser workflow matrix | not yet recorded | 5A |
| Automated VPS backup and retention | first scheduled run passed; Step 4 officially closed | 5A |
| Restore into disposable rehearsal database | not yet performed | 5B |
| Persistent application/tunnel log evidence | host persistence confirmed; restart evidence pending | 5A |
| External monitoring and alert delivery | not yet implemented | 5A |
| Timed non-production rollback rehearsal | not yet performed | 5B |
| Named operational roles | pending | 5C |
| Approved maintenance window | pending | 5C |
| Explicit production GO | not granted | 5C |

## First decision gate

Recommended next action: approve **Stage 5A only**, beginning with monitoring and
backup/restore design. No production command is required for that work.
