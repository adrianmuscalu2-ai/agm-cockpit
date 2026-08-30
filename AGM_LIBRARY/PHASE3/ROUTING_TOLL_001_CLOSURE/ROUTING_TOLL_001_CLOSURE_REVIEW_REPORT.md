# ROUTING-TOLL-001 — controlled closure review package

Generated: `2026-08-30T00:00:00.000Z`
Recommendation: `REMAINS_PARTIALLY_READY`
Gap state: `OPEN`

## Outcome

- review candidates: `20/20`;
- official artifacts captured: `20/20`;
- captured artifact hashes verified: `20/20`;
- proposed Registry additions after separate approval: `16`;
- proposed classifications: `12 AUTHORITATIVE_WITH_SCOPE + 4 CONTEXTUAL`;
- current Registry/view mutation: `NONE`;
- automatic promotion: `NONE`.

## Candidate dispositions

| Input candidate | Proposed sourceId | Jurisdiction | Disposition | Scope |
|---|---|---|---|---|
| CS-DE-TOLL-COLLECT-RATES | CS-DE-TOLL-COLLECT-RATES | DE | PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE | DE_HEAVY_OPERATIONAL_RATES |
| CS-DE-BFSTRMG | CS-DE-BFSTRMG | DE | PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE | DE_HEAVY_LEGAL_BASIS |
| CS-AT-ASFINAG-GO-TOLL | CS-AT-ASFINAG-GO-TOLL | AT | PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE | AT_GO_OVER_3_5T |
| RT001-PROP-AT-VIGNETTE-SECTION-2026 | CS-AT-ASFINAG-VIGNETTE-SECTION-2026 | AT | PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE | AT_VIGNETTE_AND_SECTION_UP_TO_3_5T |
| CS-CH-BAZG-ROAD-LEVIES | CS-CH-BAZG-ROAD-LEVIES | CH | KEEP_CANDIDATE_REFINEMENT_REQUIRED | CH_PORTAL_ONLY |
| CS-BE-VIAPASS | CS-BE-VIAPASS | BE | PROPOSE_ADD_CONTEXTUAL | BE_AUTHORITY_AND_SCOPE_PORTAL |
| RT001-PROP-BE-VIAPASS-RATES-2026 | CS-BE-VIAPASS-RATES-2026 | BE | PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE | BE_HEAVY_REGIONAL_RATES |
| CS-PL-ETOLL-RATES | CS-PL-ETOLL-RATES | PL | PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE | PL_HEAVY_ETOLL |
| CS-CZ-MYTO-RATES-2026 | CS-CZ-MYTO-RATES-2026 | CZ | PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE | CZ_MYTO_OVER_3_5T |
| RT001-PROP-CZ-EDALNICE-LIGHT | CS-CZ-EDALNICE-VIGNETTE-2026 | CZ | PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE | CZ_EDALNICE_UP_TO_3_5T |
| CS-DK-KMTOLL-EETS | CS-DK-KMTOLL-EETS | DK | PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE | DK_KMTOLL_NETWORK_12T_PLUS |
| RT001-PROP-DK-STOREBAELT-2026 | CS-DK-STOREBAELT-RATES-2026 | DK | PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE | DK_STOREBAELT_FIXED_TOLL |
| RT001-PROP-DK-ORESUND-2026 | CS-DK-SE-ORESUND-RATES-2026 | DK/SE cross-border infrastructure | PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE | DK_SE_ORESUND_FIXED_TOLL |
| CS-NL-TRUCK-TOLL | CS-NL-TRUCK-TOLL | NL | PROPOSE_ADD_CONTEXTUAL | NL_TRUCK_AUTHORITY_PORTAL |
| RT001-PROP-NL-A24-ETOL-2026 | CS-NL-A24-ETOL-2026 | NL | PROPOSE_ADD_AUTHORITATIVE_WITH_SCOPE | NL_A24_FIXED_TOLL |
| CS-FR-MOTORWAY-TOLLS | CS-FR-MOTORWAY-TOLLS | FR | PROPOSE_ADD_CONTEXTUAL | FR_CONCESSION_FRAMEWORK |
| RT001-PROP-FR-ART-TARIFF-GOVERNANCE | CS-FR-ART-TARIFF-GOVERNANCE | FR | PROPOSE_ADD_CONTEXTUAL | FR_TARIFF_GOVERNANCE |
| CS-LU-EVIGNETTE-2019 | CS-LU-EVIGNETTE-2019 | LU | KEEP_HISTORICAL_DO_NOT_PROMOTE | LU_STALE_HISTORICAL_GUIDANCE |
| RT001-PROP-LU-CUSTOMS-EUROVIGNETTE | CS-LU-CUSTOMS-EUROVIGNETTE | LU | KEEP_CANDIDATE_CURRENTNESS_REVIEW_REQUIRED | LU_HEAVY_SCOPE_PORTAL |
| RT001-PROP-LU-EUROVIGNETTE-TARIFF-20250325 | CS-LU-EUROVIGNETTE-TARIFF-20250325 | LU | KEEP_CANDIDATE_CURRENTNESS_REVIEW_REQUIRED | LU_HEAVY_TARIFF_2025 |

## Coverage summary

| Status | Regime rows |
|---|---:|
| COVERED_FOR_OWNER_REVIEW | 11 |
| PARTIAL | 6 |
| CONTEXT_ONLY | 1 |
| MISSING | 6 |

The package preserves Austria vignette/section/GO, Czech eDalnice/myto, Denmark KmToll/bridges, Netherlands A24/truck charging and France framework/concession tariff separation. No source is allowed to cover a sibling regime by inference.

## Why closure is not yet ready

- `RT001-RES-001` — FR: Complete current concessionaire route/class tariff grids.
- `RT001-RES-002` — PL: Official passenger/light concession motorway tariffs.
- `RT001-RES-003` — CH: Exact current LSVA and vignette tariff/effective artifacts.
- `RT001-RES-004` — LU: Human-verified 2026 applicability and current tariff status.
- `RT001-RES-005` — BE/NL/DE: Separately governed tunnel/facility coverage or explicit human exclusion.
- `RT001-RES-006` — DK/NL: Exact current distance-charge tariff artifacts.
- `RT001-RES-007` — ALL: Per-source freshness, invalidation and stale-data runbook.
- `RT001-RES-008` — ALL: Human authority/applicability decisions for every proposed source.

## Proposed Registry review impact

If, and only if, the Product Owner later approves the atomic proposal:

- Central Registry: `815 → 831`;
- Routing/Toll view: `263 → 279`;
- ADD/MODIFY/DELETE: `16/0/0`;
- the gap remains OPEN until the residual matrix is resolved and a separate closure decision is issued.

## Protections

- Central Registry SHA-256: `af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31`;
- Registry source count: `815`;
- Routing/Toll view count: `263`;
- Basic Librarian, LEGAL-003, LEGAL-005, runtime, Production, TURN, application and API: `NO CHANGE`;
- commit/push: `NOT EXECUTED`.
