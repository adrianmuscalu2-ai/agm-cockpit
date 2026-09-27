# Accountability / recovery reconciliation

Date: 2026-09-27
Laboratory archive: `01ed42991546638a69a8a2a12c74ac465c9b4e8a`
Legacy release head: `abd08051f179acd6e4b8978a058c6ec1782c0500`
Current baseline: Production tree `f402b84bb05bdc78cb0a052b2ecc15ea96741d00`

## Verdict

`DUPLICATE VERIFIED / EVOLVED — NO LEGACY CODE PORTED`

The laboratory's final protections exist in the current `agent-runtime-accountability.v2` path. Intermediate patches are mutually overlapping iterations and are not a linear patch queue. No missing protection was found that justified replaying a patch.

## Assertion-by-assertion reconciliation

| Legacy assertion | Current Production equivalent | Verdict |
|---|---|---|
| Registry identity alone is never ACTIVE | `evaluateAgentAccountability` requires executable capability, active mandate, bound execution evidence/output, current validation and freshness | PASS / EVOLVED |
| Missing capability or confirmed absent runtime is NOT EXECUTABLE | `capabilityDeclared` plus `runtimeAbsent` fail closed | PASS |
| Missing active mandate is MANDATE NOT ASSIGNED | Active, unrevoked, unexpired mandates are queried; missing mandate fails closed | PASS |
| Execution must belong to the active target mandate | `execution.mandateId === input.mandateId`; negative test uses `different-mandate` | PASS |
| Execution requires evidence and output | Both `evidenceRef` and `outputRef` are mandatory; absent values produce UNKNOWN / NO TELEMETRY | PASS |
| Failed/BLOCKED execution cannot be hidden by older PASS | `selectLatestAccountableExecution` preserves the newest failure and has a bounded 2-second persistence grace only for a new COMPLETED result | PASS / EVOLVED |
| Stale execution cannot be ACTIVE | Per-profile freshness window produces STALE | PASS |
| Independent validation must occur after execution | Older, missing or negative validation produces DEGRADED | PASS |
| Validator must be different from target | Consumer rejects `event.actorId === node.canonicalId` | PASS |
| Validator and target mandates must be bound | Consumer verifies persisted validator mandate, `validatorMandateId`, `targetMandateId`, and execution mandate | PASS |
| Validation receipt must bind exact execution/evidence/output | Consumer compares `executionEventId`, `executionEvidenceRef`, and `executionOutputRef` | PASS |
| Receipt output must be hash-bound | Consumer requires `sha256:<64 hex>` and equality to `sha256:${event.payloadHash}` | PASS |
| Producer writes the same strict receipt contract | Both inspector and fleet producers persist target/validator mandates, exact execution references, evidence hash and hashed `outputRef` | PASS |
| Primary failure transfers to a current secondary validator | `evaluateInspectorFailover` requires current secondary evidence plus persisted transfer | PASS |
| Missing secondary proof is CONTROL COVERAGE LOST | Engine and incident journal fail closed | PASS |
| Primary recovery does not erase failover proof | `PRIMARY_RECOVERED_FAILOVER_PROVEN`, `primaryRecovered`, and `failoverPreserved` are projected | PASS / EVOLVED |
| False ACTIVE count must be zero | `falseActiveCount` and final verdict gate remain enforced | PASS |
| Final PASS requires complete accountable fleet | All agents must be declared operational and ACTIVE with full proof; no inactive subset is ignored | PASS / STRICTER |
| Final PASS requires no open incidents | `openIncidents === 0` is mandatory | PASS / EVOLVED |
| Domain duties must be real and evidenced | `OperationalAgentDutyRunner`, real provider calls, persistent receipts, and four domain read duties replace synthetic validation | PASS / EVOLVED |
| Domain validation must be active-mandate/current/source-bound | current dashboard filters by active mandate, contract, execution kind, PASS result, validator mandate, hash-form output and nonempty evidence references | PASS |
| Failure reason must not be masked by stale domain data | Current `sourceFailureReason` reports failed domain event only when no accepted domain validation exists | PASS |
| TURN must expose execution, mandate, validation, freshness and failover | Current renderer exposes v2 verdicts, operational fleet, incidents, exact evidence, recovery and final gate | PASS / EVOLVED |
| Browser validator must fail closed | Current validator recomputes overall/accountability/final verdict, navigates to `investigate`, separately validates BASIC 34/34, tests incident truth, reload persistence and page errors | PASS / EVOLVED |
| Release gate must enforce runtime proof | `production-release.yml` checks domain duty count/evidence, false-active zero, primary recovery, zero incidents and final runtime PASS | PASS |

## Laboratory payload disposition

| Payload family | Files in archive | Disposition |
|---|---|---|
| Engine and mandate binding | `_codex_engine_*`, `_codex_execution_mandate_binding`, `_codex_runtime_signal_mandate`, `agent_recovery_engine`, `engine-*`, staged engine/spec | Incorporated and superseded by v2 engine plus current negative tests |
| Strict validation receipts | `_codex_validation_*`, `_codex_receipt_jsonb_hash_fix`, `inspector_execution_receipts`, `inspector_recovery_flow*`, `inspector_return_persisted` | Incorporated in strict producer/consumer at current service lines 442–497 and 674–705 |
| Recovery and final gate | `agent_recovery_final_gate*`, `agent_recovery_remove_synthetic*`, `agent_recovery_inactive_classification`, `agent_recovery_projection`, `agent_recovery_real_validation`, `agent_recovery_service_*` | Incorporated and evolved by real operational-duty runner, incident pipeline and stricter fleet gate |
| Domain-duty iterations | `domain_real_duty_*`, `domain_validation_*`, `domain_duty_lint*`, `_codex_domain_reason_mask*` | Incorporated by current real provider duties, strict validation projection and failure-reason ordering; earlier variants superseded |
| Web rendering iterations | `web_agent_runtime_*`, standalone CSS/renderer | Incorporated and evolved in current typed renderer and test |
| Browser iterations | `browser_accountability_*`, `browser_runtime_*`, `browser_snapshot_*` | Superseded by current deterministic Browser validator; old fixture cardinality coupling is explicitly rejected |
| Production workflow patches | `production_agent_runtime_gate*`, `_codex_accountability_failure_diagnostic` | Incorporated in current release gate; diagnostic-only iteration is not runtime functionality |
| Edit helpers and rescue journal | `service-edit*`, rescue journal | Laboratory tooling/evidence only; not product code |

## Validation executed

- API accountability engine, continuous runtime and duty runner: 3 suites, 26 tests PASS.
- Web accountability/role drift/incident truth: PASS.
- Controlled Browser accountability: PASS.
- Browser checks: `investigate` navigation, runtime fixture mapping, BASIC canonical 34/34 with zero Premium IDs, failover verdict, source-failure-not-zero, reload receipt persistence, zero page errors.
- Browser evidence: `evidence/agent-accountability/browser/2026-09-27T07-55-58-665Z/`.

## Preservation action

Keep archive `01ed429...` as historical provenance. It must not be merged or replayed. The current implementation is the authoritative evolved equivalent.
