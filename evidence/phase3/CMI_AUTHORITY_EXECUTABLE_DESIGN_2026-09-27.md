# Chief Monitoring Inspector — executable authority design

## Decision

`chief-monitoring-inspector` remains a BASIC observer/inspector duty. It is not a control plane, incident owner, truth store, or replacement for either the Authority Control Plane or its current inspectors.

The current canonical tree contains the CMI identity and TURN/accountability presentation, but no executable API duty registered for that identity. The executable design below preserves the current authority semantics.

## Authority path

`AuthorityControlPlaneService` (sole 60-second scheduler)
→ human-approved read-only `AuthorityMandate` for `chief-monitoring-inspector`
→ CMI observation duty
→ existing `AuthorityAuditJournal` receipt
→ existing `AgentRuntimeEvent`
→ existing Authority Control Plane incident evaluator
→ existing TURN projection.

CMI never writes `ComponentHeartbeat`, never writes or overrides fleet truth, and never opens or resolves an incident directly.

## Executable contract

| Concern | Required behavior |
|---|---|
| Scheduler ownership | Add the duty to the existing `AuthorityControlPlaneService` monitoring cycle. No new timer, worker, cron, queue consumer, or service process. |
| Registration | Register CMI in a BASIC duty catalog, not `PremiumNetworkRegistryEntry`. The existing premium-only seed type must not be reused as semantic authority. |
| Mandate | Require an `APPROVED`, unrevoked, unexpired `AuthorityMandate` with mode `INSPECTOR`; read set only. Absence is fail-closed and produces no synthetic liveness. |
| Read set | Current authority mandates/leases, runtime events, audit journal, monitoring receipts, accountability projection and current incident projection. |
| Write set | Exactly one inspection receipt in `AuthorityAuditJournal` and one lifecycle result in `AgentRuntimeEvent`, written by the Authority Control Plane transaction. No direct incident write. |
| Persistence | Reuse the two existing stores. No new CMI table or state file. Evidence metadata contains contract version, observation window, input hashes, findings and source references. |
| Restart continuity | On bootstrap, derive the next observation from persisted journal/runtime cursors. Never refresh timestamps from memory. A missing/stale prior cycle remains visible until a real cycle completes. |
| Deduplication | Use a deterministic cycle key `(companyId, agentId, contractVersion, observationWindowEnd, inputSetHash)`. Before write, query the journal for that key/hash in the same transaction; return the existing receipt if present. |
| Heartbeat/liveness | Liveness is the latest real `AgentRuntimeEvent` for CMI. `ComponentHeartbeat` is forbidden for this duty. |
| Incident lifecycle | CMI emits a PASS/FAIL finding only. The existing Authority Control Plane qualifies, opens, deduplicates and resolves incidents after persistence and independent validation. |
| Failure | Exceptions produce a real FAILED runtime event only when a valid mandate exists and the transaction can persist it. No synthetic PASS, timestamp refresh, or swallowed failure. |
| Recovery | The next scheduled cycle rereads persisted truth. A recovered PASS is evidence for the existing incident evaluator; CMI itself does not close the incident. |
| TURN | TURN reads the latest persisted CMI runtime event and its validated journal receipt through the current projection. Identity without current evidence remains stale/unavailable. |

## Implementation boundaries

Files expected for a future selective implementation:

- `apps/api/src/authority-control-plane/authority-control-plane.service.ts`: schedule the bounded duty and retain incident ownership.
- a new CMI duty implementation beside `operational-agent-duty.runner.ts`: read-only evaluation and receipt construction.
- BASIC duty registration/mandate typing separate from the Premium registry.
- deterministic service tests for mandate absence, idempotency, stale input, failure, recovery and restart.
- TURN/API tests proving projection from `AgentRuntimeEvent` and rejecting `ComponentHeartbeat` as CMI authority.

## Gate

Design is executable without changing incident or system-truth ownership. Runtime promotion is not included in this Phase 3 candidate because a valid BASIC CMI mandate-registration path and human approval must be added and tested first. The preserved checkpoint remains `archive/chief-monitoring-inspector-runtime-20260901`; it must be selectively ported, never merged wholesale.

Verdict: **CMI DESIGN PASS; EXECUTABLE RUNTIME UNPROMOTED — KEEP**.
