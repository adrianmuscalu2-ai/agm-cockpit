# Chief Monitoring Inspector runtime reconciliation

Date: 2026-09-27  
Legacy checkpoint: `3c96e710423b94537aa879b8326b7defc38e13a7`  
Canonical baseline: Production tree `f402b84bb05bdc78cb0a052b2ecc15ea96741d00`

## Verdict

`PARTIAL — KEEP / SELECTIVE PORT BLOCKED ON AUTHORITY SEMANTICS`

The legacy checkpoint proves unique executable work, but it cannot be copied into the current system without creating a second scheduler and an unmandated writer beside the current Authority Control Plane. No runtime code was ported in this phase.

## Component reconciliation

| Component | Status | Evidence |
|---|---|---|
| Identity / registration | PRESENT | `apps/web/src/turn-organization-chart.ts` and `apps/web/src/turn-agent-panel.integration.ts` retain `chief-monitoring-inspector` as the independent BASIC coordinator. |
| Executable runtime | ABSENT | Legacy `apps/api/src/chief-monitoring-inspector/chief-monitoring-inspector.service.ts` is not present. Current Authority Control Plane executes Premium inspectors, not this BASIC identity. |
| Mandate | PARTIAL | Legacy runtime manufactures a string `mandateId` but does not bind to an `AuthorityMandate`. Current ACP requires persisted, approved, non-expired mandates for governed duties. |
| Independent scheduler | ABSENT | Legacy owned a 60-second timer. Current ACP owns its own 60-second runtime monitoring timer; adding the legacy service unchanged would create parallel scheduling authority. |
| Heartbeat | ABSENT for CMI | Legacy wrote `ComponentHeartbeat(chief-monitoring-inspector)`. Current telemetry inventory can project runtime events but has no current producer for this BASIC identity. |
| EventStore persistence | PRESENT as platform / ABSENT as producer | `AgentRuntimeEvent` API and storage remain; the CMI producer was removed. |
| API projection | PRESENT | Current BASIC telemetry inventory projects latest `AgentRuntimeEvent` records. |
| TURN projection | PRESENT | Current TURN BASIC map includes the identity and evaluates real runtime events without claiming activity from registry presence. |
| Failure reporting | PARTIAL | Legacy emitted `BLOCKED` and a degraded heartbeat. Current incident/accountability engine is newer, but no CMI-specific producer feeds it. |
| Restart continuity | PARTIAL | Persistent events/heartbeats survive restart; legacy scheduler simply restarted and created a new cycle. No durable CMI lease/checkpoint existed. |
| Recovery / failover | REPLACED BY NEWER EQUIVALENT for Premium inspectors only | ACP provides controlled failover for `premium.release-inspector` and `premium.architecture-inspector`; this does not replace the BASIC Chief Monitoring Inspector mandate. |
| Unit tests | LEGACY ONLY | `apps/api/test/chief-monitoring-inspector.service.spec.ts` and the web executor tests exist only in the checkpoint. |
| Runtime validator | LEGACY ONLY | `apps/api/scripts/validate-chief-monitoring-inspector-runtime.ts` validates DB canary → events → heartbeat → API. |
| Browser evidence | LEGACY ONLY | Three Browser runs exist under `evidence/chief-monitoring-inspector/browser/`; validator checks heartbeat → EventStore → API → TURN → UI. |

## Legacy implementation limitations

The checkpoint contains two different notions of inspection:

1. API service: a database `SELECT 1` canary, then STARTED/COMPLETED events and a heartbeat.
2. Web executor: aggregation of MON snapshots into HEALTHY/DEGRADED/FAILED/UNKNOWN, without re-probing.

The API runtime does not execute the MON-001–MON-012 aggregation described by the UI executor. Its generated mandate is not a persisted authority mandate, and its output reference is not a persisted inspection result. Therefore the old Browser PASS demonstrates the old path, but not the complete current governance contract.

## Why selective promotion is blocked

A correct port must decide, and encode in the current authority model:

- whether `chief-monitoring-inspector` is a continuous BASIC runtime or an event-driven governed duty;
- which persisted mandate and scope authorize it to read MON evidence and write events/incident qualifications;
- whether its scheduler is owned by ACP or by an independent observer service;
- how to avoid duplicate verdict authority with the current operational incident and accountability evaluators;
- the durable output/evidence contract and restart/idempotency key;
- fail-closed behavior when only a subset of MON sources is available.

Those choices change authority and recovery semantics. They cannot be inferred safely from the legacy checkpoint and are outside a selective, behavior-preserving port.

## Selective-port plan after authority decision

1. Register a BASIC-scoped, read-only inspection mandate in the current authority schema; do not add CMI to the Premium registry.
2. Make ACP the single scheduler owner, or explicitly delegate one fenced lease to an observer service—never both.
3. Reimplement the MON aggregation as an API-side pure evaluator over current persisted source records.
4. Persist STARTED plus terminal lifecycle events and a hashed output receipt in one governed execution flow.
5. Publish heartbeat only if the selected operational profile is continuous; otherwise use runtime events exclusively.
6. Feed the current incident/accountability projection without adding a second incident authority.
7. Add deterministic unit, restart/idempotency, failure, API projection, TURN, and controlled Browser validators.

## Preservation action

Keep checkpoint `3c96e710423b94537aa879b8326b7defc38e13a7` and its archived evidence. Do not restore the deleted service/module or the old browser validator directly.
