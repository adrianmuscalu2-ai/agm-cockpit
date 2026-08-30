# ROUTING-TOLL-001 — closure-readiness assessment

Assessment date: `2026-08-29`
Mandate: `PRODUCT OWNER MANDATE — ROUTING-TOLL-001`
Gap state after assessment: `OPEN`
Closure performed: `NO`

## Executive verdict

`PARTIALLY_READY`

Official primary candidates can be demonstrated for substantial parts of all ten required jurisdictions, and the stale Luxembourg candidate can be replaced by a newer official Customs source. The gap is not ready to close because none of those external authorities is present in the 815-source Central Registry, none has a verified canonical artifact/hash in this assessment, light/passenger and special-infrastructure coverage is incomplete, France remains concession-fragmented, and the required source-update mechanism does not exist.

The verdict is about closure readiness only. It does not close `ROUTING-TOLL-001` and does not authorize a Registry mutation.

## 1. Exact historical gap

The original Phase 1 record defines the required source as:

> Official toll and vignette authority registry with jurisdiction, update cadence and effective dates.

Exact fields recovered from `AGM_LIBRARY/REPORTS/canonical-source-gaps.phase2.json`:

- expected issuing body: country-specific official toll and road authorities;
- jurisdictions: `DE`, `AT`, `CH`, `FR`, `BE`, `NL`, `LU`, `PL`, `CZ`, `DK`;
- owner: `Mobility & Routing Steward`;
- retention: permanent version and jurisdiction history;
- review state: `MISSING_CANONICAL_OFFICIAL_SOURCE_REGISTRY`;
- URI, version, effective date and checksum: all originally `null`.

The linked historical evidence, `CAR_MOVER/CONFLICTS_AND_GAPS.json#CM-MISSING-004`, adds a second requirement: a runtime-ready AGM Toll Library specification and a verified source-update runbook. That runtime requirement remains `MISSING_BY_DESIGN`. This mandate does not permit runtime work, so it cannot be silently satisfied here.

### Preserved scope boundary

- General route computation is not the missing authority source. TOM/cache and controlled fallback are internal architecture concerns.
- For this gap, routing means mapping an actual route/network segment to the correct toll or vignette regime.
- General road restrictions are governed by `LEGAL-005`, which remains OPEN and unchanged.
- `LEGAL-003` also remains OPEN and unchanged.
- Field observations are operational evidence, not official tariff or legal authority.

## 2. Current 815-source / 263-view coverage audit

Every one of the 263 Routing/Toll memberships was joined to the Central Registry and its artifact hash was verified.

| Classification | Count | Contribution to ROUTING-TOLL-001 |
|---|---:|---|
| `AUTHORITATIVE_WITH_SCOPE` | 2 | Internal AGM architecture and field protocol only |
| `CANDIDATE_NOT_AUTHORITATIVE` | 91 | Current/draft internal implementation or documentation; no external authority |
| `HISTORICAL_OR_EVIDENCE` | 170 | Preserved history, tests and evidence; no current external authority |
| External official toll authorities in Registry | 0 | No closure coverage |
| Formally `CONTEXTUAL` authority records | 0 | None |

Integrity result:

- evaluated sources: `263/263`;
- local artifacts present: `263/263`;
- artifact SHA-256 matches: `263/263`;
- mismatches: `0`;
- unique content hashes: `248`;
- duplicate hash groups: `3`, containing `18` governed records;
- canonical duplication introduced by this assessment: `0`.

The two internal authorities are:

1. `CS-AGM-CM-ARCH-V1` — internal Car Mover architecture and provider boundary. It cannot establish a national toll obligation or tariff.
2. `CS-AGM-CM-FIELD-RUNBOOK-V1` — controlled field protocol. It cannot convert measured evidence into official toll truth.

The complete per-source audit is `ROUTING_TOLL_VIEW_263_SOURCE_AUDIT.json`.

## 3. Requirement → evidence → residual matrix

| Requirement | Existing sourceId(s) | Authority/scope | Coverage | Residual gap | Proposed action |
|---|---|---|---|---|---|
| Official authority registry for ten jurisdictions | Two AGM internal sources only | Internal, not national toll authority | NOT COVERED | Zero official external sources in Registry | Integrity acquisition + human review + separate atomic Registry mandate |
| Ten-jurisdiction coverage | None registered; 11 Phase 2 candidates excluded | National heavy coverage is broadly discoverable | PARTIAL | FR fragmented; LU replacement review; light/special systems incomplete | Build a per-jurisdiction canonical bundle |
| AGM vehicle classes | None externally authoritative | Heavy candidates cover only part of current class model | PARTIAL | Passenger, light commercial, trailer, van and special cases incomplete | Explicit vehicle-class-to-legal-band mapping; UNKNOWN requires confirmation |
| Tolled network/route segments | `CS-AGM-CM-ARCH-V1` | Internal routing policy only | PARTIAL | No governed official network set | Acquire official network/map artifacts |
| Effective tariffs | None registered | Dynamic official pages exist outside Registry | PARTIAL | No captured/hash-verified tariff set; FR grids distributed | Capture immutable artifacts or timestamp/hash dynamic pages |
| Vignettes/light vehicles | None registered | Candidate complements identified | PARTIAL | AT/CZ light, DK bridges, NL A24, PL concessions incomplete | Review nine new/replacement candidates and remaining operator families |
| Exemptions/negative applicability | None registered | Unverified national guidance | PARTIAL | UNKNOWN could be incorrectly treated as zero | Require official negative-applicability evidence |
| Freshness/update cadence | Field runbook only | Not a source refresh mechanism | NOT COVERED | No per-source cadence, invalidation or stale-data control | Separate documentary governance mandate; no runtime activation here |
| Provenance/artifact integrity | None registered | Phase 2 URLs only; SHA-256 null | NOT COVERED | No verified canonical artifacts | Remote canonical integrity acquisition |
| Operational evidence | `CS-AGM-CM-FIELD-RUNBOOK-V1` | Internal evidence governance | PARTIAL | No sufficient field sample; never substitutes authority | Preserve as non-conclusive field evidence |
| General route computation | `CS-AGM-CM-ARCH-V1` | TOM/cache architecture | OUT OF GAP SCOPE | None for this gap | Do not broaden the gap |
| General road restrictions | None | `LEGAL-005` scope | OUT OF GAP SCOPE | `LEGAL-005` remains OPEN | No action under this mandate |

The complete machine-readable matrix is `ROUTING_TOLL_001_REQUIREMENT_MATRIX.json`.

## 4. Official candidate reassessment

Twenty official-source candidates were assessed:

- 11 existing Phase 2 candidates, still outside the Registry;
- 9 new, complementary or replacement proposals discovered during this assessment;
- 0 candidate artifacts assigned a fabricated hash;
- 0 candidate promoted or registered.

Material findings by jurisdiction:

- **DE:** BFStrMG and Toll Collect support the goods-vehicle regime above 3.5 t. Passenger/special-facility negative applicability still needs an explicit governed scope decision.
- **AT:** the GO source covers vehicles above 3.5 t; a separate official vignette/section-toll source is required for the default passenger-car path.
- **CH:** BAZG provides official heavy-charge and vignette entry points, but page-level artifacts, tariffs and effective dates must be captured.
- **BE:** Viapass is official; the broad portal is insufficient by itself. A dated regional tariff table and toll maps are required.
- **PL:** e-TOLL covers heavy vehicles/buses, not a complete passenger concession-motorway set.
- **CZ:** myto covers vehicles above 3.5 t; eDalnice is a separate official light-vehicle vignette source.
- **DK:** KmToll covers freight trucks at least 12 t. Storebælt and Øresund crossings are separate charge systems and cannot be inferred from KmToll.
- **NL:** truck toll and the A24 fixed toll are separate regimes; the official A24 guidance also establishes a non-stacking rule on tolled roads.
- **FR:** the Ministry and transport regulator establish the official framework and tariff-governance process, but exact current route/class grids remain distributed across concessionaires.
- **LU:** the 2019 Guichet source must remain historical. Customs now publishes a newer Eurovignette page and a tariff artifact effective 2025-03-25, but currentness and the Netherlands-withdrawal wording require human review before use.

All proposal details and URLs are in `PROPOSED_OFFICIAL_SOURCE_CANDIDATES.json`.

## 5. Overlaps, conflicts and freshness risks

### Complementary overlaps

- legislation defines obligation; operator pages define current operational rates;
- heavy and light systems in AT, CZ, DK and NL are distinct rather than duplicates;
- network maps and rate tables must be linked to one authority bundle, not copied into competing canonical records;
- French Ministry and regulator sources explain governance but do not replace concession-specific grids.

### Conflicts / risks

1. Luxembourg’s old Guichet page is stale. The newer Customs page still contains multi-country Eurovignette wording that may lag the Netherlands’ 2026 transition; do not treat it as automatically current.
2. France has no single captured official route-to-tariff dataset in the assessed material.
3. Dynamic pages can change without a stable filename/version. Retrieval timestamps alone do not prove which tariff was used for a past calculation.
4. Several Phase 2 candidates are landing pages, not exact tariff/network artifacts.
5. Planned future rules must not be applied early. Denmark’s wider weight scope and other announced changes need effective-date gates.
6. Passenger-car “no toll” cannot be inferred from the absence of a heavy-goods charge; special roads, bridges, tunnels and concessions may still charge.

No contradictory registered authorities exist because the external candidates were never added. The conflict is residual candidate/freshness uncertainty, not a Central Registry conflict.

## 6. Quantified outcome

- existing Routing/Toll sources evaluated: `263`;
- authoritative sources applicable: `2 internal / 0 external official`;
- formally contextual sources applicable: `0`;
- current/draft unassessed candidates in view: `91`;
- historical/evidence sources: `170`;
- Phase 2 official candidates reassessed: `11`;
- new/replacement official candidates proposed: `9`;
- total official candidates considered: `20`;
- unresolved requirement groups: `7 material groups` (registry authority, full jurisdiction bundles, complete vehicle scope, official network mapping, complete effective tariffs, freshness/update mechanism, canonical integrity);
- gap state: `OPEN`;
- automatic closure: `NO`.

## 7. Closure recommendation

`PARTIALLY_READY`

Recommended next gate, requiring a separate Product Owner mandate:

1. freeze the exact intended toll scope, especially special infrastructure and passenger concessions;
2. acquire immutable official artifacts for the 20 assessed candidates and fill MIME/bytes/SHA-256/retrieval metadata;
3. close the remaining PL passenger and FR concession tariff families, or explicitly exclude them by human decision;
4. obtain human authority/applicability decisions per jurisdiction and vehicle band;
5. propose an atomic Registry changeset—no partial additions;
6. separately design and approve the source-update/freshness runbook;
7. only then reassess `READY_FOR_CLOSURE`.

## 8. Protection confirmation

- Central Registry: `815`, unchanged;
- Central Registry SHA-256: `af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31`;
- Routing/Toll view: `263`, unchanged;
- Basic Librarian: `3/3` protected hashes match;
- `ROUTING-TOLL-001`: `OPEN`;
- `LEGAL-003`: `OPEN / UNCHANGED`;
- `LEGAL-005`: `OPEN / UNCHANGED`;
- Registry/domain-view/runtime/Production/TURN/application/API changes: `NONE`;
- commit/push: `NOT EXECUTED`.
