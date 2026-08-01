# AGM Step 3D operational remediation matrix

Date: 2026-07-28

Overall state: **NOT READY — Gate 6 final re-audit pending**

Gate 6 remediation state: **6A PASS / 6B PASS / 6C PASS /
6D PASS / final consistency check PASS**

| Gate | Required evidence | Current evidence | Result |
|---|---|---|---|
| Approved API identity | Pinned digest and OCI revision | Compose pins `agm-api@sha256:b949e5...`; local container ran Image ID `sha256:b949e5...`; OCI revision previously verified as `9956eb1...` | PASS local |
| No image rebuild | No `build` key; pull disabled | Rendered production Compose has no `build`; `pull_policy: never` | PASS |
| Dedicated production configuration | Separate Compose project aligned to official infrastructure | Gate 4: API-only Compose installed; external `app_default`; zero PostgreSQL/volume declarations | PASS target |
| Environment contract | Required names documented; values redacted | `production.env.template`; placeholders contain no real secrets | PASS contract |
| Production environment values | Target file exists, mode 0600, required values pass validation | Gate 1 PASS: protected production env and manifest validated on target | PASS target |
| Single production PostgreSQL | One official container and one official data volume | Gate 2 decision: `agm-postgres` + `app_agm_postgres_data`; configuration alignment remains required | PASS identity |
| Existing Hetzner database inventory | Exactly one production DB/volume selected; legacy stacks classified | Gate 2 inventory classifies `cloud-*` as Validation and unattached `app_agm_validation_postgres` as Legacy | PASS target |
| API exposure | Loopback only | Local rendered/runtime binding `127.0.0.1:49157` | PASS local |
| PostgreSQL exposure | No host binding | Rendered/runtime PostgreSQL bindings: none | PASS local |
| Migration state | Five complete, zero partial | Local disposable database: 5 complete, 0 incomplete | PASS local |
| Backup procedure | Successful dump, checksum, restricted mode | Local dump 47,137 bytes; SHA-256 matched; script sets mode 0600 | PASS local |
| Backup target service | Timer/service targets production stack | New unit invokes the `agm-production` Compose `backup` service | PASS config |
| Target backup timer | Installed unit succeeds on Hetzner | Gate 3: target aligned to `agm-postgres`; controlled backup succeeded; timer active | PASS target |
| Restore rehearsal | Disposable restore completes and cleanup is proven | Gate 3 target rehearsal: restore exit 0, connectivity PASS, disposable cleanup PASS; source currently has zero user tables | PASS target |
| Rollback procedure | Documented, controlled rehearsal, clear authority | Gate 6A aligned the runbook; Gate 6B assigns separated responsibilities; Gate 6C tabletop validates SP0–SP5, abort triggers and connector rollback | PASS procedure |
| Cloudflare route rollback | Complete account inventory, saved route, approved commander, controlled target rehearsal | Gate 5 validates inventory/hostnames; Gate 6C establishes single-active connector transition, mandatory pre-change capture and rollback to the Windows fallback without DNS change | PASS procedure; live capture deferred to approved window |
| Production data cutover | Approved data source, target state, synchronization, write freeze, reconciliation and rollback | Gate 6D confirms PC operational source, empty Hetzner target, restored-copy rehearsal, freeze, migration 4→5, reconciliation and single-writer procedure | PASS procedure |
| Post-deployment checks | Health, ready, migrations, logs, connectivity | Checklist added under `deploy/production` | PASS document |
| Target static validation | `docker compose config`, permissions, systemd unit validation on Ubuntu | Gate 4: Compose config PASS; systemd verify PASS; unit disabled/inactive; API container absent | PASS target |

## READY rule

This matrix may become `READY` only after a separately authorized new Gate 6 final
audit returns GO / READY. Gate 6A–6D and the final consistency check are PASS, but no
deployment, routing change, migration or Production API startup is authorized.

The approved remediation sequence is Gate 6A (rollback runbook), Gate 6B
(operational responsibilities), Gate 6C (pre-change/fallback/routing rehearsal) and
Gate 6D (data and migration readiness). Every PASS must be followed by a consistency
check. Completion of any individual sub-gate does not authorize continuation or
deployment.
