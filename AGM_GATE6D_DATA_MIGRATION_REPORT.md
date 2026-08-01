# AGM Gate 6D data and migration readiness report

Date: 2026-07-28
Scope: plans, procedures and existing evidence only
Verdict: **PASS / REMEDIATED**

## Source and target decision

Official operational source until accepted cutover:

- PC `agm-postgres`;
- PC volume `agm_agm_postgres_data`;
- four completed migrations;
- current Production business data.

Approved Hetzner target:

- `agm-postgres`;
- `app_agm_postgres_data`;
- currently empty logical state;
- never treated as a source.

Schema and artefact authority:

- revision `9956eb188fdd988bf0d7af93241c3c43962d9b39`;
- image
  `sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`;
- five migrations.

## Migration validation

The fifth migration was inspected directly from the approved Git revision. It creates
the Pre-Departure session/answer tables, indexes and foreign keys and performs no
drop, rename, existing-column alteration, row update or row deletion.

Required sequence:

`PC source dump (4 migrations) -> restore -> prisma migrate deploy -> 5 migrations ->
reconciliation -> single-writer transition`

Migration of the PC source itself is prohibited.

## Procedure validation

`deploy/production/DATA_MIGRATION_CUTOVER_PLAN.md` defines:

- mandatory disposable rehearsal against a restored Production copy;
- encrypted transfer with matching SHA-256;
- pre-import backup of the empty Hetzner target;
- write freeze and in-flight-write drain;
- exact source and target identities;
- restore with exit-on-error and no seed;
- one controlled `prisma migrate deploy` plus idempotence check;
- count, digest, constraint and business-invariant reconciliation;
- single-writer transition;
- different rollback treatment before and after the first Hetzner write;
- STOP criteria and prohibition of ad-hoc repair.

The live rehearsal, dump, restore and migration remain execution-window prerequisites
and were not performed by Gate 6D.

## Consistency verification

- Gate 1: credentials remain under Secret & Credentials Guardian control.
- Gate 2: Hetzner target identities remain `agm-postgres` and
  `app_agm_postgres_data`; PC source identity is explicitly host-qualified and does
  not redefine Hetzner Production infrastructure.
- Gate 3: existing backup and disposable restore evidence remains valid; the new plan
  adds the missing Production-copy migration rehearsal.
- Gate 4: approved image, API container and lifecycle remain unchanged.
- Gate 5: no Cloudflare or hostname decision changed.
- Gate 6A: rollback before/after target writes follows the approved runbook and
  preserves both databases on divergence.
- Gate 6B: Command, validation, fallback, rollback and secret responsibilities remain
  separated.
- Gate 6C: SP2 blocks connector transition until data freeze/reconciliation PASS;
  single-writer and single-active-connector rules agree.

Historical documents describing the Hetzner target as legacy/empty or the release as
not yet approved are retained as time-scoped evidence. Later Gate 2 and Step 3A-R/3B
decisions supersede those classifications without rewriting history.

No technical/operational contradiction was introduced.

Consistency verdict: **PASS**.

## Conservation

- no database content was accessed or modified;
- no dump, transfer, restore or migration executed;
- no Production service started;
- no deployment, DNS, Cloudflare or infrastructure change;
- documentation only.

## Final decision

Gate 6D is closed **PASS / REMEDIATED**.

This verdict validates readiness of the controlled procedure. It does not authorize
its execution, close Gate 6 or authorize deployment.
