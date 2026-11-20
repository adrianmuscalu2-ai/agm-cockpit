# Independent source audit — AGMaTCC / TURN

Date: 2026-11-20. Auditor: independent_connection_audit. Inspected HEAD: 90632af730bfeba7473770adf2b38562cb4c475e. Scope: read-only source review; this report is the only authorized file change. No production requests, paid inference, secrets, browser tests, publishing or operational mutations were performed. References are worktree-relative and describe the inspected revision.

Verdict: the code supports the diagnosis of incomplete source integration. Production functional acceptance remains UNVERIFIED; source existence is not proof of a working connection. This is an independent pre-implementation review, not final validation of subsequent changes.

## Priority finding: GET does not guarantee observational behavior

The initial source inventory identified existing authorized TURN boundaries suitable for reuse. Call-graph inspection qualifies that recommendation: their current implementations must not be called unchanged by a strictly observational Luna facade.

1. `apps/api/src/authority-control-plane/authority-control-plane.service.ts:430`: `dashboard()` calls `reconcileOperationalIncidents()`. At `:1184` that method creates `OPERATIONAL_INCIDENT_OPENED` or `OPERATIONAL_INCIDENT_RESOLVED` journal records, derived from qualification transitions. This is append-only mutation, not a pure read.
2. The same file `:513`: `agentAccountability()` calls `dashboard()`; additionally `:537` invokes `recordControlCoverageLost()` when coverage is incomplete. At `:713`–`:715` it opens a transaction creating `CONTROL_COVERAGE_LOST` and an incident. Calling this read-looking method can therefore create operational facts.
3. The same file `:503`: `registry()` calls `ensureFoundation()`, which performs upserts. Use the existing `registryReadOnly(companyId)` at `:507` for observation.
4. `apps/api/src/turn-operational-truth/turn-functional-overview.service.ts:74`: `snapshot()` calls `translation.functionalHealth()`. `apps/api/src/translation/translation.service.ts:31` calls the OpenAI translation provider with `Operational check` on cache miss. Thus this GET can initiate paid inference, despite otherwise using aggregate reads. Do not use it unchanged for passive observation.
5. `apps/api/src/turn-operational-truth/turn-operational-truth.service.ts:111`: `snapshot()` uses persisted reads and projection logic; the reviewed call graph does not call its separate mutating `recordAuthenticatedAcpRead()` method. This is a candidate for direct observational reuse.

Minimal recommendation: retain the existing `requireOperationalAccess` boundary and fixed TURN tenant on a shared authenticated read facade; extract/reuse pure projection logic and explicit persisted read sets. Do not expose authorization tokens to the model. Do not add OWNER/PREMIUM roles to the session. Do not call reconciliation, coverage recording, foundation initialization, active probes, heartbeat writes, inspections, or semantic rebuild from a read tool. Preserve existing operational reconciliation behavior outside this facade. Report observed qualifications separately from persisted incident facts; never fabricate a persisted incident ID to bridge that distinction. A narrow test should fail on any attempted create/update/upsert/delete, translation/provider invocation or operational action in the observational path.

## Inventory and authorization

| Source | Existing interface / reference | Boundary and integration finding |
| --- | --- | --- |
| Production Luna | `apps/api/src/agmatcc-copilot/agmatcc-copilot.service.ts:49`, `:73` | Production requires TURN_ADMIN_SESSION, but that role receives only search_operational_events. The agent/runtime and incident tools require PREMIUM_ACCESS. |
| Operational events | `apps/api/src/operational-event-store/operational-event-access.ts:12`, `:45` | TURN has read and sync for the fixed TURN company, no direct write right. Synthesized role is only TURN_ADMIN_SESSION. |
| Operational truth | `apps/api/src/turn-operational-truth/turn-operational-truth.controller.ts:28` | GET /operations/turn/operational-truth is public. Its service separates historical M2M proof from current heartbeat at :245–246. |
| Agent accountability | Same controller `:35` | Existing requireOperationalAccess boundary; implementation has the side effects listed above. |
| Functional overview | Same controller `:44` | Existing requireOperationalAccess boundary; active translation probe caveat above. |
| Operational dashboard | Same controller `:71` | Existing requireOperationalAccess boundary; reconciliation caveat above. |
| Component telemetry | `apps/api/src/component-telemetry/component-telemetry.controller.ts:10`, `:21` | GET /operations/components/:componentId/health uses normal JwtAuthGuard. Heartbeat POST is a write and is excluded from a read tool. |
| Agent runtime | `apps/api/src/agent-runtime-events/agent-runtime-events.controller.ts:12`, `:24` | GET uses normal JwtAuthGuard; Luna separately checks PREMIUM_ACCESS at agmatcc-copilot.service.ts:202. Execute-inspector and append are actions, not reads. |
| Incidents | `apps/api/src/incidents/incidents.controller.ts:12`, `:27`, `:33` | Collection/detail use normal JWT. Luna requires PREMIUM_ACCESS at agmatcc-copilot.service.ts:211. PIN TURN must not be silently promoted. |
| Evidence | `apps/api/src/evidence/evidence.controller.ts:11`, `:26`, `:32` | GET /evidence and /evidence/:id use normal JWT. Existing routes do not prove TURN PIN access. |
| ACPM | `apps/api/src/acpm/acpm.module.ts:16`, `:20` | /acpm, /semantic, /semantic-chain and /model-state exist; JWT plus OWNER check in acpm.service.ts:27. Exclude semantic rebuild=true from observational adapters. |
| Governance/RK | `apps/api/src/governance-v2/governance-v2.controller.ts:80`, `:100`, `:109`, `:118`, `:129` | Read endpoints require JWT plus a bound ACTIVE human actor with APPROVER or VALIDATOR role. Preserve these mechanisms unchanged. TURN PIN is not this identity. |
| Version/history/evidence UI | `apps/web/src/turn-module-navigation.registry.ts:31`–`:33` | Explicit HISTORICAL_PROJECTION from release/turn-20261028 manifests and agma-history.ts; not live complete history. |

UI read adapters and LLM tools are separate paths. `apps/web/src/turn-agmatcc/agmatcc.commands.ts:93` uses authenticatedApiFetch for human Governance/RK reads and classifies 401/403/unavailable at :105. It does not automatically connect those sources to Luna. The navigation registry explicitly disclaims being authority or a data source at `turn-module-navigation.registry.ts:20`. VALIDATED/PRODUCTION labels and old verification dates cannot establish current connection status.

## Semantic retrieval and factual relationships

`packages/shared/src/semantic-index.ts:1` documents deterministic feature hashing over a closed RO/EN concept lexicon, stems and character trigrams. It is not a neural semantic model and does not generalize beyond the lexicon. Reuse it accurately without claiming broad semantic understanding from its name alone.

`apps/api/src/operational-event-store/operational-event-semantic-search.service.ts:6` limits scans to the latest 2,000 events; :71 reports coverage. `agmatcc-copilot.service.ts:178` properly excludes AI request/response/failure history from evidence, preventing self-grounding. :186 supplements semantic ranking with lexical recall. :198 explicitly sets fullHistoryClaimed:false. Preserve these constraints, including no-hit responses and cases where older relevant records lie outside the scan.

Similarity ranking does not prove the chain Incident → Cause → Component → Mandate → Intervention → Version → Validation → Current state. Use explicit persisted links and original evidence, and report missing links instead of inferring causation from chronology or matching terms. Keep legitimate cross-journal occurrences and their distinct source references. Human-readable explanations should retain audit identifiers without using identifiers as the explanation.

## Required real A–H evidence

| Test | Minimum evidence |
| --- | --- |
| A Agents | Production Luna request, actual authorized accountability/runtime read, source references and observed timestamps. |
| B Telemetry | Actual heartbeat/freshness data, distinction between active/inactive/degraded/unknown; historical M2M proof is not current health. |
| C Incidents | Authorized real incident records and original evidence, semantic retrieval, status and demonstrated historical links. |
| D Versions/regressions | Explicit incident/version/validation relationships; temporal proximity alone cannot establish a regression. |
| E Operational chain | Documented blockers, controlling authority/reason and current evidence. Missing data cannot justify labeling a block unjustified. |
| F Semantic search | Different formulations without exact incident name retrieving the same real evidence; record tools, sources and results for each. |
| G Conversation continuity | Real successive dialogue resolving a previous reference, followed by a fresh authorized fact read rather than treating conversation history as factual evidence. |
| H Authorization | Actual successful allowed reads and denied restricted-source reads with the relevant real session types; no synthetic role escalation. |

For every end-to-end test retain production revision, provider/execution/request identifiers, selected source tool, response evidence references, observed timestamps and verdict. A direct source HTTP 200 establishes only that source read; it is not full Luna end-to-end PASS. Mocks establish regression behavior, not production acceptance. Preserve separate NOT_CONNECTED, NOT_AUTHORIZED, UNAVAILABLE, NO_DATA and partial-coverage results; UNKNOWN must not hide a connection failure. Any missing acceptance evidence remains PARTIAL/UNKNOWN/FAIL as appropriate.

## Review limits

No runtime connectivity, live source freshness, user microphone, production conversation, deployment parity or actual authorization outcome was tested here. Browser work, if needed later, remains subject to the required rescue preflight and validation runbook. No Guardian or RK mechanism was changed or proposed for alteration. Recommendations are constrained to existing authorization and observational reuse.

## Follow-up independent implementation review — 2026-11-20

Reviewed the uncommitted implementation against HEAD 90632af, including turn-observation-reader.ts, evidence-relations.ts, associated tests, authority projection changes, copilot integration, semantic lexicon v2, production audit scripts and read-source-inventory.cjs. This review did not execute paid inference or production requests and did not change source files.

The implementation now rechecks the canonical TURN verifier and fixed tenant without synthesizing an OWNER identity. observationOnly=true is propagated through dashboard/accountability and suppresses incident reconciliation writes and control-coverage recording. Active translation probes are excluded. The write-deny proxy test exercises the actual projections; ordinary authentication still updates session lastUsedAt by existing design, so the no-write statement applies to operational projections, not all authentication bookkeeping.

Prior findings addressed in source: adapter inventory explicitly says ADAPTER_CONFIGURATION_ONLY and runtimeConnectivity NOT_CHECKED; reader distinguishes preserved 401/403 exceptions from other failures; truncated observations retain coverage and reference metadata; exact redacted observation evidence is returned in sourceReads and the existing frontend AI_RESPONSE spread includes it in the journal. The canonical verifier itself still converts backend failures to 401; this inherited limitation was not changed. Explicit-reference associations are marked non-causal; lexicon v2 remains a bounded deterministic retriever rather than proof of contextual understanding.

One remaining acceptance-critical defect was reported to the implementer: the deterministic source-failure guard uses sourceReads.every(state != AVAILABLE). Mixed results such as telemetry=UNAVAILABLE plus connections=AVAILABLE (configuration only), or agents=UNAVAILABLE plus a successful historical-journal read, can still produce a global PASS if the model cites an allowed failure reference. The all-failed test does not cover this case. Required correction: conservatively prevent a global PASS when a source read failed, or enforce a stricter claim-to-successful-factual-source validation; add a mixed-result regression test. This finding records the reviewed state and must be closed explicitly after correction.

The production metadata inventory script reads only tenant-scoped counts/grouping and labels itself operations-identity metadata, not caller-authenticated E2E. Public-boundary checks likewise do not prove authorized Luna access. The authenticated dialogue script uses the existing controlled Commander UI and does not import tokens or replace the session family; its output correctly requires semantic review rather than declaring PASS. H additionally needs actual denied-source evidence; a conversational explanation of restrictions alone is insufficient.

A–H remain PENDING / UNVERIFIED. Parent reports no available controlled Commander browser (no CDP and IAB host absent); this reviewer did not independently probe the browser. A valid future route is the already-bound session and its normal same-family refresh, not a newly unlocked family or operator DB identity. No final production integration PASS is supported by this source review.

### Mixed-result finding closure — source review

Re-inspection confirms the correction in `apps/api/src/agmatcc-copilot/agmatcc-copilot.service.ts:147`: the guard now uses `sourceReads.some(read => read.state !== 'AVAILABLE')`. Any missing/failed read overrides a model PASS with UNKNOWN (or BLOCKED when all reads are unauthorized) and replaces the model narrative with explicit source states, including the insufficiency of available sources to replace missing ones. The regression case at `apps/api/test/agmatcc-copilot.spec.ts:285` supplies telemetry UNAVAILABLE plus configuration AVAILABLE, deliberately returns a false model PASS citing the failed telemetry reference, and asserts UNKNOWN plus removal of the false healthy narrative. The reported defect is CLOSED by source inspection. Test execution is owned by the parent and was still running when this closure was written; no independent test PASS is claimed here. No remaining acceptance-critical code defect was identified in the reviewed change. Production A–H remain PENDING / UNVERIFIED.
