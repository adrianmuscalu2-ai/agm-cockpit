# Phase 3 domain-view reconciliation validation

Generated at: `2026-08-29T21:19:48.538Z`
Verdict: **PASS**

## Checks

- CENTRAL_REGISTRY_815_HASH_UNCHANGED = PASS
- PHASE3_SOURCE_SET_EXACT_17 = PASS
- DOMAIN_MAPPINGS_17_OF_17_EXACT = PASS
- PRE_EXISTING_798_BASELINE_PRESERVED = PASS
- NO_SOURCE_OR_MEMBERSHIP_DUPLICATION = PASS
- CONTROLLED_VIEWS_REFERENCE_ONLY_AND_COUNTS_VALID = PASS
- CANDIDATE_VIEW_AUTHORITY_NOT_PROMOTED = PASS
- CS_DE_STVO_SCOPE_PRESERVED = PASS
- UNRESOLVED_GAPS_EXACTLY_3_OPEN = PASS
- CANONICAL_ARTIFACT_INTEGRITY_17_OF_17 = PASS
- DUPLICATE_HASH_GROUPS_PRESERVED = PASS
- SCHEMAS_UNCHANGED = PASS
- BASIC_LIBRARIAN_HASHES_3_OF_3_MATCH = PASS
- TRACEABILITY_COMPLETE = PASS
- GENERATOR_IDEMPOTENCE_TWO_RUN_SIGNATURE_MATCH = PASS

## Validated transition

- canonical sources: 815 -> 815;
- mapped sources: 798 -> 815;
- memberships: 1,466 -> 1,487;
- new source/domain memberships: 21;
- Phase 3 sourceIds reconciled: 17/17;
- duplicate hash groups/records: 62/257, unchanged through immutable Registry hash;
- unresolved gaps: ROUTING-TOLL-001, LEGAL-003, LEGAL-005 — OPEN;
- Basic Librarian hashes: 3/3 MATCH;
- generator idempotence: two consecutive runs MATCH; combined output SHA-256 `646552402d11b1ca0f87c06bfe0d6161fcf90ade77425d5ccf7f433104556b7f`;
- runtime / Production / TURN: NO CHANGE;
- commit / push: NOT EXECUTED.
