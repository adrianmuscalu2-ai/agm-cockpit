# AGM Cloud Migration - Stage 0 Gate Report

Date: 2026-07-17
Stage: 0 - Baseline, build verification, backup and isolated restore
Status: READY FOR HUMAN VALIDATION
Production cutover: NOT STARTED
Cloud provisioning: NOT STARTED

## Scope

This stage verifies that the current AGM Basic RC4 baseline is identifiable,
rebuildable, externally operational, and recoverable from a PostgreSQL backup before
any VPS is purchased or configured.

No production route, API contract, application logic, Cloudflare Tunnel, or production
database was modified.

## Baseline evidence

```text
Git branch: ag-018-latency-instrumentation
Git commit: 61825152beeca206ecb268890394bc8507ac48a9
APK: apps/web/android/app/build/outputs/apk/debug/AGM-Basic-Home-RC4.apk
APK size: 7,520,637 bytes
APK SHA-256: 3EDC88FE88D63263FB34C45FD7BABA8CD24F9FFE131AB489C067B4D80DFF8375
Public API: https://api.agmcockpit.com/api/v1
```

The worktree contains existing uncommitted project work. It was not reset, reverted,
or included in a new release during this stage.

## Build and automated test results

| Check | Result |
|---|---|
| API Jest suites | PASS, 3/3 |
| API tests | PASS, 11/11 |
| API NestJS build | PASS |
| Web TypeScript/Vite production build | PASS |
| Production endpoint validator | PASS |
| Public endpoint occurrences in built JS | 2 |
| Forbidden localhost/LAN endpoint occurrences | 0 |

No APK was regenerated during Stage 0. The validated RC4 APK hash remains the release
reference.

## External baseline

Checked at: 2026-07-17 16:16:39 Europe/Berlin

| Check | Result |
|---|---|
| Public readiness | `ready` |
| PostgreSQL dependency | `available` |
| Translation provider configuration | `configured` |
| Real RO to DE translation | PASS |
| Provider returned by API | `openai` |
| Translation duration | 2,635 ms |

## Backup evidence

```text
Format: PostgreSQL custom archive (`pg_dump -Fc`)
File: .tmp/migration-stage0/agm-stage0-20260717-161358.dump
Size: 47,798 bytes
SHA-256: BD0CE2FBF5DD87F2D3F6EA83833B61F834A34DCD48F47CB5E7F2BEEBD89EC64B
Source database: agm
Restore database: agm_migration_restore_20260717
```

The restore database is isolated from the production database. The production
database was not dropped, overwritten, migrated, or made unavailable.

## Restore integrity evidence

| Table | Source | Restored | Match |
|---|---:|---:|---|
| AuditEvent | 21 | 21 | PASS |
| BusinessValidationReport | 12 | 12 | PASS |
| Company | 1 | 1 | PASS |
| EvidenceMetadata | 1 | 1 | PASS |
| FinancialLedger | 1 | 1 | PASS |
| IncidentReport | 1 | 1 | PASS |
| LifecycleState | 14 | 14 | PASS |
| Role | 1 | 1 | PASS |
| TransportJob | 6 | 6 | PASS |
| TransportJobStateHistory | 12 | 12 | PASS |
| TurnAdminCredential | 1 | 1 | PASS |
| User | 1 | 1 | PASS |
| UserRole | 1 | 1 | PASS |
| _prisma_migrations | 4 | 4 | PASS |

Restored Prisma migrations:

```text
20260702171528_init
20260702185645_add_evidence_metadata
20260702191656_add_incident_reports
20260714090500_add_turn_admin_credential
```

All table counts and completed migration names match.

## Stage 0 decision

Technical result: **PASS**

Recommended gate decision: **GO for Stage 1 provisioning**, subject to explicit human
validation of this report.

Stage 1 must remain limited to:

- creation of the approved x86 VPS in Germany;
- Ubuntu 24.04 LTS installation and access hardening;
- firewall, time synchronization, and security updates;
- installation of Docker Engine/Compose;
- creation of deployment secrets outside Git;
- no production DNS/tunnel cutover;
- no production database write routing.

The cloud environment must remain `VALIDATION` and the local environment must remain
`PRIMARY` throughout Stage 1.

## Human validation

```text
Change Owner: pending
Inspector: pending
Decision: pending
Validated at: pending
```

## Latency clarification and controlled benchmark

Benchmark date: 2026-07-17
Infrastructure: current local production API through the existing Cloudflare Tunnel
Cloud migration influence: none; VPS provisioning and cutover had not started

### Historical test reconstruction

| Test | Text | Characters | Equivalent measured tokens | End-to-end latency |
|---|---|---:|---:|---:|
| Incident follow-up | `Verificare publică după incidentul temporar.` | 44 | 74 input + 15 output = 89 | 1,794 ms |
| Stage 0 baseline | `Validare externă înainte de migrarea controlată.` | 48 | 75 input + 11 output = 86 | 2,635 ms |

The token values were obtained afterward by replaying the same production prompt and
model directly against OpenAI with explicit UTF-8 encoding. They are equivalent prompt
measurements, not token telemetry captured during the original two requests.

Both tests used:

```text
Configured model: gpt-4.1-mini
Resolved snapshot during measurement: gpt-4.1-mini-2025-04-14
Translation timeout: 20,000 ms
Public endpoint: https://api.agmcockpit.com/api/v1
Source/target: Romanian to German
```

The reported historical durations were measured by the audit client around the entire
public HTTP request:

```text
audit client -> Cloudflare -> cloudflared -> AGM API -> OpenAI -> AGM API -> client
```

They were not OpenAI-only durations.

The AGM API process had been running continuously since 2026-07-16 13:34
Europe/Berlin. The historical requests were therefore not AGM API cold starts. OpenAI
infrastructure state is external and cannot be classified as warm or cold from AGM
logs.

The two historical texts differ by only four characters and had similar total token
usage. Text length alone does not explain the 839 ms latency difference.

### Controlled 20-run benchmark

Benchmark text:

```text
AGM Translator funcționează corect pe date mobile.
```

Text and token profile:

```text
Characters: 50
UTF-8 bytes: 52
Input tokens: 76
Output tokens: 12
Total tokens: 88
Cached input tokens: 0
Model snapshot: gpt-4.1-mini-2025-04-14
```

All 20 public translation requests succeeded. Requests were spaced by three seconds to
avoid triggering the API's per-minute throttle.

End-to-end durations in chronological order:

```text
1385, 2057, 1438, 906, 1205, 1118, 1292, 1175, 1563, 1045,
1108, 894, 1139, 936, 1288, 1102, 980, 1349, 1010, 1136 ms
```

| End-to-end statistic | Result |
|---|---:|
| Successful requests | 20/20 |
| Mean | 1,206.30 ms |
| Median | 1,137.50 ms |
| Minimum | 894 ms |
| Maximum | 2,057 ms |
| p95, nearest-rank | 1,563 ms |

The matching OpenAI fetch durations recorded inside the AGM API were:

```text
1013, 1899, 1333, 795, 1090, 1008, 1173, 1067, 1455, 944,
1001, 791, 1026, 824, 1170, 989, 877, 1244, 876, 1006 ms
```

| OpenAI fetch statistic | Result |
|---|---:|
| Samples | 20 |
| Mean | 1,079.05 ms |
| Median | 1,010.50 ms |
| Minimum | 791 ms |
| Maximum | 1,899 ms |
| p95, nearest-rank | 1,455 ms |

Average public-path overhead for this series was approximately 127.25 ms. This includes
Cloudflare, local tunnel transit, NestJS processing, JSON serialization, and client
measurement overhead.

### Benchmark conclusion

- The 1,794 ms and 2,635 ms historical values are single samples and should not be
  compared as trend data.
- Their texts and token counts were similar, so text length is not the primary
  explanation.
- The controlled sample demonstrates normal request-to-request provider variation,
  with successful requests ranging from 894 to 2,057 ms end-to-end.
- The Stage 0 value of 2,635 ms is above the controlled 20-run maximum, but remains
  below the configured 20-second timeout and was followed by 20/20 successful requests.
- No cloud configuration influenced either historical result or the benchmark.
- There is no evidence of latency degradation. Establish trend alerts only from
  repeated benchmarks using the same text, model, route, spacing, and percentile
  method.

Recommended initial performance baseline:

```text
Success rate: 100% in the controlled sample
Median target: <= 1,500 ms
p95 observation threshold: <= 3,000 ms
Timeout/failure threshold: existing 20,000 ms pending future evidence
```
