# AGM Production data and migration cutover plan

Status: validated by Gate 6D as a procedure. Execution requires a distinct deployment
and data-cutover mandate.

## Authoritative decisions

### Operational data source

Until an approved cutover is accepted, the only operational Production data source is:

- host: Windows PC;
- container: `agm-postgres`;
- volume: `agm_agm_postgres_data`;
- current schema state: captured from `_prisma_migrations` immediately before the approved cutover;
- business data: present.

The PC source must not receive any candidate migration before extraction and must remain
the rollback source until post-cutover acceptance.

### Hetzner target

The approved target is:

- container: `agm-postgres`;
- volume: `app_agm_postgres_data`;
- current logical state: empty, zero AGM user tables;
- public host port: none for the approved final state.

The target is not a data source. Its current empty state may be replaced only under
the explicit data-cutover mandate after backup and checksum evidence.

### Schema and artefact source

- Git revision: `AGM_REVISION` from the approved release manifest;
- API image: immutable `AGM_IMAGE` digest from the same successful workflow run;
- target schema: exact ordered migration set, digest, and
  `AGM_EXPECTED_MIGRATION_COUNT` recorded in that manifest.

Historical reports and identities remain audit evidence, not current release authority.

## Migration assessment

Every migration present after the source snapshot must be reviewed from the approved
commit. Its effect and rollback boundary must be recorded in the release manifest.
No migration is assumed additive from an older report. The exact candidate set must
be rehearsed against a restored copy of the final source dump before Production changes.

## Mandatory rehearsal before cutover

Use a disposable PostgreSQL container, volume and network:

1. create a fresh custom-format dump from the PC Production source;
2. record dump size, UTC timestamp and SHA-256;
3. transfer it through the approved encrypted channel;
4. confirm the destination SHA-256 matches;
5. validate the archive with `pg_restore --list`;
6. restore into the disposable database with `--no-owner`, `--no-privileges` and
   `--exit-on-error`;
7. run `prisma migrate deploy` from the exact approved image/revision against only the
   disposable database;
8. confirm the manifest's exact migration set/count and zero failed, partial or rolled-back entries;
9. compare non-sensitive table counts and approved integrity digests with the source
   baseline;
10. run the approved API suites and functional smoke checks against the disposable
    restored copy;
11. test migration idempotence;
12. archive redacted evidence and remove all disposable resources.

Any mismatch blocks cutover. The current empty-database tests do not replace this
production-copy rehearsal.

## Final cutover transaction

### Phase D0 — preconditions

- Gate 6 final audit is GO / READY.
- A separate deployment/data-cutover mandate exists.
- Gate 6B on-duty identities and acknowledgements are recorded.
- Gate 6C pre-change checklist and fallback evidence are complete.
- The disposable production-copy rehearsal is PASS.
- Secret & Credentials Guardian confirms required credentials without disclosure.

### Phase D1 — baseline and target preservation

1. Fallback Responsible records source database health and four-migration state.
2. Execute and checksum a pre-freeze PC backup.
3. Execute and checksum a pre-import Hetzner target backup.
4. Preserve both manifests read-only.
5. Independent Validator verifies identities, timestamps and checksums.

### Phase D2 — write freeze and final source snapshot

1. Command Lead authorizes the write freeze.
2. Fallback Responsible blocks new Production writes while preserving health/read
   evidence.
3. Confirm no in-flight write remains.
4. Create the final consistent PC custom-format dump.
5. Record size, UTC timestamp and SHA-256.
6. Retain the PC database unchanged and frozen.

Failure to prove the freeze or snapshot integrity triggers STOP before any target
restore.

### Phase D3 — transfer and target restore

1. Transfer the dump only over the approved encrypted SSH/SCP channel.
2. Compare source and target SHA-256 values.
3. Validate `pg_restore --list`.
4. Confirm target identity is exactly `agm-postgres` /
   `app_agm_postgres_data`.
5. Restore into the approved empty Production database with exit-on-error.
6. Do not seed defaults or create substitute business records.

Checksum, target-identity or restore failure triggers STOP. The public route remains
on the frozen fallback until rollback or authorized continuation.

### Phase D4 — schema alignment

1. Run `prisma migrate deploy` from the approved image against only the restored
   Hetzner Production database.
2. Confirm migrations 1–5 are completed exactly once.
3. Confirm zero failed, partial or rolled-back migration entries.
4. Rerun `prisma migrate deploy` and confirm idempotence/no pending migration.

No manual SQL correction, schema edit or migration modification is allowed in the
window.

### Phase D5 — reconciliation

Independent Validator confirms, without exposing business content:

- every approved source table count equals the restored target count before the new
  Pre-Departure tables are considered;
- the two new Pre-Departure tables initially contain zero rows unless the frozen
  source already contained them under an approved forward-compatible state;
- approved aggregate integrity digests match for identifiers and immutable business
  fields;
- foreign-key and uniqueness checks pass;
- Company, User, Role, UserRole, TurnAdminCredential, TransportJob, audit, incident,
  evidence and ledger invariants pass;
- no unexpected table, schema or migration entry exists.

All raw reconciliation evidence containing identifiers remains restricted. Reports
contain only PASS/FAIL, counts and checksums approved for disclosure.

Any unexplained mismatch triggers STOP and rollback; it is never repaired ad hoc.

### Phase D6 — single-writer transition

1. Keep both databases write-frozen until D1–D5 pass.
2. Follow the Gate 6C single-active connector transition.
3. Verify public traffic reaches only `agm-production-api`.
4. After health and functional PASS, Command Lead explicitly declares Hetzner the
   authoritative writer.
5. Retain the PC database read-only as the rollback asset.

Dual-write is prohibited.

## Rollback and reconciliation rules

### Before any Hetzner Production write

- stop the Hetzner API/connector path;
- restore the Windows fallback connector;
- verify the PC source remains unchanged;
- remove the PC write freeze only after route confirmation.

No reverse data transfer is required.

### After any Hetzner Production write

- freeze both databases;
- preserve the last accepted correlation ID and UTC timestamp;
- do not overwrite either database;
- export the affected target audit range under a separate data-reconciliation
  authorization;
- reconcile by correlation ID and business entity;
- require Data Custodian/Product Owner approval before applying audited forward
  reconciliation;
- keep the incident open until divergence is resolved.

Automatic reverse synchronization and last-write-wins are prohibited.

## Role ownership

- Command Lead: authorizes freeze, continuation, authoritative-writer declaration and
  rollback.
- Independent Validator: verifies checksums, migrations, counts, invariants and
  single-writer evidence.
- Fallback Responsible: operates the PC freeze, dump and fallback reopening.
- Rollback Responsible: executes only authorized target/connector rollback actions.
- Secret & Credentials Guardian: handles credentials only under its existing
  authorization rules.

## Stop and abort criteria

STOP on:

- wrong source or target identity;
- dump/transfer checksum mismatch;
- incomplete write freeze;
- failed restore or migration;
- migration set/count mismatch against the approved release manifest;
- failed idempotence;
- reconciliation mismatch;
- missing role identity or independent verdict;
- simultaneous writers or Production connectors;
- secret exposure or unexpected data output.

No remediation inside the cutover window is permitted without a new mandate.
