# Risk register

Scale: likelihood (L) and impact (I) are LOW/MEDIUM/HIGH. Residual risk assumes Option A+ controls, not implementation under this mandate.

| ID | Risk | L | I | Primary mitigation | Residual |
|---|---|---|---|---|---|
| R-01 | Registry and views diverge, as shown by 815 central vs 798 mapped | HIGH | HIGH | Atomic projection package; manifest binds registry and membership hashes; explicit unassigned-source gate | LOW-MEDIUM |
| R-02 | Same cross-domain source forks into independent versions | MEDIUM | HIGH | One source ID/authority/artifact; memberships only; prohibit domain canonical copies | LOW |
| R-03 | Domain metadata silently broadens legal authority | MEDIUM | HIGH | Domain applicability may narrow but not broaden central scope; human review and diff | LOW-MEDIUM |
| R-04 | UNKNOWN is treated as SAFE/PASS/ZERO | MEDIUM | HIGH | Typed UNKNOWN/STALE/CONFLICT results and fail-closed consumer policy | LOW-MEDIUM |
| R-05 | Dynamic toll/restriction data becomes stale | HIGH | HIGH | Freshness/effective-date gates; country-specific owner; keep `ROUTING-TOLL-001` open | MEDIUM |
| R-06 | Licensed VDI content is reconstructed from summaries | MEDIUM | HIGH | Keep `LEGAL-003` open; licensed primary source only; contextual metadata cannot substitute | LOW |
| R-07 | Incomplete country coverage appears complete | MEDIUM | HIGH | Keep `LEGAL-005` open; jurisdiction coverage matrix; visible unsupported result | LOW-MEDIUM |
| R-08 | OCR/translation/summary is mistaken for canonical evidence | MEDIUM | HIGH | Derived lineage, artifact hash, verification state and original-document link | LOW |
| R-09 | Equal hashes trigger deletion of valid historical/evidence paths | MEDIUM | MEDIUM | Distinguish physical duplicates from aliases and versions; no automatic deletion | LOW |
| R-10 | Central Registry is a read availability single point | LOW-MEDIUM | HIGH | Immutable signed/version-pinned snapshots; last-known-valid view; serialized writes | LOW-MEDIUM |
| R-11 | Domain cache serves stale content after canonical update | MEDIUM | HIGH | Cache key includes source hash/registry version; dependency invalidation | LOW |
| R-12 | Distributed domain SOTs conflict | HIGH under B | HIGH | Reject Option B | N/A under A |
| R-13 | Basic gains unintended legal/runtime authority | LOW-MEDIUM | HIGH | Keep Basic separate; only separately approved linguistic export could cross boundary | LOW |
| R-14 | AGM Central Librarian becomes autonomous approver | MEDIUM | HIGH | Contract enforces analysis/proposal only; human approval records mandatory | LOW |
| R-15 | Car Mover is treated as separate product/project | LOW-MEDIUM | MEDIUM | Preserve current Owner boundary: AGM Premium component with distinct information context | LOW |
| R-16 | Supersession is modeled as replacement when acts merely amend each other | MEDIUM | HIGH | Explicit relation types and domain review; preserve originals/consolidations separately | LOW-MEDIUM |
| R-17 | Rollback rewrites authority/history | LOW-MEDIUM | HIGH | Roll back view pointer, not human decision; immutable manifests/evidence | LOW |
| R-18 | Future runtime consumer assumes central registration equals operational applicability | MEDIUM | HIGH | Separate source authority from rule/applicability/published-consumer gates | LOW-MEDIUM |

## Domain concentration

| Domain | Dominant risks | Overall risk before controls |
|---|---|---|
| Tacho | Applicability by operation/vehicle/date; amendment graph; owner designation | HIGH |
| Legislation / Safety | Jurisdiction, licensed standards, incomplete coverage, legal currency | HIGH |
| Routing / Toll | Dynamic rates/restrictions, fragmented official sources, availability | HIGH |
| Car Mover | Cross-domain context, human confirmation, component boundary | MEDIUM-HIGH |
| Documents / OCR / Evidence | Derived truth, retention and custody | MEDIUM-HIGH |
| Basic | Authority leakage if connected directly | LOW now / HIGH if merged |

## Stop conditions for any future implementation

- source count/hash differs unexpectedly;
- an existing canonical record changes without approved diff;
- a view references a missing source ID;
- any domain copy claims canonical authority;
- any open gap closes without explicit human decision;
- Basic protected hashes drift;
- unknown or stale data is promoted to operational PASS;
- runtime/Production/TURN changes appear without separate authority.
