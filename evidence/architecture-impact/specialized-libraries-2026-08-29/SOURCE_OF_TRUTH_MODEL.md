# Source of truth model

## Proposed rule

> **ONE SOURCE ID -> ONE CANONICAL AUTHORITY RECORD -> ONE VERIFIED CANONICAL ARTIFACT -> MULTIPLE CONTROLLED DOMAIN VIEWS -> ZERO DOMAIN-OWNED CANONICAL COPIES**

The “authority record” is held by AGM Central Registry. Human authority remains external to the software: Product Owner and the designated domain reviewer approve scope/applicability; neither AI nor a Librarian can manufacture authority.

## Ownership split

| Data/control | Owner | Domain library may do | Domain library must not do |
|---|---|---|---|
| `sourceId` | Central Registry governance | Reference it | Reissue or alias it as a new authority |
| Canonical path/URI/hash/size | Central Registry + evidence custodian | Verify/cache by hash | Replace the canonical artifact |
| Source status/version/supersession | Central Registry after human decision | Display pinned value | Override or auto-promote |
| Authority/jurisdiction/effective date | Central Registry after human review | Apply a narrower domain-use gate | Broaden scope or infer missing dates |
| Domain membership/relevance | Domain steward, published centrally | Propose role/rationale/consumer policy | Change canonical metadata |
| Applicability to an operation | Domain policy + human/runtime rules under separate mandate | Return applicable/not applicable/unknown with evidence | Convert UNKNOWN to PASS/SAFE/ZERO |
| Derived rule/index/cache | Domain steward | Version with full lineage | Present it as the primary source |
| Retention/evidence custody | Central governance + Inspector | Add stricter local handling | Delete historical evidence |

## Required record layers

1. **Canonical source record:** current 815-source Central Registry contract.
2. **Domain membership:** `membershipId`, `sourceId`, domain, role, rationale, owner and consumer policy.
3. **Applicability metadata:** jurisdiction, vehicle/operation class, effective interval, required facts, uncertainty policy and human-review gate. This is domain metadata and cannot rewrite the source.
4. **Derived product lineage:** derived ID/version, source IDs and hashes, clause/page anchors where possible, transformation/tool version, reviewer and timestamp.
5. **Published view manifest:** registry hash/version, membership collection hash/version, generated view hash, generation time and affected-domain list.

Layers 3-5 are architectural requirements for a future mandate, not changes made by this study.

## Update and invalidation contract

```text
Human-approved canonical change
        -> atomic Central Registry version
        -> compute affected memberships/domains
        -> mark dependent views/derived rules STALE
        -> regenerate candidate views
        -> validate sourceId existence, hashes, authority scope and open gaps
        -> atomic publish of view manifest
        -> consumers move only to an approved/pinned manifest
```

- Cache key: `sourceId + canonical sha256 + registryVersion`.
- View key: `viewId + viewVersion + registrySha256 + membershipCollectionSha256`.
- Any canonical hash/version/status/applicability change invalidates dependent derived rules.
- A failure leaves the last valid view readable and the new candidate unpublished.
- A required missing/unknown source yields `UNAVAILABLE/UNKNOWN`, never zero, safe or pass.

## Conflict resolution

- Byte mismatch: integrity incident; do not publish affected view.
- Two candidate authorities: `CONFLICT DETECTED -> OWNER/INSPECTOR REVIEW`.
- Different domain interpretations: keep both scoped interpretations as proposed applicability metadata; do not fork the canonical source.
- Source supersession: retain both records and explicit links; consumers select by jurisdiction/effective date, not latest filename.
- Open gaps stay separate objects and cannot be closed because a shared source appears in another view.

## Failure isolation and rollback

- Registry write path is serialized and atomic.
- Read availability comes from immutable version-pinned manifests, so a generator/registry service outage does not erase the last validated view.
- Rollback normally re-points a view to its prior manifest. It does not silently reverse human authority decisions.
- A registry rollback requires its own controlled decision and preserves all intervening evidence.

## Baseline issue to address in a future implementation mandate

Central Registry is at 815 while domain mappings/views cover 798. Option A remains correct, but the publication unit must become `registry change + affected membership proposal + validated view manifest` with a gate that explicitly permits or blocks “unassigned canonical sources.” The 17 existing unassigned sources must be reviewed for domain membership; this study does not assign them.
