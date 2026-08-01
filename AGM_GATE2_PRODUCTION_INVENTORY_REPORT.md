# AGM Gate 2 production inventory report

Date: 2026-07-28
Target: `agm-cloud-validation-01`
Mode: remote Docker metadata inventory, read-only
Verdict: **FAIL / NOT READY — STOP at Gate 2**

## Gate requirement

Confirm exactly one approved production PostgreSQL instance and exactly one approved
production data volume, with no source-of-truth ambiguity.

## Current container inventory

| Container | Image | State | Host exposure |
|---|---|---|---|
| `agm-postgres` | `postgres:16-alpine` | healthy | `127.0.0.1:5432` |
| `cloud-postgres-1` | `postgres:16-alpine` | healthy | no published host port |
| `cloud-api-1` | `agm-api:validation` | healthy | `127.0.0.1:3000` |

PostgreSQL containers currently active: **2**

## Current volume inventory

- `app_agm_postgres_data`
- `app_agm_validation_postgres`
- `cloud_agm_validation_postgres`

PostgreSQL-related volumes present: **3**

## Approved production identity check

- Container matching `agm-production-postgres`: **0**
- Volume matching `agm-production-postgres-data`: **0**

## Finding

The target does not currently contain one uniquely identified production database and
volume. It contains two active PostgreSQL containers and three historical/current
volumes, while the approved production container and volume do not yet exist.

This is a blocking source-of-truth and resource-classification ambiguity. Gate 2 cannot
be closed by selecting, renaming, attaching, deleting or creating resources without a
separate remediation mandate.

## Stop and conservation

The mandatory STOP rule was applied at Gate 2.

- No database connection was opened.
- No schemas, records, row counts or environment values were read.
- No container, volume, network or port mapping was changed.
- No backup or restore was executed.
- No systemd or Cloudflare operation was executed.
- No deployment, image transfer, image rebuild or migration occurred.

## Required remediation decision

Coordination must explicitly define:

1. the unique production PostgreSQL container identity;
2. the unique production data-volume identity;
3. the disposition of `agm-postgres`, `cloud-postgres-1` and all three existing
   volumes;
4. which resources must remain untouched as staging, legacy or archival evidence;
5. whether the approved production database/volume should be created empty before a
   later controlled restore;
6. a separate authorization for any resource creation, attachment, stop, rename,
   archival or deletion.

