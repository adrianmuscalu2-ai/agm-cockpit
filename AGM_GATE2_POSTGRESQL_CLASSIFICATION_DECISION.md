# AGM Gate 2 PostgreSQL classification decision

Date: 2026-07-28
Authority: Turn Command Center Gate 2 remediation mandate
Scope: metadata classification and designation only
Decision state: **AUTHORITATIVE**

## Single official production identity

The only PostgreSQL infrastructure pair designated as AGM Production is:

- Container: `agm-postgres`
- Container ID at classification:
  `415b23fe8f85080d82d90337c3d9c84c5727a4c0963b44bb9a3d5ace255d3c06`
- Volume: `app_agm_postgres_data`
- Relationship:
  `agm-postgres` mounts `app_agm_postgres_data` at
  `/var/lib/postgresql/data` read-write.
- Compose project/service: `app` / `postgres`
- Compose source observed:
  `/opt/agm/app/docker-compose.yml`
- Network: `app_default`
- Current host binding: `127.0.0.1:5432`

Classification: **Production — official infrastructure identity**

This decision designates infrastructure identity only. It does not assert that the
database contents, schema, migrations, backup state or production application are
ready. Those remain subject to their own gates.

## Complete resource classification

### Containers

| Resource | Classification | Evidence |
|---|---|---|
| `agm-postgres` | **Production** | Project `app`; mounts the designated production volume |
| `cloud-postgres-1` | **Validation** | Project `cloud`; service `postgres`; source `compose.validation.yml`; network `cloud_agm_validation` |

No PostgreSQL container is classified as Temporary.

### Volumes

| Resource | Classification | Attachment |
|---|---|---|
| `app_agm_postgres_data` | **Production** | `agm-postgres` |
| `cloud_agm_validation_postgres` | **Validation** | `cloud-postgres-1` |
| `app_agm_validation_postgres` | **Legacy** | none |

No volume is classified as Temporary.

## Exclusivity rule

Only the following pair may be called `Production` in subsequent AGM operations:

`agm-postgres` + `app_agm_postgres_data`

The Validation and Legacy resources must not be used as production sources, targets,
fallbacks or restore destinations without a new Turn Command Center decision.

## Configuration alignment warning

The locally prepared `deploy/production/compose.production.yml` currently declares
different planned names (`agm-production-postgres` and
`agm-production-postgres-data`). It must not be executed as-is because it would create
a second production-labelled pair and violate this decision.

Alignment of that configuration is a separate controlled remediation. This Gate 2
decision does not authorize editing, transferring or running the Compose file.

## Conservation

- No database content was accessed.
- No container or volume was created, renamed, stopped, restarted, attached, detached
  or deleted.
- No schema, data, backup, restore, migration or deployment action occurred.

