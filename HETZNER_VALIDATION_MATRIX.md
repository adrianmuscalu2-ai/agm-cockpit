# AGM Hetzner — Production Validation Matrix

Date: 2026-07-27  
Current decision: **NOT READY**

`PASS (historical/current staging)` is not equivalent to production acceptance.

| Gate | Current evidence | Required final proof | Current result |
|---|---|---|---|
| Host resources | 66 GiB free, 3 GiB RAM available | load/soak under production copy | PASS staging |
| Firewall | UFW deny incoming except SSH; Step 2A moved old PostgreSQL to loopback | external scan shows only approved ports public | PASS for PostgreSQL exposure |
| Single PostgreSQL | two running PostgreSQL stacks | one approved private production DB | FAIL |
| DB source of truth | Step 2B proves PC `agm-postgres` contains and serves current operational data | coordinator acceptance and later verified dump | PASS identification |
| API release identity | image digest known, Git SHA unknown | approved SHA and image label/digest | FAIL |
| Prisma migrations | staging has 4 migrations | all 5 current migrations | FAIL |
| `/health/live` | local and validation URL pass | production URL after route change | PASS staging |
| `/health/ready` | DB available/provider configured | production URL after route change | PASS staging |
| Authentication | not tested in this audit | login plus `/auth/me` | PENDING |
| Translation | provider configured only in current audit | controlled real translation | PENDING |
| Turn Admin | module present in old API | unlock/validate contract test | PENDING |
| Incidents | model/API present | create/read/resolve test data | PENDING |
| Audit/traceability | model/API present | correlation and audit record proof | PENDING |
| Pre-departure sync | absent from installed migrations | create/get/update/idempotency | FAIL |
| Browser | validation API reachable | staging build full matrix | PENDING |
| Android | no current Hetzner staging APK test | device test while PC API unused | PENDING |
| API restart | restart policy configured | controlled restart recovery | PENDING |
| PostgreSQL restart | restart policy configured | controlled restart and API recovery | PENDING |
| cloudflared restart | service restart-on-failure | controlled restart and route recovery | PENDING |
| Backup | timer enabled but last run failed | successful current-target backup | FAIL |
| Checksum | historical manifests pass | new production-copy manifest | PASS historical only |
| Restore test | historical structural checks documented | full disposable restore of current copy | PENDING |
| Off-site backup | not observed | encrypted external copy | FAIL |
| Alerting | not verified on Hetzner | independent failure/recovery delivery | FAIL |
| CORS | validation route works | both public frontend origins | PENDING |
| Secrets | protected env file, values not exposed | image/log scan and permissions | PARTIAL |
| File permissions | `/opt/agm/app` broadly `0777` | root-owned, least privilege | FAIL |
| Cloudflare route rollback | current Windows route known operationally | saved/rehearsed exact rollback | PENDING |
| Android/Browser PC independence | not proven end-to-end | controlled PC-off test after staging PASS | PENDING |

## Cutover decision rule

Cutover is authorized only when every critical row is `PASS`, no row is `FAIL`, and
remaining `PENDING` rows are explicitly classified non-blocking by the Product Owner,
Release & Operations, Inspector/QA and Data Custodian.

Current blocking failures:

1. duplicate PostgreSQL stacks/source ambiguity;
2. stale unidentified API release;
3. missing Pre-departure migration;
4. failed backup timer;
5. no current full restore rehearsal;
6. no encrypted off-site backup;
7. no independent alerting;
8. insecure application-tree permissions;
9. no complete Browser/Android validation against Hetzner.

Step 2A evidence:

- previous mapping: host-wide `5432:5432`;
- current mapping: `127.0.0.1:5432:5432`;
- external TCP connection to Hetzner port `5432`: rejected/unreachable;
- `cloud-postgres-1`: same container ID, same start time, healthy;
- staging `/live` and `/ready`: PASS;
- current production `/live` and `/ready`: PASS;
- rollback configuration checksum:
  `f62a2e9f0529e37975156339a3100dbacf2a64fbc2c6162c161c663447551779`.

Step 2B evidence:

- current public API process uses PC PostgreSQL and holds an active connection;
- PC production contains operational records;
- Hetzner staging has the same four-migration schema but zero business rows;
- legacy Hetzner PostgreSQL has no Prisma schema;
- approved release contains a fifth, unapplied Pre-departure migration;
- all databases and volumes remained unchanged.
