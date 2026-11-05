# AGM 1.9.1 — Release-readiness journal (2026-11-05, append-only)

## 1. Pre-push integrity
- HEAD before this entry: 0fcb776 (c48e0b4 merge of e2b3a1e; 96b2f6f; 0fcb776). Working tree: only untracked evidence/ (not committed).
- Push trigger audit: production-release.yml `push` triggers only main and agm-canonical-20260820; the branch integration/agm-1.9.1-20261104 matches no Production trigger. security-evidence-scan.yml runs on push (read-only scan). No automatic deploy.

## 2. Remaining four scripts (stale constructor)
- test-provider-activation-gate.ts, test-provider-pilot-live.ts, test-tollguru-cache-gate.ts now use createAuthorityControlPlaneForDbGate; scripts/validate-premium-authority-dashboard.mjs builds the real graph from dist (syntax verified). tsc --noEmit clean.
- test-provider-pilot-live: PASS (exit 0) on local non-super Postgres.
- test-provider-activation-gate: constructor error gone; now stops at `Guardian process bindings are required` (needs real TOMTOM/HERE/TOLLGURU keys). Not run: no secrets requested or supplied. Status BLOCKED-BY-SECRETS.
- test-tollguru-cache-gate: constructor error gone; stops at TOLLGURU_REPORT_MISSING (needs a prior live TollGuru report). Status BLOCKED-BY-LIVE-PROVIDER.
- Local fixture only: the disposable DB user email was set to the pilot owner address the scripts look up; no Production data.

## 3. Governance V2 verifiable actor identification (prepared, nothing registered)
- New read-only script apps/api/scripts/report-governance-actor-readiness.ts (SELECT only; verified with a SELECT-only role).
- Local result: EXECUTOR codex-implementer-machine-operational-truth-remediation, VALIDATOR independent-validator-automated-20261025; no PROPOSER, no APPROVER, turn-commander-adrian not registered; actor_principals has no binding to an authenticated principal.
- Proposed (not applied) binding design: add an optional authenticated_subject column (TURN user id or machine-auth OIDC subject) to actor_principals; GovernanceV2 resolves actorId from the authenticated session instead of a caller-supplied string; registration only by Turn Commander. Requires explicit authorization.

## 4. TURN company in Production
- Read-only evidence: run 41227720680 (sha e2b3a1e, 2026-10-31) job "Post-deploy certification" provisioned an M2M client and resolved `data.companyId` against api.agmcockpit.com, ending M2M_PRODUCTION_LIFECYCLE=PASS. Company id is not printed in the log.
- Verdict: historical inference only. Current existence of company 00000000-0000-0000-0000-000000000001: UNKNOWN. Production was not accessed.

## 5. RK / Guardian
- Diff vs 913ad22 on Guardian/RK paths: empty. Diff vs e2b3a1e: additions only from the previously accepted RK cherry-picks (no modification/removal of Guardian).
- API jest: 612/613 in full run; the single failure (multipart-security.e2e, 30 s timeout under load) passes 7/7 in isolation.
