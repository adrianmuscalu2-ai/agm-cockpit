# TURN real-state audit and reconciliation

Date: 2026-08-25  
Scope: `runtime real → registry canonic → adapter/state propagation → Turn`  
Initial verdict: `TURN STATE RECONCILIATION = FAIL / OPEN`

## Findings and corrections

| Subject | Runtime evidence | Canonical registry / lifecycle | Adapter propagation | Turn before | Correction | Owner / cause |
|---|---|---|---|---|---|---|
| Android / MON-005 | Device `SM-S931B` authorized. AGM was not running during the first probe, then was launched in foreground. API returned `ONLINE`, `LIVE`, `HEARTBEAT_CURRENT`, last failure `null`. | `monitor-android` remains `monitoring`; target availability is derived from the tenant-bound persistent heartbeat. | `POST /operations/components/android/heartbeat` HTTP 201; `GET /operations/components/android/health` HTTP 200. | A stale state could remain visible while AGM was not running; after the live cycle Turn reconciled to `ONLINE / LIVE`, incident `NONE`. | No forced green. Foreground heartbeat produces LIVE; background/stopped beyond 90 seconds produces STALE. | Android runtime / MON-005. Initial ADB failure was local PATH configuration, recovered without installation. |
| AG-011-011A | APP-006 routes and executes RO/DE normalization. Contract test PASS. | Was `planned`; implementation and provenance exist. | Direct deterministic service routing to `AG-011-011A`. | `planned`. | Registry promoted to `active` with validated reliability and implementation provenance. | AI Agents / stale declarative registry. |
| AG-011-011B | APP-006 routes and executes RO/EN normalization. Contract test PASS. | Was `planned`; implementation and provenance exist. | Direct deterministic service routing to `AG-011-011B`. | `planned`. | Registry promoted to `active` with validated reliability and implementation provenance. | AI Agents / stale declarative registry. |
| AG-011-011C | APP-006 routes and executes DE/EN normalization. Contract test PASS. | Was `planned`; implementation and provenance exist. | Direct deterministic service routing to `AG-011-011C`. | `planned`. | Registry promoted to `active` with validated reliability and implementation provenance. | AI Agents / stale declarative registry. |
| `agent-inspector` | Latest persistent event was an intentionally negative acceptance mandate ending `FAILED` at `2026-08-24T20:27:19.225Z`; failure: missing negative-path evidence fixture. | Agent lifecycle remains `active`; terminal mandate result is last-run evidence, not agent availability. | The live-state adapter incorrectly overwrote the registry row with the terminal event. | Red / `FAILED` indefinitely. | Last-run lifecycle is stored separately (`data-last-runtime-*`) and remains visible in runtime history; it no longer overwrites agent availability. | QA & Validation / state-domain conflation. |
| Inspector Șef Monitorizare | Existing canonical identity: `chief-monitoring-inspector` in the Turn organization registry. | Coordinator identity is separate from MON-010. | Status is aggregated from MON-001–MON-012; incomplete telemetry remains degraded, not green. | Label reused `MON-010`, conflating chief and incident monitor. | Chief is mapped to its canonical organization identity; MON-010 remains Agent Monitorizare Incidente. | Monitoring / identity alias defect. |
| Operational panel identities | Adrian, Mentor, Atlas and monitoring identities have canonical records. Orion, Nexa and GeminII had no canonical operational record. | Two missing mappings were resolvable; three nodes were decorative-only. | Five nodes were emitted as `PLANNED / UNMAPPED`. | Five unjustified planned nodes. | Adrian and Mentor mapped; decorative-only nodes removed; mapping report now `14 mapped / 0 unmapped`. | Turn UI adapter / noncanonical source list. |
| Inspector `ATENȚIE` reports | Reports were last checked on `2026-07-13T20:00:00Z`. | Historical inspector archive, not current runtime telemetry. | Static records were counted as live current attention. | Current `ATENȚIE` despite six-week-old data. | Reports remain visible and auditable, but are marked `SNAPSHOT ISTORIC / STALE` and excluded from current attention count. | Inspector archive / freshness not modeled. |

## States deliberately not promoted

- Server Backup remains `PLANNED / NOT VERIFIED`: local backup design exists, but live heartbeat, restore gate and off-site target are not demonstrated.
- AI Governance remains planned where no canonical runtime agent has been demonstrated.
- Inspector Șef aggregate remains degraded whenever any monitoring source is stale, failed or has no telemetry.
- Android becomes stale after 90 seconds without a foreground heartbeat; an open phone or connected ADB device alone is not proof that AGM is running.

## Evidence

- Android direct runtime audit: `2026-08-25T05:59:33Z`, `ONLINE / LIVE`, health HTTP 200, runtime events HTTP 200.
- Controlled Browser report: `evidence/turn-state-reconciliation/browser/2026-08-25T06-19-23-108Z/report.json`.
- Controlled Browser screenshot: `evidence/turn-state-reconciliation/browser/2026-08-25T06-19-23-108Z/turn-state-reconciliation.png`.
- Targeted tests: APP-006, panel integration, approved dashboard, runtime-event separation, Turn LIVE/STALE reconciliation — PASS.
- Web production build — PASS.

## Current gate

Local reconciliation: `PASS`  
Production deployment and post-deploy verification: `PENDING`  
Overall verdict remains: `TURN STATE RECONCILIATION = FAIL / OPEN` until Production reflects the reconciled build.
