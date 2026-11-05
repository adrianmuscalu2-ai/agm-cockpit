# AGM 1.9.1 — Governance V2 identity readiness, HERE/TollGuru abandon decision (append-only)

Date: 2026-11-05. Branch: integration/agm-1.9.1-20261104 (base HEAD d16d50a). Production: HOLD, untouched.
Correlates with: RECONCILIATION_JOURNAL, BLOCKER_CLOSURE_JOURNAL, RELEASE_READINESS_JOURNAL (all 20261105).

## 1. HERE / TollGuru — ABANDONED / INACTIVE (Product Owner decision, recorded)
Evidence of isolation from the active configuration:
- `secret-telemetry.service.ts`: HERE/TollGuru live only in `archivedOptionalSecretDefinitions` (comment records the decision); active definitions contain TomTom only.
- `car-mover-routing.policy.ts`: `hereRequired=false`, `tollGuruRequired=false`, `automaticExternalLookupAllowed=false`.
- `live-adapter.service.ts`: optional providers need an OWNER role plus an authorization reference, otherwise Forbidden.
- `production-release.yml` requires only TOMTOM_API_KEY and the Gmail secrets. No HERE_* or TOLLGURU_* reference. No such repository secret exists (names checked, values not read).
- No workflow, package script or deploy entry invokes `test-provider-activation-gate`, `test-tollguru-cache-gate` or `test-provider-pilot-live`.
- Isolation specs: 5 suites, 33/33 PASS.
Classification: those three scripts and HERE/TollGuru-specific checks are NOT_APPLICABLE to the 1.9.1 activation and release conditions. They were not executed (provider-activation-gate and tollguru-cache-gate stop at missing credentials/report) and are NOT recorded as PASS. `test-provider-pilot-live` PASS earlier on a disposable DB.
Historical code, protocols and evidence are retained; nothing deleted.
TomTom (separate, still required): CI secret exists by name only; no live verification was possible locally (key absent). Live behaviour UNVERIFIED.

## 2. Proposer — NOT_DESIGNATED
Candidates in `premium-network.seed.ts`: `agm.authority.control-plane` (lease/fence write only), `premium.orchestrator` (`work.dispatch` only), `premium.architecture-inspector` and `premium.release-inspector` (read-only, independent). None holds a proposal permission; no protocol designates a Proposer. ATLAS is not designated either. No actor invented. `turn-commander-adrian` remains sole final approver and is not registered in `actor_principals`.

## 3. Machine Identity / ACP vs Governance V2
- Chain: MachineIdentity (companyId, subject, scopes) → MachineCredential (hash, expiry, revoke) → JWT (`sub`, `companyId`, `client_id`, `credential_id`, `scope`, `token_use`) → `MachineJwtAuthGuard` → ACP read routes (read-only, cross-company check).
- Only scope: `acp:read` (hard-coded in `MACHINE_AUTH_CONTRACT`). Not extended.
- Governance V2 has no HTTP surface and no machine auth integration: `actorId` is a caller-supplied string; `agm_governance.actor_principals` has no link to MachineIdentity/credential/user. Verified read-only: 1 EXECUTOR, 1 VALIDATOR, no PROPOSER/APPROVER.
- A distinct Proposer machine identity is technically possible with the existing provisioning (company_owner/OWNER/PRODUCT_OWNER/ADMIN), but would need a proposal scope that does not exist.
- Separation of duties: proposer cannot approve/validate/activate own proposal (`governance-v2.persistence.ts`); `governance-v2-hardening.spec.ts` 8/8 PASS (includes self-validation and same-actor approval denial).
- Guardian/RK: unchanged.

### Proposed identity-binding design (NOT implemented; requires Turn Commander approval)
1. Add binding table `actor_principal_bindings(actor_id → machine_identity_id | user_id, company_id, mandate_ref, created_by, status)`, append-only, populated only by Turn Commander approval.
2. Governance entrypoint derives `actorId` from the authenticated principal through the binding; caller-supplied `actorId` is rejected.
3. New dedicated scopes, never an extension of `acp:read`: `governance:propose`, separate from approve/validate/execute.
4. Approval stays with `turn-commander-adrian` (human session); machine identities may not approve.
5. Compatible with the validated lifecycle: it only adds a binding precondition before existing engine calls.

## 4. Access proof — STALE (not PASS)
Source: `turn-operational-truth.service.ts`; window `accessProofFreshnessWindowMs` = 15 min. Role `HISTORICAL_RELEASE_ACCESS_PROOF_NOT_RUNTIME_FRESHNESS`. STALE = no authenticated `acp:read` GET network-registry correlated within 15 min; heartbeat (window 90 s) is independent of authentication/authorization. Credential validity is NOT proven either way. Canonical revalidation: a fresh authenticated M2M `acp:read` (Production certification step). Not forced; no secrets touched. Current state remains STALE/UNKNOWN for credentials.

## 5. Release facts
- Security evidence secret scan on push: success. Branch pushed earlier; no merge, no deploy.
- TURN company in Production: UNKNOWN (only historical inference from run 41227720680, sha e2b3a1e; no authorized current read-only channel).
- RK and Guardian: no modifications.

## 6. Remaining authorizations
Designate/register Proposer and Approver; approve binding table and `governance:propose` scope; read-only Production TURN-company check or accept UNKNOWN; Guardian-bound TomTom credentials for live verification; push of this journal commit; merge/Production release; semantic-search mandate (only lexical search exists).
