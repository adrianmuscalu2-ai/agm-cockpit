# AGM PostgreSQL — Source of Truth Reconciliation

Date: 2026-07-27  
Step: 2B  
Mode: strict read-only  
Result: **PASS — source of truth identified; no database changed**

## 1. Canonical decision

Two different truths must not be conflated:

- **Operational data source of truth:** the PC container `agm-postgres`, volume
  `agm_agm_postgres_data`.
- **Target schema source of truth:** Git release base
  `9956eb188fdd988bf0d7af93241c3c43962d9b39`, branch
  `release/hetzner-staging`.

The current public production API runs as a Node process on the PC, uses the local
PostgreSQL endpoint and maintains an active connection to PC `agm-postgres`. The
public production `/ready` endpoint confirms that dependency is available.

The data source and schema source are not yet aligned: the release contains five
Prisma migrations, while the PC production database contains four. No migration was
executed during this audit.

## 2. Relationship diagram

```text
PUBLIC PRODUCTION
api.agmcockpit.com
        |
        v
Windows cloudflared -> PC Node API
                         |
                         v active connection
PC agm-postgres
  volume: agm_agm_postgres_data
  role: CURRENT OPERATIONAL DATA TRUTH


PC DEVELOPMENT
agm-development-postgres
  volume: agm-development_agm_development_postgres_data
  role: development only; empty/non-migrated


HETZNER STAGING
validation-api.agmcockpit.com
        |
        v
cloudflared -> cloud-api-1
                    |
                    v private Docker connection
             cloud-postgres-1
               volume: cloud_agm_validation_postgres
               role: active staging DB; schema present, business data empty


HETZNER LEGACY
agm-postgres
  volume: app_agm_postgres_data
  role: legacy empty database; no Prisma schema

app_agm_validation_postgres
  attached containers: none
  role: orphan historical validation volume; contents not logically inventoried
```

## 3. Instance comparison

| Host / instance | Effective consumer | Volume | DB size | Schema | Migrations | Business data |
|---|---|---|---:|---|---:|---|
| PC `agm-postgres` | current public Node API | `agm_agm_postgres_data` | 8,985,623 B | AGM schema, signature `2757f56a477fd2dbe0890670ee15e33d` | 4 | Present |
| PC `agm-development-postgres` | development environment | `agm-development_agm_development_postgres_data` | 8,428,567 B | AGM tables without migration registry, signature `df61e5a6170ec44194047286c2431a78` | 0/registry absent | Empty |
| Hetzner `cloud-postgres-1` | `cloud-api-1` staging | `cloud_agm_validation_postgres` | 8,477,719 B | same signature as PC production | 4 | Empty |
| Hetzner `agm-postgres` | no application client | `app_agm_postgres_data` | 7,699,479 B | no Prisma schema | 0/registry absent | No AGM tables |

The Hetzner orphan volume `app_agm_validation_postgres` is PostgreSQL 16 data,
66,330,357 bytes on disk, created 17 July and currently attached to no container. It
was not mounted or started during this read-only step, so its logical schema/data
remain **unknown**.

## 4. Volume comparison

| Host | Volume | Approximate disk use | Attachment | Classification |
|---|---|---:|---|---|
| PC | `agm_agm_postgres_data` | 74.72 MB | `agm-postgres` | authoritative operational data |
| PC | `agm-development_agm_development_postgres_data` | 48.52 MB | development container | development only |
| Hetzner | `cloud_agm_validation_postgres` | 48,905,857 B | `cloud-postgres-1` | active staging |
| Hetzner | `app_agm_postgres_data` | 48,127,617 B | legacy `agm-postgres` | archive/elimination candidate |
| Hetzner | `app_agm_validation_postgres` | 66,330,357 B | none | archive candidate; unknown contents |

## 5. Aggregated data comparison

No business content was read or displayed. Only table counts were queried.

PC production contains:

| Table | Rows |
|---|---:|
| `Company` | 1 |
| `User` | 1 |
| `Role` | 1 |
| `UserRole` | 1 |
| `LifecycleState` | 14 |
| `TransportJob` | 6 |
| `TransportJobStateHistory` | 12 |
| `BusinessValidationReport` | 12 |
| `AuditEvent` | 21 |
| `EvidenceMetadata` | 1 |
| `IncidentReport` | 1 |
| `FinancialLedger` | 1 |
| `TurnAdminCredential` | 1 |

All corresponding business tables in `cloud-postgres-1` contain zero rows. The PC
development database also contains zero rows. The legacy Hetzner database has no AGM
tables.

## 6. Migration comparison

Present in both PC production and Hetzner staging:

1. `20260702171528_init`
2. `20260702185645_add_evidence_metadata`
3. `20260702191656_add_incident_reports`
4. `20260714090500_add_turn_admin_credential`

Additionally present in the approved release source, but not applied to either
database:

5. `20260726031500_add_pre_departure_sync`

Therefore:

- PC production is the current data truth, but not yet the target schema;
- Hetzner staging mirrors the old schema but not production data;
- the release must be tested against a copy of production data before any schema
  alignment or cutover.

## 7. Classification

### A. Official current truth

`PC agm-postgres` / `agm_agm_postgres_data` for operational data.

### B. Archive candidates

- Hetzner `app_agm_validation_postgres`: mandatory archive/inventory candidate because
  its logical contents are unknown.
- Hetzner `app_agm_postgres_data`: legacy empty-schema volume.

### C. Potential later elimination

- `app_agm_postgres_data`, only after a checksumed archival snapshot and explicit
  approval.
- `app_agm_validation_postgres`, only after controlled read-only logical inventory,
  archival decision and explicit approval.

No volume is approved for deletion by Step 2B.

### D. Databases to retain

- PC production volume: retain as authoritative source and rollback asset.
- Hetzner staging volume: retain for staging until a new isolated production-copy
  rehearsal environment is approved.
- PC development volume: retain or recreate only under the independent development
  lifecycle; it is irrelevant to production truth.

## 8. Risks by option

### Treat PC production as truth — recommended

- Benefit: only instance containing current operational records and serving production.
- Risk: it lacks the fifth migration.
- Control: take a verified dump, restore to disposable Hetzner, then test migration.

### Treat Hetzner staging as truth — rejected

- Risk: all business tables are empty; selecting it would discard current production
  state.

### Treat legacy Hetzner database as truth — rejected

- Risk: it has no AGM Prisma schema.

### Treat orphan volume as truth — not supportable

- Risk: logical contents are unknown and it has no active consumer.
- Control: preserve until a separately approved forensic inventory.

## 9. Final recommendation

Use the PC production database as the only source for the future rehearsal dump and
final cutover dump. Do not apply migrations to it as part of source extraction.

For staging:

1. create a separate disposable Hetzner database/volume in a later approved step;
2. restore a verified copy of PC production;
3. apply the fifth migration only to that disposable copy;
4. validate schema, counts and application behavior;
5. keep `cloud-postgres-1` unchanged until the rehearsal passes.

Step 2B performed no stop, restart, dump, import, export, migration, write, volume
attachment, configuration change or infrastructure mutation.
