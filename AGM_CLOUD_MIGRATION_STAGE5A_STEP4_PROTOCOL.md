# AGM Cloud Migration - Stage 5A Step 4 Timer Activation Protocol

Date prepared: 2026-07-17
Status: PREPARED - ACTIVATION NOT AUTHORIZED
Environment: VALIDATION only
Production changes: prohibited

## Objective

Activate the installed PostgreSQL backup timer in a controlled manner, prove that
systemd scheduling invokes the validated backup service, and verify the resulting
artifact without affecting production.

## Verified starting state

```text
Installed script hash:
072d4797bd4bb417b6d5f3105fc5dff2a0ebc7024a0dcf19c21d82d843567341

Installed service hash:
3d9105c47e0daf83f5a386d3f291e42d9f2aca18c88ab193def7e39f8920d9ca

Installed timer hash:
d407c65259bbbe3c5b4efcb9eee054db6997b7775cd56ae689faea968203403d

Timer enabled: no
Timer active: no
Last timer trigger: none
Existing validated daily backup: 1
PostgreSQL health: healthy
API health: healthy
```

The installed hashes match the repository artifacts. The existing backup SHA-256
still matches its manifest.

## Approved schedule proposal

```text
Base schedule: daily at 02:15 UTC
Europe/Berlin summer time: 04:15 local
Europe/Berlin winter time: 03:15 local
Randomized delay: 0-15 minutes
Expected execution window: 02:15-02:30 UTC
Timer persistence: enabled
```

UTC is intentional so daylight-saving changes do not create ambiguous or skipped
calendar times.

## Important first-activation behavior

The timer contains:

```text
Persistent=true
```

When first activated after a scheduled time has already passed, systemd may immediately
start the backup service to catch up with the missed run. Therefore, activation approval
must also authorize:

- at most one immediate timer-triggered validation backup;
- creation of one additional dump and SHA-256 manifest;
- inspection of the resulting service and timer logs.

If more than one new dump appears, execution stops and the timer is disabled.

## Preconditions

- Change Owner explicitly approves timer activation and the possible immediate run;
- PostgreSQL and API are healthy;
- at least 1 GiB is free;
- installed hashes match the approved values;
- exactly one pre-existing daily dump is present;
- no manual backup service execution is active;
- production remains `PRIMARY`;
- validation remains `VALIDATION`.

## Controlled execution

1. Record UTC and Europe/Berlin start times.
2. Reconfirm installed hashes and container health.
3. Record the exact pre-activation backup file list.
4. Run:

   ```text
   systemctl enable --now agm-postgres-backup.timer
   ```

5. Observe timer and service state without manually starting the service.
6. If the persistent timer triggers immediately, wait for that single service run to
   reach `Result=success`.
7. Verify the next scheduled execution timestamp.
8. Confirm exactly zero or one new dump exists.
9. If a new dump exists, verify:
   - non-empty file;
   - owner and mode;
   - SHA-256 manifest;
   - `pg_restore --list`;
   - backup success journal entry.
10. Confirm PostgreSQL, API, tunnel, and external readiness remain healthy.
11. Record PASS or execute the stop procedure.

No manual service start is part of this timer test.

## Stop conditions

Immediately disable and stop the timer if:

- installed hashes differ;
- PostgreSQL or API is unhealthy;
- more than one backup service invocation occurs;
- the dump or manifest is missing, empty, or invalid;
- checksum validation fails;
- service logs expose credentials;
- free space falls below the approved threshold;
- production health changes unexpectedly.

## Stop and rollback procedure

```text
systemctl disable --now agm-postgres-backup.timer
```

Then:

- confirm the timer is `disabled/inactive`;
- preserve service and timer logs;
- preserve any valid dump;
- quarantine, rather than silently trust, an invalid or partial artifact;
- do not alter PostgreSQL or restart production services;
- record the anomaly and require a new approval before retry.

## Acceptance criteria

- timer is `enabled/active`;
- next execution is displayed in the approved UTC window;
- no more than one catch-up backup occurred;
- any generated dump and manifest pass all integrity checks;
- backup service finished successfully;
- API and PostgreSQL remain healthy;
- external readiness remains `ready`;
- production remains unchanged;
- evidence is recorded and independently validated.

## Decision gate

Preparation result: **PASS**

Timer activation remains **NOT AUTHORIZED** until the Change Owner explicitly approves
the possible immediate catch-up backup described above.
