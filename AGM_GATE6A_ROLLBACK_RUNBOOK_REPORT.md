# AGM Gate 6A rollback runbook remediation report

Date: 2026-07-28
Scope: documentation and operational procedures only
Verdict: **PASS / REMEDIATED**

## Objective

Align the principal Production rollback runbook with the infrastructure identities
accepted in Gates 1–5, without executing or changing Production infrastructure.

## Changes

Updated `deploy/production/ROLLBACK_RUNBOOK.md`:

- replaced obsolete PostgreSQL container `agm-production-postgres` with
  `agm-postgres`;
- replaced obsolete volume `agm-production-postgres-data` with
  `app_agm_postgres_data`;
- added official API container `agm-production-api`;
- added official Docker network `app_default`;
- added the protected Production environment path;
- prohibited creation, renaming or substitution of the official PostgreSQL
  container and volume;
- replaced assumptions about a PC fallback and PC data source with references to the
  fallback and data decisions that must be approved in Gates 6C and 6D;
- made Gate 6B, 6C and 6D dependencies explicit;
- retained the requirement for a separate deployment or rollback mandate.

## Integrity

Updated runbook:

`deploy/production/ROLLBACK_RUNBOOK.md`

SHA-256:

`45e279a010abc6fc74280dc9d2108bd56ef1ce0ceb06c3aac1612bbdbd074cd5`

`git diff --check`: PASS.

## Consistency verification

### Gates 1–5

- Gate 1: no environment value, owner, permission or secret-management rule changed.
- Gate 2: runbook now uses exactly `agm-postgres` and
  `app_agm_postgres_data`.
- Gate 3: backup/restore identities and procedures are unchanged.
- Gate 4: runbook now matches `agm-production-api`, `app_default` and the approved
  lifecycle documentation.
- Gate 5: Cloudflare configuration and routing plan are unchanged.

### Gates 6B–6D

- Gate 6B remains responsible for naming Command, Independent Validator and fallback
  roles; Gate 6A did not nominate them.
- Gate 6C remains responsible for pre-change route capture and controlled routing
  rollback; Gate 6A did not execute or approve routing.
- Gate 6D remains responsible for the Production data source, migration,
  synchronization, write freeze and reconciliation; Gate 6A made no data-source
  decision.

### Emergent-conflict check

- no duplicate Production PostgreSQL identity was introduced;
- no service, DNS route, tunnel, migration or deployment command was executed;
- the runbook no longer embeds a fallback or data-source assumption that could
  conflict with later sub-gate decisions;
- historical reports retain obsolete names only as audit evidence of the prior
  nonconformity and are not operational instructions.

Consistency verdict: **PASS**.

## Conservation

- no Production infrastructure was accessed or modified;
- no service was started;
- no deployment, migration, DNS or Cloudflare operation occurred;
- no validated configuration file was modified.

## Final decision

Gate 6A is closed **PASS / REMEDIATED**.

This verdict does not close Gate 6, authorize Gate 6B or authorize deployment.
