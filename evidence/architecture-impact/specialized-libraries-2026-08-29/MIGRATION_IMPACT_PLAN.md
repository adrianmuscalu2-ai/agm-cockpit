# Migration impact plan

This is a proposed no-loss path for a future, separately authorized Option A+ implementation. No phase below was executed by this study.

## Zero-loss requirements

- Preserve all 815 central records and the current registry hash as the migration baseline.
- Preserve original artifacts, historical evidence, duplicate records and superseded versions.
- Add, modify or delete no canonical record as a side effect of generating domain views.
- Keep the three open gaps open.
- Keep Basic files and behavior unchanged.
- Every generated view must be reproducible from a pinned registry plus membership collection.
- UNKNOWN, STALE and CONFLICT states must be explicit and non-operational by default.
- Runtime consumers remain on existing behavior until a separate consumer-by-consumer activation.

## Proposed phases and gates

### M0 — Freeze and inventory

- Capture registry/mapping/view/schema/governance hashes.
- Confirm 815 central records and identify the 17 unassigned Phase 3 source IDs.
- Catalogue current consumers and prove no runtime dependency.

Gate: byte-for-byte baseline, source count and open-gap list match Phase 3.

### M1 — Projection contract design

- Define view manifest, applicability metadata, derived lineage and stale/conflict states.
- Define domain owner approval matrix.
- Define whether unassigned sources are allowed and how they block publication.

Gate: schema proposal reviewed; no existing schema changed yet; Basic and runtime impact accepted.

### M2 — Membership reconciliation proposal

- Produce proposed memberships for the 17 Phase 3 sources.
- Review cross-domain sources, especially legal sources used by routing/Car Mover.
- Do not close `ROUTING-TOLL-001`, `LEGAL-003` or `LEGAL-005` implicitly.

Gate: human decisions for every new membership and all conflict/open-gap effects.

### M3 — Shadow view generation

- Generate candidate views outside authoritative/current paths.
- Bind each to registry and membership hashes.
- Compare old/new membership counts and source sets.

Gate: referential integrity, deterministic regeneration, zero canonical mutation, authority-scope preservation and duplicate report.

### M4 — Atomic documentary publish

- Publish mappings and all affected view manifests as one atomic changeset.
- Leave canonical artifacts and Central Registry unchanged unless a separately approved registry changeset exists.

Gate: after publish, every assigned source is discoverable; all old memberships remain unless explicitly approved; idempotence and rollback tested.

### M5 — Optional consumer pilots

- First use is offline/read-only inspection.
- Any runtime consumer uses a version-pinned published snapshot behind a feature flag.
- Tacho and Legal consumption requires domain authority and applicability gates.

Gate: separate runtime mandate, contract tests, stale/unknown behavior, latency/availability evidence and owner approval.

### M6 — Runtime adoption, if ever authorized

- Migrate one consumer/domain at a time.
- Maintain backward-compatible fallback to the previous consumer data path.
- No Basic integration unless separately approved.

Gate: production/release authority and domain-specific safety validation.

## Backward compatibility

- Existing paths and Phase 1 view formats remain readable during M0-M4.
- New manifest/applicability fields should be additive or versioned, not silently repurposed.
- No consumer is switched automatically when a view is published.
- Old view manifests remain immutable and available for audit/rollback.

## Rollback

1. Stop publication of the candidate set on any validation mismatch.
2. Re-point documentary discovery to the previous complete view-manifest set.
3. Demonstrate previous registry and view hashes/counts.
4. Preserve the failed candidate and validation evidence.
5. Do not roll back human authority decisions implicitly; reconcile them in a new changeset.

## No-downtime / no-runtime-change path

M0-M4 can be performed entirely alongside the current documentary structures and then atomically switch only the documentary view manifest. Because no runtime consumer of Central Registry/views was demonstrated, this path can have **no runtime downtime and no runtime behavior change**. Any later runtime use is a separate migration.

## Relative complexity

| Workstream | Complexity | Main driver |
|---|---|---|
| Baseline/inventory | LOW | Existing hashes and deterministic scripts |
| Projection/invalidation contract | MEDIUM | Need atomicity and explicit stale/open-gap states |
| 17-source membership reconciliation | MEDIUM | Human cross-domain review |
| Tacho applicability | MEDIUM-HIGH | Vehicle/operation/effective-date scope |
| Legislation/Safety applicability | HIGH | Jurisdiction, currency and three open gaps |
| Routing/Toll freshness | HIGH | Dynamic national/concession data and unresolved gap |
| Car Mover projection | MEDIUM | Multiple legal/routing/document dependencies |
| Documents/OCR/Evidence lineage | MEDIUM | Retention, derived output and evidence custody |
| Basic | LOW/NONE | Recommended unchanged |
