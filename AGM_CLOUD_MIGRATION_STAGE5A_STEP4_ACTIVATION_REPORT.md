# AGM Cloud Migration - Stage 5A Step 4 Timer Activation Report

Date: 2026-07-17
Status: PASS - OFFICIALLY CLOSED
Environment: VALIDATION only
Production changes: none

## Authorized action

The approved PostgreSQL backup timer was enabled and started. No manual backup service
start was performed.

## Pre-activation controls

| Check | Result |
|---|---|
| Installed script hash matches approved artifact | PASS |
| Installed service hash matches approved artifact | PASS |
| Installed timer hash matches approved artifact | PASS |
| PostgreSQL health | healthy |
| API health | healthy |
| Existing daily dump count | 1 |
| Existing backup integrity | PASS |
| Timer state | disabled/inactive |

## Activation

```text
Activation time: 2026-07-17T19:58:01Z
Command class: systemctl enable --now
Timer enabled: yes
Timer active: yes
Immediate catch-up run: no
Post-activation dump count: 1
```

The `Persistent=true` timer did not invoke a catch-up backup on this activation.

## Next scheduled execution

```text
Next trigger: 2026-07-18 02:21:45 UTC
Base schedule: 02:15 UTC
Applied randomized delay: 6 minutes 45 seconds
Expected Europe/Berlin time: 04:21:45 CEST
```

The next trigger is inside the approved `02:15-02:30 UTC` window.

## Immediate post-activation validation

| Check | Result |
|---|---|
| Timer journal records successful start | PASS |
| Unexpected service invocation | NONE |
| Additional backup created | NO |
| PostgreSQL health | healthy |
| API health | healthy |
| Cloudflared state | active |
| External readiness | ready |
| External database dependency | available |
| Translation provider state | configured |
| Production configuration changed | NO |

## Remaining acceptance gate

Step 4 is not yet complete. After the first scheduled trigger, verify:

- timer `Last` and next-trigger values;
- exactly one new dump and manifest;
- service `Result=success` and exit status 0;
- file owner, mode, size, and non-empty state;
- SHA-256 against the manifest;
- complete `pg_restore --list`;
- PostgreSQL, API, tunnel, and external readiness;
- no unexpected repeated invocation;
- production remains unchanged.

## Decision

Activation result: **PASS**

Stage 5A Step 4 final result: **PASS**

## First scheduled run

```text
Triggered: 2026-07-18 02:21:51 UTC
Service result: success
Exit status: 0
Backup file: agm-postgres-20260718T022151Z.dump
Backup size: 48,744 bytes
SHA-256: a06b013c4eeb848b2e192b870ffef0a0328e882fbfe133c6b859d93ddcecb1de
Post-run dump count: 2
Post-run manifest count: 2
Next trigger: 2026-07-19 02:21:24 UTC
```

Validation evidence:

- dump and manifest are owned by root with mode `0600`;
- recomputed SHA-256 matches the manifest;
- PostgreSQL 16.14 custom-format catalog contains 85 TOC entries;
- `pg_restore --list` completed through the final foreign-key constraints;
- temporary validation copy was removed;
- PostgreSQL and API remained healthy with zero restarts;
- Cloudflared remained active with zero restarts;
- no backup or Cloudflared warnings were recorded;
- external readiness and real RO-DE translation passed through validation and primary;
- zero failed systemd units were present;
- production configuration and traffic were not changed.

## Human validation

```text
Change Owner: AGM Project Owner
Inspector: AGM team
Decision: PASS - Stage 5A Step 4 officially closed
Validated at: 2026-07-18
```
