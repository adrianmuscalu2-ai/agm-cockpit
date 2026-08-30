# AS-IS architecture report

Study date: 2026-08-29
Mode: READ-ONLY IMPACT STUDY
Baseline: Phase 3 closed; Central Registry 815; runtime, Production and TURN unchanged

## Authority and data flow

```text
Original artifacts (preserved in place)
        |
        v
AGM Central Registry (815 canonical source records)
        |
        +--> domain-memberships / source-domain-mapping (Phase 1 snapshot: 798 sources)
        |          |
        |          +--> controlled domain views (reference indexes only)
        |
        +--> Phase 2/3 acquisition, integrity and governance evidence

AGM Central Librarian --> documentary indexing, integrity, traceability and conflict reporting
Basic Librarian       --> separate linguistic/message/terminology workflow
Runtime consumers     --> no direct Central Registry/domain-view consumption demonstrated
```

## Current responsibilities

| Component | Current role | Authority | Demonstrated consumers |
|---|---|---|---|
| Central Registry | Canonical identity and metadata for each source: path/URI, hash, size, version, status, owner, authority, provenance, retention and supersession | `SINGLE_SOURCE_OF_TRUTH`; reference-only, no library copy | Phase 1-3 generators, validators and documentary governance packages |
| AGM Central Librarian | Cataloguing, classification, version linkage, hash/integrity checks, duplicate/conflict/gap reporting and retrieval | Documentary only; no runtime, legal approval, source deletion or silent conflict resolution | Car Mover archive and central documentary governance |
| Domain views | Controlled lists of `membershipId` + `sourceId` | Reference/index only; cannot change source metadata | Foundation tests and documentary discovery |
| Basic Librarian | Reusable-message and terminology authority for Basic/PRE-005; human confirmation required | Linguistic scope only | Application agent registry and Maintenance UI |
| Car Mover archive | Preserved original documents/evidence plus documentary catalogues | Component context inside AGM Premium; not a separate product | AGM Central Librarian documentary workflow |

## Measured state

| Metric | Value | Interpretation |
|---|---:|---|
| Central canonical sources | 815 | Current Phase 3 authority baseline |
| Registry SHA-256 | `af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31` | Phase 3 post-apply evidence |
| Sources represented in domain mapping | 798 | Phase 1 mapping snapshot |
| Domain memberships | 1,466 | Logical reuse across domain views |
| Phase 3 sources not represented in mappings/views | 17 | Propagation lag; not a registry integrity failure |
| Sources with two or more domain memberships | 374 | Cross-domain reuse is common, not exceptional |
| Maximum domains for one mapped source | 6 | A single-domain ownership model would fragment current reuse |
| Duplicate canonical paths in Central Registry | 0 groups | No two canonical records point to the same canonical path |
| Equal-content SHA-256 groups | 62 groups / 257 records | Physical/evidence duplication exists in the preserved corpus |
| Car Mover version families | 94 | Historical/version relationships require retention, not deletion |
| Car Mover documented conflicts | 1 | Must remain `CONFLICT DETECTED` until human review |
| Car Mover missing/partial items in historical consolidation | 7 | Historical report; later phases may add evidence but history is not rewritten |

## Current views

| View | Membership count | Authority status |
|---|---:|---|
| Common Platform | 34 | CONTROLLED_VIEW |
| Car Mover | 798 | CONTROLLED_VIEW |
| Routing / Toll | 261 | CONTROLLED_VIEW |
| Documents / OCR / Evidence | 163 | CONTROLLED_VIEW |
| Opportunity / Communications | 139 | CONTROLLED_VIEW |
| Tacho | 31 | CANDIDATE_NOT_AUTHORITATIVE |
| Legislation / Safety | 40 | CANDIDATE_NOT_AUTHORITATIVE |

The view counts are valid Phase 1 snapshots, but they are not a complete 815-source projection after Phase 3. The 17 Phase 3 additions are authoritative centrally according to their approved scope but are not yet discoverable through domain membership. This is an **index propagation lag**. It must not be repaired under this study mandate.

## Duplicate taxonomy

1. **Logical reuse:** one `sourceId` has multiple domain memberships. This is desired and prevents domain copies.
2. **Physical/evidence duplicate:** different preserved paths have the same SHA-256. This can reflect local preservation, archive, test evidence, screenshots or generated artifacts. It is reportable but cannot be removed automatically.
3. **Version family:** related historical/current artifacts have different hashes. They require explicit supersession/version links.
4. **Semantic overlap:** different sources cover related rules. It requires scoped authority and human conflict review, not hash deduplication.

## Source of truth today

- Source identity and canonical metadata: **AGM Central Registry**.
- Original bytes: the `canonicalPath` artifact identified and hashed by the registry; originals remain preserved.
- Domain relevance: controlled memberships/views, subordinate to Central Registry.
- Domain applicability decisions: human domain owner/reviewer; not the Librarian and not a view.
- Basic linguistic truth: Basic Librarian's existing PRE-005/application contracts, separate from the central documentary corpus.

## Open authority conditions

The following gaps remain open and cannot be closed by cross-domain reuse or source presence alone:

- `ROUTING-TOLL-001`;
- `LEGAL-003`;
- `LEGAL-005`.

`UNKNOWN` remains unknown. Central registration does not make a derived rule safe, current for every jurisdiction, or operationally applicable.
