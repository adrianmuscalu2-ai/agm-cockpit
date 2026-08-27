# AGM production rollback runbook

Status: prepared for controlled rehearsal; production execution requires separate approval.

## Immutable identities

- API image: exact prior `AGM_IMAGE` value captured in the approved pre-change rollback bundle.
- Web image: exact prior `AGM_WEB_IMAGE` value captured in the approved pre-change rollback bundle.
- API/Web revisions: exact prior `AGM_REVISION` and `AGM_WEB_REVISION` values from that bundle.
- Compose project: `agm-production`
- API container: `agm-production-api`
- PostgreSQL container: `agm-postgres`
- PostgreSQL data volume: `app_agm_postgres_data`
- PostgreSQL Docker network: `app_default`
- Protected Production environment:
  `/opt/agm/production/secrets/agm-production.env`

These are the only approved Hetzner Production identities. This runbook must not
create, rename or substitute a PostgreSQL container or volume.

## Authority and unresolved gates

Execution requires a separate deployment or rollback mandate from Turn Command
Center. Gate 6A validates this procedure only; it does not nominate personnel,
approve a route change or decide the Production data source.

Before execution:

- Gate 6B must identify the rollback commander, independent validator and fallback
  owner;
- Gate 6C must approve the captured pre-change route and controlled routing rollback;
- Gate 6D must approve the data source, synchronization, write freeze,
  reconciliation and database rollback policy.

## Preconditions

1. Record the current Cloudflare route and its checksum.
2. Confirm the currently approved fallback API, database and tunnel are healthy.
3. Record the final approved source-data dump checksum and retain it read-only.
4. Record the production image ID, OCI revision and Compose configuration hash.
5. Nominate one rollback commander and one independent validator.
6. Apply the Gate 6D approved single-writer and write-freeze procedure.

## Immediate rollback

1. Declare NO-GO and stop further migration or deployment actions.
2. Preserve the Hetzner API and PostgreSQL logs.
3. Disable the Hetzner write path without deleting its volume.
4. Restore the saved Cloudflare route to the Gate 6C approved fallback origin.
5. Verify that a unique correlation ID appears only in the approved fallback API
   logs.
6. Verify public live, ready, login and one controlled translation.
7. Reopen writes on the approved fallback only after the route and database source
   are confirmed.
8. If Hetzner accepted writes, keep both databases frozen until an audited
   reconciliation is approved.

## Controlled rehearsal gates

- Route restoration command is reviewed but not run against production.
- A local candidate API can be stopped without affecting the fallback service.
- The fallback live and ready checks remain successful.
- Candidate restart applies no pending migrations and returns ready.
- Backup checksum and disposable restore both pass.
- Evidence includes timestamps, image identity, migration state and log scan.

## Post-rollback PASS

- The public hostname reaches exactly one approved origin.
- Live and ready pass.
- Database dependency is available.
- No new writes reach the failed target.
- Evidence and database state are preserved.
- A new deployment requires a new approval.
