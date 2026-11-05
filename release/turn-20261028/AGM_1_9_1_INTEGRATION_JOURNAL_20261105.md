# AGM 1.9.1 — Integration journal (append-only), 2026-11-05

Branch `integration/agm-1.9.1-20261104`, HEAD 814b3ed (+ this entry). Nothing pushed, merged or deployed. Production on HOLD. RK and Guardian unmodified.

## Commits
c05382b RK cherry-picks + append-only migration; 93ed23b AGMaTCC + 1.9.1; 3af1354 CSS test hash repin (stale pin, styles unchanged); d3d38e3 browser validation script; 2c54a97 real-Postgres lifecycle e2e; 6f63509 voice commands + remote journal read; 7592617 real-API e2e; 814b3ed operational-events access.

## Gates
| Gate | Verdict | Evidence |
|---|---|---|
| Lifecycle PRECHECK → authorized execution → POST_REVIEW → closure (non-Production PostgreSQL) | PASS | 2c54a97, evidence/lifecycle |
| Operational-events auth (TURN session read/sync; write denied; user JWT unchanged) | PASS | real API + real PostgreSQL, 14/14 incl. anonymous 401, forged/unsessioned token 401, cross-company isolation (scripts/e2e-api-real.mjs) |
| AGMaTCC browser (controlled Playwright/Chromium) | PASS with stubbed auth/API, 14/14 | evidence/agmatcc; real-API browser run NOT performed |
| SEARCH LEXICAL | PASS (AGMaTCC client-side; Postgres FTS `*_semantic_search` GIN indexes are lexical) | migration 20261029120000_add_governance_v2 |
| SEARCH SEMANTIC | NOT AVAILABLE | no embeddings/pgvector in monorepo; needs mandate for provider/secret/storage |
| Governance V2 identities | PARTIAL | no Owner/Proposer/Approver registered; none invented |
| Production reconciliation | PARTIAL | see below |

## Governance authority (sources)
Register V1.1 §3: `turn-commander-adrian` (sole Product Owner/approval authority), `architecture-guardian`, `version-guardian`; aliases add no approver. Governance DB has only VALIDATOR and EXECUTOR. Proposed (not implemented): Approver = `turn-commander-adrian` via TURN PIN session; Proposer = distinct identity named by the Turn Commander over a separate authenticated channel; `actor_id` ↔ principal mapping table.

## Production lineage
Last successful production-release run 41227720680 at e2b3a1e (origin/phase3-rc-preparation), not an ancestor of the candidate. Nine commits missing from the candidate (e2b3a1e, b1636e3, cf82796, 2f14ba7, c9d25a8, 9ce071d, ba1af16, 195a273, edc95a1). Dry-run merge: 3 conflicts — authority-control-plane.service.ts, operational-agent-duty.runner.ts, turn-module-navigation.registry.ts. Releasing as-is would regress Production.

## Open authorizations needed
(a) merge phase3 lineage; (b) name/register Proposer and Approver and identity binding; (c) push; (d) Production release. Unverified: TURN company row (0000…0001) existence in Production.

## Cleanup
Disposable DB/role agm_api_e2e dropped; temp secret file removed.
