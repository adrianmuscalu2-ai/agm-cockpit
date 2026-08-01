# AGM Gate 2 remediation completion report

Date: 2026-07-28
Target: `agm-cloud-validation-01`
Mode: Docker metadata classification and read-only rerun
Verdict: **PASS / REMEDIATED**

## Official production identity

- Container: `agm-postgres`
- Container ID:
  `415b23fe8f85080d82d90337c3d9c84c5727a4c0963b44bb9a3d5ace255d3c06`
- Volume: `app_agm_postgres_data`
- Mount:
  `app_agm_postgres_data` -> `/var/lib/postgresql/data` (read-write)
- Compose project/service: `app` / `postgres`
- Network: `app_default`
- PostgreSQL host exposure: loopback only

The pair above is the only infrastructure identity classified as Production.

## Complete classification

### Containers

- `agm-postgres`: **Production**
- `cloud-postgres-1`: **Validation**

### Volumes

- `app_agm_postgres_data`: **Production**
- `cloud_agm_validation_postgres`: **Validation**
- `app_agm_validation_postgres`: **Legacy**, unattached

Temporary PostgreSQL resources: none.
Unclassified PostgreSQL containers: zero.
Unclassified PostgreSQL volumes: zero.

## Read-only Gate 2 rerun

- Production container identity unchanged: PASS
- Production container running and healthy: PASS
- Production container-volume relationship: PASS
- PostgreSQL exposure restricted to `127.0.0.1`: PASS
- Validation container Compose source is `compose.validation.yml`: PASS
- Validation volume relationship: PASS
- Legacy volume unattached: PASS
- Every PostgreSQL container classified: PASS
- Every PostgreSQL volume classified: PASS

## Configuration warning

`deploy/production/compose.production.yml` still declares planned names different from
this authoritative identity. It remains prohibited from execution until a separate
configuration-alignment remediation is approved. Running it as-is would create a
second production-labelled PostgreSQL pair.

Gate 2 PASS designates infrastructure identity only. It does not validate database
contents, schema, migrations, backup or restore.

## Conservation

- No database content was accessed.
- No container, volume, network or service was changed.
- No backup, restore, migration, deployment or restart occurred.
- No artefact was rebuilt or transferred.

Gate 2 is closed with PASS. The process may continue to Gate 3 under its applicable
mandate.
