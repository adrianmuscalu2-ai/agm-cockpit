# AGM Cloud Migration - Stage 3 Validation Deployment Report

Date: 2026-07-17
Stage: 3 - AGM API and PostgreSQL deployment in the isolated validation environment
Status: PASS - OFFICIALLY VALIDATED
Production cutover: NOT STARTED
Cloudflare Tunnel configuration: NOT STARTED
Public validation route: NOT CREATED

## Scope and safety boundary

The local PC remains `PRIMARY`. The VPS remains `VALIDATION`.

Stage 3 deployed a private copy of PostgreSQL and the AGM API on the VPS. The API is
bound only to `127.0.0.1:3000`; PostgreSQL has no host port. No DNS record, production
tunnel, APK endpoint, or production traffic was changed.

## Deployment definition

```text
API runtime: Node.js 22, Debian Bookworm slim
Database: PostgreSQL 16 Alpine
Compose network: private Docker bridge
API host binding: 127.0.0.1:3000
PostgreSQL host binding: none
Restart policy: unless-stopped
Secrets file: /opt/agm/secrets/agm-validation.env, root:root, mode 0600
Application root: /opt/agm/app
Backup root: /opt/agm/backups
```

The validation database password and JWT secret were generated directly on the VPS.
The OpenAI credential was transferred without printing it and is not stored in Git.

Repository controls:

```text
.dockerignore
deploy/cloud/api.Dockerfile
deploy/cloud/compose.validation.yml
deploy/cloud/prepare-validation-host.sh
deploy/cloud/validate-restored-database.sql
deploy/cloud/validate-validation-runtime.sh
```

## Database restoration

Stage 0 backup:

```text
File: agm-stage0-20260717-161358.dump
SHA-256: BD0CE2FBF5DD87F2D3F6EA83833B61F834A34DCD48F47CB5E7F2BEEBD89EC64B
Remote permissions: root:root, mode 0600
Restore flags: --exit-on-error --no-owner --no-privileges
```

The local and remote hashes match.

| Table | Stage 0 | Restored |
|---|---:|---:|
| AuditEvent | 21 | 21 |
| BusinessValidationReport | 12 | 12 |
| Company | 1 | 1 |
| EvidenceMetadata | 1 | 1 |
| FinancialLedger | 1 | 1 |
| IncidentReport | 1 | 1 |
| LifecycleState | 14 | 14 |
| Role | 1 | 1 |
| TransportJob | 6 | 6 |
| TransportJobStateHistory | 12 | 12 |
| TurnAdminCredential | 1 | 1 |
| User | 1 | 1 |
| UserRole | 1 | 1 |
| _prisma_migrations | 4 | 4 |

Result: all 14 table counts match the Stage 0 baseline.

## Runtime validation

Readiness response confirmed:

```text
service: agm-api
status: ready
database: available
translationProvider: configured
```

A real Romanian-to-German request completed through the VPS API and OpenAI provider:

```text
Input: Validare AGM Cloud fara trafic public.
Output: AGM Cloud Validierung ohne oeffentlichen Verkehr.
available: true
provider: openai
```

Observed steady-state container memory before reboot:

```text
API: approximately 48 MiB
PostgreSQL: approximately 29 MiB
```

The values are point-in-time observations, not capacity limits. Load and latency
benchmarks remain required before production sizing.

## Restart recovery

The VPS was rebooted after the initial validation.

- PostgreSQL returned automatically and became healthy;
- the API waited for PostgreSQL and became healthy;
- readiness passed after reboot;
- a second real translation passed after reboot;
- the API remained bound only to localhost;
- Cloudflared remained absent as a service and inactive.

## Security and exposure validation

| Check | Result |
|---|---|
| API container healthy | PASS |
| PostgreSQL container healthy | PASS |
| API bound only to `127.0.0.1:3000` | PASS |
| PostgreSQL not published on the host | PASS |
| Only SSH publicly listening | PASS |
| Secrets excluded from Git | PASS |
| Secrets file mode `0600` | PASS |
| Database restore count comparison | PASS |
| Real translation before reboot | PASS |
| Automatic recovery after reboot | PASS |
| Real translation after reboot | PASS |
| Cloudflared service absent/inactive | PASS |
| DNS or production endpoint changed | NO |
| Production traffic changed | NO |

## Rollback position

The production service remains independent on the local infrastructure. Stage 3 can
be rolled back without production impact by stopping the validation Compose project
and, if required, removing its containers and named validation volume.

The Stage 0 dump remains the immutable restore source. The VPS database is a validation
copy and must not become a second writer while local infrastructure is primary.

## Open items before public validation

- define and approve a dedicated Cloudflare validation hostname;
- create a separate validation tunnel credential;
- keep the production hostname and tunnel unchanged;
- validate HTTPS, DNS, CORS, and proxy headers through the temporary route;
- run external Wi-Fi and 4G/5G tests against the validation hostname;
- benchmark translation latency and resource use under repeated load;
- configure persistent database backup automation and retention;
- configure monitoring and incident alerting;
- document and rehearse the production cutover and rollback commands;
- reassess the 4 GB VPS against measured production and Premium demand.

## Stage 3 decision

Technical result: **PASS**

Recommended gate decision: **GO for a separate, non-production Cloudflare validation
route**, subject to explicit human approval. Production cutover remains prohibited.

## Human validation

```text
Change Owner: AGM Project Owner
Inspector: AGM team
Decision: PASS - Stage 3 closed; Stage 4 approved
Validated at: 2026-07-17
```
