# Phase 3 domain-view reconciliation — BEFORE / AFTER

Reconciliation version: `1.1.0`
Generated at: `2026-08-29T21:19:48.538Z`
Mode: DOCUMENTARY / INDEX PROPAGATION ONLY

## Transition

- Central Registry: **815 -> 815**, SHA-256 `af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31`;
- mapped sources: **798 -> 815**;
- domain memberships: **1,466 -> 1487**;
- Phase 3 sourceIds reconciled: **17/17**;
- canonical artifacts copied: **0**;
- existing canonical records modified/deleted/reclassified: **0/0/0**;
- unresolved gaps: **3 / OPEN / UNCHANGED**.

## Source-level reconciliation

| # | sourceId | Authority classification | Previous views | Resulting views | Cross-domain | Canonical artifact | SHA-256 | Affected gap(s) | Mapping closes gap |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | `CS-AGM-CM-ARCH-V1` | AUTHORITATIVE_WITH_SCOPE | NONE | car-mover, routing-toll | YES | `AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/CAR_MOVER_ARCHITECTURE_SPEC.v1.md` | `1a592c5d4f41bc27f541c5ba867b8bf3a1b2b2b3955a533b115feae436fd6bc2` | CAR-MOVER-001 | **NO** |
| 2 | `CS-AGM-CM-FIELD-RUNBOOK-V1` | AUTHORITATIVE_WITH_SCOPE | NONE | car-mover, routing-toll | YES | `AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/FIELD_TESTER_CLIENT_RUNBOOK.v1.md` | `4d9b92e65372cb80b88369e7e04a0c355b99ec87e47c407ac08763091202891f` | FIELD-001 | **NO** |
| 3 | `CS-AGM-CM-JOB-V1` | AUTHORITATIVE_WITH_SCOPE | NONE | car-mover, documents-ocr-evidence | YES | `AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/CAR_MOVER_JOB_FILE_SPEC.v1.md` | `5061bce734fee8ce0e0a5c42729985091fc3b5e660ce60025131c9ef6fc22971` | CAR-MOVER-002 | **NO** |
| 4 | `CS-AGM-CM-OCR-EVIDENCE-V1` | AUTHORITATIVE_WITH_SCOPE | NONE | car-mover, documents-ocr-evidence | YES | `AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/CAR_MOVER_OCR_EVIDENCE_CONTRACT.v1.md` | `fe613d7bb1339def15340e12a46756f34f6a80fef3f8a9ca9f80d3ae151811eb` | DOCS-001 | **NO** |
| 5 | `CS-AGM-TACHO-CHANGE-MAP-V1` | CONTEXTUAL | NONE | tacho | NO | `AGM_LIBRARY/PHASE2/CANONICAL_INTERNAL/TACHO_CHANGE_MAP.v1.md` | `6fcb9865f6d7265ca42919df79c8466c0aefc3966c7e79f92953b5c04e3088d9` | TACHO-005 | **NO** |
| 6 | `CS-DE-FPERSG` | AUTHORITATIVE_WITH_SCOPE | NONE | tacho | NO | `AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-DE-FPERSG.official.de.pdf` | `6f190e7c847325f315332419e2a4ea9485b7be01bbcc43b1da34f521dc6647c8` | TACHO-004, TACHO-005 | **NO** |
| 7 | `CS-DE-FPERSV` | AUTHORITATIVE_WITH_SCOPE | NONE | tacho | NO | `AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-DE-FPERSV.official.de.pdf` | `a8fa3807f0591b15612ea6cfb3b989ea59a0fc1640acbaeb6e6d376d9f0ccc30` | TACHO-004, TACHO-005 | **NO** |
| 8 | `CS-DE-GGVSEB` | AUTHORITATIVE_WITH_SCOPE | NONE | legislation-safety | NO | `AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-DE-GGVSEB.official.de.pdf` | `7946383522dcf0b4af414df08e7094e26a954c8122b49fb9badd6c76148561d1` | LEGAL-004 | **NO** |
| 9 | `CS-DE-STVO` | AUTHORITATIVE_WITH_SCOPE | NONE | legislation-safety | NO | `AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-DE-STVO.official.de.pdf` | `0173e104e503f6abfdd5b081aa6b0bb5ea816ce1c1613f50f3dfecdf9ec68559` | LEGAL-001, LEGAL-003, LEGAL-005 | **NO** |
| 10 | `CS-DE-STVZO` | AUTHORITATIVE_WITH_SCOPE | NONE | legislation-safety | NO | `AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-DE-STVZO.official.de.pdf` | `8ea9a586a934be85736639167e2e5fe1013158159447665cff8bb13d72471f5b` | LEGAL-002 | **NO** |
| 11 | `CS-EU-IMPL-REG-2016-799` | AUTHORITATIVE_WITH_SCOPE | NONE | tacho | NO | `AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-EU-IMPL-REG-2016-799.official.en.pdf` | `038779b8740bde02689e7167862ef9ccf1358d7a06cb5fa87f280c9315a92c6b` | TACHO-003, TACHO-005 | **NO** |
| 12 | `CS-EU-IMPL-REG-2016-799-CONS-20230821` | CONTEXTUAL | NONE | tacho | NO | `AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-EU-IMPL-REG-2016-799-CONS-20230821.official.en.pdf` | `3986fb1c3420743a8921733418d9380e3f7f7f7bb08ee86d4fc349cb60504576` | TACHO-003, TACHO-005 | **NO** |
| 13 | `CS-EU-REG-165-2014` | AUTHORITATIVE_WITH_SCOPE | NONE | tacho | NO | `AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-EU-REG-165-2014.official.en.pdf` | `e472a0b04525bba513349f826c80faf39cc609978d9875a6e53126b3a41a2898` | TACHO-002, TACHO-005 | **NO** |
| 14 | `CS-EU-REG-165-2014-CONS-20241231` | CONTEXTUAL | NONE | tacho | NO | `AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-EU-REG-165-2014-CONS-20241231.official.en.pdf` | `1b302c6b3dd9467ab3b5939ab5314fcd34606dec2ead722276ac2c0330c2f0ec` | TACHO-002, TACHO-005 | **NO** |
| 15 | `CS-EU-REG-561-2006` | AUTHORITATIVE_WITH_SCOPE | NONE | tacho | NO | `AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-EU-REG-561-2006.official.en.html` | `a45bc455de4f7928d781bc8c237f0c56450c99f878555008d5e116f675ce9d1e` | TACHO-001, TACHO-005 | **NO** |
| 16 | `CS-EU-REG-561-2006-CONS-20241231` | CONTEXTUAL | NONE | tacho | NO | `AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-EU-REG-561-2006-CONS-20241231.official.en.pdf` | `3c36e849d222cf7e7367ae9b246c7506dc801b1ee1cc697fa3db2acbe80f569b` | TACHO-001, TACHO-005 | **NO** |
| 17 | `CS-UNECE-ADR-2025` | AUTHORITATIVE_WITH_SCOPE | NONE | legislation-safety | NO | `AGM_LIBRARY/PHASE3/REMOTE_CANONICAL_INTEGRITY/ARTIFACTS/CS-UNECE-ADR-2025.official.en.pdf` | `745d45dee198db7e65c9f5e983b6d6e174d33ffb470b72ff0439b7be7a90cd66` | LEGAL-004 | **NO** |

## Governance notes

- A domain membership is a controlled reference; it does not alter the source authority record.
- Tacho and Legislation/Safety view-level status remains `CANDIDATE_NOT_AUTHORITATIVE`; Central Registry classifications remain unchanged.
- `CS-DE-STVO` is mapped only to Legislation/Safety. Its authority remains limited to the Product Owner decision for `LEGAL-001`; `LEGAL-003` and `LEGAL-005` remain open.
- Contextual consolidated EU texts and the AGM Tacho change map do not acquire independent legal authority through membership.
- Field evidence remains evidence/non-conclusive; its protocol mapping does not authorize Production or provider activation.

## Scope

- BASIC LIBRARIAN = UNCHANGED
- RUNTIME / PRODUCTION / TURN = NO CHANGE
- APPLICATION / API / SCHEMA / INFRASTRUCTURE = NO CHANGE
- COMMIT / PUSH = NOT EXECUTED
