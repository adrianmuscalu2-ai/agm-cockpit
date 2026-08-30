# Final architectural recommendation

## Executive verdict

**Recommended architecture: OPTION A+** — Central Registry remains the single source of truth; specialized libraries are controlled, versioned views/indexes with domain applicability metadata and optional non-authoritative derived caches.

**Secondary alternative: OPTION C, WITH CONDITIONS** — only when domain artifacts are content-addressed caches or derived products with complete lineage. They must never become independent canonical copies.

**Rejected: OPTION B** — domain sources of truth plus federation. The existing corpus already has 374 cross-domain sources and up to six memberships per source; multiple domain authorities would create divergent versions, hashes and applicability claims.

## Target shape

```text
Human authority / domain reviewers
              |
              v
AGM Central Registry — identity, authority, version, hash, provenance, retention
              |
              v
AGM Central Librarian — governance orchestration, validation, query/index, audit trail
              |
      +-------+-------+---------+---------+---------+
      v               v         v         v         v
   Tacho          Legal/Safety Routing/Toll Car Mover Docs/OCR/Evidence
 controlled views + applicability metadata + derived lineage; no canonical copies
              |
              v
Future version-pinned consumers (separate runtime mandate)

Basic Librarian — remains separate and unchanged
```

## Data ownership rule

**ONE SOURCE ID -> ONE CANONICAL AUTHORITY RECORD -> ONE VERIFIED CANONICAL ARTIFACT -> MULTIPLE DOMAIN VIEWS.**

Domain ownership applies to relevance, applicability, consumer policy and derived rules. It does not confer authority to alter source identity, classification, version, hash, provenance or retention.

## Subsystem impact

| Subsystem | Impact | Reason |
|---|---|---|
| Central Registry | MEDIUM | Remains SOT; future propagation manifest/gates needed, not a new authority model |
| AGM Central Librarian | MEDIUM | Becomes multi-domain governance/query coordinator; still no autonomous approval/runtime |
| Basic Librarian | LOW / NONE | Remains completely separate and unchanged |
| Tacho | MEDIUM-HIGH | Authoritative sources now exist, but applicability and amendment mapping remain human-scoped |
| Legislation / Safety | HIGH | Legal currency, licensed VDI material and multi-country coverage; two legal gaps remain open |
| Routing / Toll | HIGH | Dynamic and fragmented data; routing/toll gap remains open |
| Car Mover | MEDIUM | Benefits from shared sources while remaining AGM Premium component |
| Documents / OCR / Evidence | MEDIUM | Requires strict canonical-versus-derived lineage and retention governance |
| Existing runtime consumers | NONE now; MEDIUM-HIGH if later integrated | No direct consumption demonstrated; any activation needs separate contract and safety gate |
| Production/TURN | NONE | Out of scope and unchanged |

## Benefits

- Preserves the validated 815-source authority model and Phase 3 traceability.
- Prevents divergent cross-domain copies.
- Supports specialized discovery and policy without changing source truth.
- Makes stale, unknown and conflict states explicit.
- Allows last-known-valid snapshots for read availability and failure isolation.
- Keeps Basic and runtime decoupled.
- Enables Car Mover, Tacho and legal consumers to share official sources without sharing uncontrolled conclusions.

## Costs and complexity

- Overall documentary/index foundation: **MEDIUM**.
- Domain applicability and review: **HIGH** for Legislation/Safety and Routing/Toll; **MEDIUM-HIGH** for Tacho.
- Runtime adoption: **not estimated as approved work**; it would be a separate high-assurance integration.
- Main operational cost is human stewardship and source freshness, not storage.

## Prerequisites before any implementation GO

1. Separate Product Owner authorization for architecture implementation.
2. Resolve the 815 vs 798 projection lag through an approved membership proposal for all 17 Phase 3 sources.
3. Define and approve atomic view-manifest and invalidation contracts.
4. Designate accountable Tacho and Legal/Compliance reviewers.
5. Preserve `ROUTING-TOLL-001`, `LEGAL-003` and `LEGAL-005` as OPEN.
6. Define applicability/UNKNOWN/STALE/CONFLICT consumer behavior.
7. Define derived-rule lineage and evidence-retention handling.
8. Capture zero-loss baseline, rollback and Basic protected hashes.
9. Keep runtime, TURN and Production outside the documentary migration.

## Decision gate

- **ARCHITECTURAL DIRECTION = GO — OPTION A+**
- **OPTION C = CONDITIONAL SECONDARY**
- **OPTION B = NO-GO / REJECTED**
- **IMPLEMENTATION = NO-GO UNTIL SEPARATE OWNER MANDATE**
- **RUNTIME / PRODUCTION / TURN CHANGE = NONE**
- **BASIC LIBRARIAN = UNCHANGED**
- **CENTRAL REGISTRY = UNCHANGED BY THIS STUDY**
- **UNRESOLVED GAPS = 3 / OPEN**

This report is a recommendation for Product Owner review, not implementation authority.
