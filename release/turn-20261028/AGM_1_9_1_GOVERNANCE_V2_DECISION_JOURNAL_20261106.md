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

## Append-only authorization amendment — 2026-11-08

- Turn Commander authorization received at `2026-11-08T07:13:07.541+01:00`: “ai toate aprobarile necesare pentru a finaliza ,doar sa se revada in manifestul final”.
- The authorization permits proceeding with the remaining Governance V2 implementation and Production activation gates, including the `governance:propose` capability for the canonical Atlas proposer, while retaining separate approval, validation, and execution actors.
- The authorization also covers completing canonical journal and Risk & Knowledge integration and their Production verification. It does not assert that any migration, identity binding, deployment, or activation has already occurred.
- The deployed source includes `apps/api/src/governance-v2/governance-v2.controller.ts`; the earlier open-item statement that no controller exists is superseded by the current source. API availability alone is not activation evidence.
- The exact Production machine-identity and human-user principal IDs, database migration state, and independent validation evidence remain to be verified before recording those operations as complete.
- The authorization is recorded in `RELEASE_MANIFEST.json` under `commandAuthorizations`; historical release entries and decision content above remain unchanged.

## Append-only implementation update — 2026-11-08 (local candidate)

- Added protected read-only proposal and Risk & Knowledge search/read routes. Reads require a current bound human actor with an active APPROVER or VALIDATOR role; database errors are not translated into authorization denials. No write, approval, validation, execution, or activation route was added.
- Connected the TURN journals Risk & Knowledge panel to those existing canonical runtime/persistence methods. The panel reports read/API errors explicitly and does not change module validation or activation states.
- Restricted `governance:propose` to the canonical Atlas subject, included the approved scope in authorized Atlas credential rotation and its audit event, and made duplicate identity provisioning fail explicitly instead of creating duplicate authority.
- Hardened the actor-binding runner: it verifies the supplied Production principals against their company, subject, active status, and approved scope; it skips only exact matching actor/binding records and fails closed on conflicts. Its output explicitly remains `NOT_ACTIVATED`.
- Local validation: API build and lint PASS; focused machine-auth, Governance controller, and Governance hardening tests PASS (3 suites / 29 tests); Web build, TURN-journals contract, and AGMaTCC contract PASS; actor-binding script type-check PASS.
- Production baseline verified separately: Web `pages-386962364706` and API `api-42427563692-1` serve commit `386962364706db560f8d11c9eef57a814bb25136`; release run `42427563692` succeeded and API readiness reported the database available. This evidence is recorded in `RELEASE_MANIFEST.json`.
- Candidate changes remain local and uncommitted. No candidate deployment, Production actor binding, or Governance activation was performed. The real Production principal IDs and authorized database execution context are not available in this session; Production activation and independent runtime validation remain NOT VERIFIED. RK and Guardian source files remain unchanged.

## Append-only Production execution path — 2026-11-08

- Added a manually dispatched `Production`-environment workflow that checks the requested revision against both the canonical workflow ref and live API build before using the existing Guardian-controlled SSH secret references.
- The runner discovers exactly one active Atlas machine identity with `acp:read` and the explicitly authorized `governance:propose` scope, then resolves the Commander to the unique active `company_owner` user in that same active company. Missing or ambiguous identities, missing migration, or conflicting append-only records stop the operation.
- The binding script verifies both principals through the persisted Governance actor resolver after binding. It does not expose credentials, rotate machine credentials, or mark Governance active; its result remains `NOT_ACTIVATED`.
- Local API type-check and focused Governance/machine-auth tests pass (3 suites / 29 tests). Production workflow dispatch, actor discovery, binding, authenticated HTTP reads, and independent validation remain pending until the candidate is merged and deployed.
- First Production dispatch on revision `c7cabc1e484c334e258bb437ffc1d829a5c7b1ea` passed the live revision guard but stopped before script execution because the runtime image has no workspace-root `node_modules/.bin/ts-node`. The workflow now targets the API package-local executable present in the workspace layout; a new deployed revision and controlled rerun are required. No actor binding or Governance activation occurred in the failed attempt.
- Canonical release run `42463614495` deployed API commit `c7cabc1e484c334e258bb437ffc1d829a5c7b1ea`, build `api-42463614495-1`; uncached readiness reported database available. Deployment and health passed, but post-deploy certification failed: the accountability snapshot reported 27 failed agents, zero active, an open control-coverage incident, and inspector failover `FAIL` because no independent validator could control the current execution. Operational-truth Browser validation passed; accountability evidence failed and dependent accountability/responsive Browser checks were skipped. RK and Guardian were not modified or bypassed.
