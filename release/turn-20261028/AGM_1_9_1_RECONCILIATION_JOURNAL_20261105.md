# AGM 1.9.1 — Reconciliation journal (append-only, 2026-11-05)

Complements `AGM_1_9_1_INTEGRATION_JOURNAL_20261105.md`. Not rewritten; this is a new entry.

## Provenance
- Candidate: `integration/agm-1.9.1-20261104`, previous HEAD 913ad22.
- Last verified Production: `e2b3a1e` (production-release run 41227720680, from `origin/phase3-rc-preparation`).
- Merge commit: c48e0b4 (`--no-ff`). `git merge-base --is-ancestor e2b3a1e HEAD` = true. Both lineages preserved.
- Nothing pushed. Production untouched.

## Conflict resolutions
1. `turn-module-navigation.registry.ts`: classified row by row against merge-base e4076a8. 15 rows changed only in the candidate, 4 only in Production (`version-journal`, `memory`, `evidence`, `risk-knowledge`: added `target` and `evidenceRefs`). Result = candidate rows plus the 4 Production rows.
2. `authority-control-plane.service.ts`: `NON_HUMAN_DUTY_VALIDATION_INCOMPLETE` payload merged as a union (`code`, `message`, expected/validated counts, `failedDuties` including `operation`). No test references these fields.
3. `operational-agent-duty.runner.ts`: kept the candidate `orchestratorDuty` (premium-agent Set coverage, from f2a0ff2). It is logically equivalent to the Production version and carries superset metadata (`expectedPremiumAgents`).

## Contract and test follow-ups
- SR-14 CSS cascade pin 8207BE54… → 4F1D975A…023A (Production added only `.turn-journals-*` rules to `45-turn-final-remediation.css`).
- RK migrations `20261031120000_add_universal_lifecycle` and `20261103100000_protect_universal_lifecycle_event` registered in `persistence.contract.ts`.
- data001 destructive-op regex now ignores the protective `BEFORE TRUNCATE` trigger.

## Verification (real evidence)
- API jest: 87 suites, 613/613 PASS. Web tests PASS (agmatcc, turn-*, event-sync, SR-14).
- Node real-API e2e on disposable non-super Postgres: PASS.
- Browser against real API and real PostgreSQL (no route stubs): 14/14 PASS. Evidence: `evidence/agmatcc-real-api/2026-11-05T19-34-00-923Z` (uncommitted). It covers authentication via the existing `/turn-admin/unlock`, wrong PIN rejected, sync accepted, authenticated journal read, DB persistence, anonymous 401, other-company isolation, and the sync right.
- RK and Guardian: no diff in their paths against HEAD or e2b3a1e.
- Known stale or environmental failures, not caused by this work: `test:authority-control-plane-db`, `test:opportunity-intelligence-db` and `test:live-adapters-db` (TS2554: constructor now takes 4 args, script last touched in 29b61db); `test:p1-event-store-db` (needs an existing local tenant); `test:machine-auth-db` (needs the canonical DB/JWT env).

## Search
- SEARCH LEXICAL: AVAILABLE (AGMaTCC client-side search; Postgres FTS indexes named `*_semantic_search` are lexical).
- SEARCH SEMANTIC: NOT AVAILABLE (no embeddings or pgvector in the monorepo). A provider and storage mandate is needed.

## TURN company
- `github-actions-oidc.service.ts` `resolveTenant()` requires an active Company `00000000-0000-0000-0000-000000000001` with an active provisioning user, and returns 503 otherwise. The Production lifecycle run passed (`M2M_PRODUCTION_LIFECYCLE=PASS`), so the row very probably exists.
- INFERRED, NOT OBSERVED. No Production access was used.

## Governance V2 authorities
- `turn-commander-adrian` remains the sole final approval authority. `architecture-guardian` and `version-guardian` exist. The Governance DB holds only VALIDATOR and EXECUTOR actors.
- Register V1.1 §3 adds no approver and no third identity.
- The TURN architecture names ATLAS (operational coordination) and INSPECTOR ȘEF MONITORIZARE under ADRIAN as Proposer candidates.
- No Proposer is registered. Binding `actor_id` to the authenticated session is a proposal only.

## Open authorizations
- (a) Push the branch.
- (b) Name the Proposer and register identities and the binding.
- (c) Production release, and Production verification of the TURN company.
- (d) A semantic-search provider and storage mandate.
