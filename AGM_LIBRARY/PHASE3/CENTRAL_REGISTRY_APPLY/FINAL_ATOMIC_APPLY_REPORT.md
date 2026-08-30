# PHASE 3 — Central Registry atomic apply final report

Authority: **Product Owner — Adrian Muscalu**
Apply timestamp: `2026-08-29T18:15:07.867Z`

## Result

- Central Registry: **798 → 815**;
- additions / modifications / deletions: **17 / 0 / 0**;
- AUTHORITATIVE_WITH_SCOPE / CONTEXTUAL: **13 / 4**;
- atomic apply: **PASS**;
- partial apply: **NONE**;
- post-apply validation: **PASS**;
- traceability: **PASS**.

## Integrity

- approved canonical sources present: **17/17**;
- canonical artifact hash and byte-size match: **17/17**;
- provenance match: **17/17**;
- existing source entries unchanged: **798/798**;
- deleted existing sources: **0**;
- pre-apply SHA-256: `1c506707200d6c8b27217cdf00d00541a739ef5321bde1e5f892cb9098e61a34`;
- post-apply SHA-256: `af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31`.

## Regressions and idempotence

- PHASE 1 post-apply regression: **PASS**;
- PHASE 2 post-apply regression: **PASS**;
- PHASE 3 post-apply validation: **PASS**;
- integrity package generator idempotence: **PASS**;
- registry regeneration idempotence: **PASS / NO-OP**;
- Basic Librarian hashes: **3/3 MATCH / UNCHANGED**.

The historical PHASE 1 and PHASE 2 packages and validators remain preserved.
Post-apply regression uses the pre-apply hash baselines because the historical
PHASE 1 validator intentionally describes the former 798-source snapshot.

## Open gaps and boundaries

- `ROUTING-TOLL-001` = OPEN;
- `LEGAL-003` = OPEN;
- `LEGAL-005` = OPEN;
- runtime / Production / TURN / architecture: **NO CHANGE**;
- commit / push: **NOT EXECUTED**.

## Controlled recovery journal

The first apply attempt stopped before mutation because Windows rejected
`fsync` on a read-only descriptor with `EPERM`. Registry count and SHA-256 were
verified as 798 and the original pre-apply hash. The durability probe was
replaced with write → readback → SHA-256 verification. The minimal retry then
completed atomically. No rollback was needed.

The exact pre-apply snapshot is retained at
`AGM_LIBRARY/PHASE3/CENTRAL_REGISTRY_APPLY/PRE_APPLY_CANONICAL_SOURCES.json`.
The guarded rollback script accepts only the exact applied registry hash and
restores the exact 798-source snapshot if a separately detected post-apply
failure requires it.

**STOP FOR PRODUCT OWNER REVIEW.**
