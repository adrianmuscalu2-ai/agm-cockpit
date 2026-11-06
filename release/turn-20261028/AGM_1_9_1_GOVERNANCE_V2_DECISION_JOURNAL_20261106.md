# AGM 1.9.1 — Governance V2 Decision Journal (append-only)

Date: 2026-11-06
Decision ref: `turn-commander-decision-20261106-governance-v2-actors`
Source: Turn Commander mandate "MANDAT UNIC DE FINALIZARE" (2026-11-06).
Correlates with: `AGM_1_9_1_PRODUCTION_RELEASE_RECORD_20261106.md` (run 42162872386, commit `392bc66`).

## Decision recorded (not altered)
- Proposer: ATLAS (canonical actor id `atlas-operations`, per the TURN organization registry). May formulate and submit proposals. No self-approval, no unilateral publication. `can_propose=true`, `can_validate=false`, `can_execute=false`.
- Approver: `turn-commander-adrian`, authenticated human identity, explicit auditable decisions. `can_propose=false`.
- Validator and Executor: existing actors unchanged.
- RK and Guardian: independent, unmodified (no diff in `apps/api/src/permission-guardian` or `risk-knowledge-orchestrator.ts` versus `e2b3a1e`).

## Implementation evidence (local, disposable PostgreSQL)
- Migration `20261106100000_add_governance_actor_identity_bindings`: append-only table `agm_governance.actor_identity_bindings` (UPDATE/DELETE rejected by `reject_event_mutation`). Revocation is a new row.
- `bindActorIdentity` / `resolveAuthenticatedActor`: actor is derived from the authenticated principal, never from a caller-supplied id. Proposal requires a machine identity carrying `governance:propose` (separate from `acp:read`).
- `scripts/test-governance-identity-binding-db.ts`: PASS, 11 checks (unbound rejected, wrong scope `acp:read` rejected, cross-company rejected, human cannot propose, unknown actor rejected, revoked binding rejected, UPDATE/DELETE rejected).
- `test/governance-v2-hardening.spec.ts`: 8/8 PASS (self-approval, self-validation, same-actor activation denied).

## Open items (not PASS)
- Production registration and binding: NOT EXECUTED. Requires an authorized Production database credential and the real machine-identity/user ids; run `scripts/activate-governance-v2-actors.ts`. Governance V2 activation in Production: NOT ACTIVATED.
- Issuing `governance:propose` on machine tokens is not implemented: machine-auth issues only `acp:read` (modifying it would change the existing authority path). Needs a Turn Commander decision.
- No Governance V2 HTTP controller exists; proposals cannot yet be submitted over the API.
