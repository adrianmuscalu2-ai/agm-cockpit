# Target architecture options

## Decision criteria

Scores: 1 = weak/high risk, 3 = acceptable, 5 = strong/low risk. Complexity is stated separately.

| Criterion | A: central SOT + controlled views | B: domain SOTs + federation | C: hybrid identity/authority central, domain artifacts/rules |
|---|---:|---:|---:|
| Single source of truth | 5 | 1 | 3 |
| Duplicate prevention | 5 | 1 | 3 |
| Cross-domain reuse | 5 | 2 | 4 |
| Authority consistency | 5 | 2 | 4 |
| Version/provenance/hash auditability | 5 | 2 | 4 |
| Update propagation simplicity | 4 | 2 | 3 |
| Failure isolation | 3 | 4 | 4 |
| Rollback determinism | 5 | 2 | 3 |
| Current-model compatibility | 5 | 1 | 3 |
| Migration safety | 5 | 1 | 3 |
| Total | **47/50** | **18/50** | **34/50** |

## Option A — Central Registry remains sole source of truth

Specialized libraries are versioned controlled views/indexes. They contain membership and domain-use metadata, not independent source records or copies.

### Behavior

- One central write path for source identity, authority, version, provenance, integrity and retention.
- Domain owner can propose membership, applicability, consumer policy and domain-specific rule references.
- View generation validates all `sourceId` references and publishes atomically.
- Consumers may use immutable, version-pinned snapshots/caches for availability, but these are non-authoritative derivatives.
- Conflict resolution remains central governance plus the responsible human domain owner.

### Impact

- Best fit with existing Phase 1-3 invariants.
- Lowest migration risk and no forced change to Basic or runtime.
- Central discovery is a logical dependency; failure is mitigated by signed/version-pinned snapshots.
- Requires an explicit propagation contract because the current 815 vs 798 lag proves that registry apply and view publication can diverge.

Complexity: **MEDIUM**. Operational complexity: **LOW-MEDIUM**. Migration risk: **LOW**.

## Option B — Each specialized library is its domain source of truth

Central Registry becomes a federation/catalogue layer over independent Tacho, Legal, Routing/Toll, Car Mover and Documents authorities.

### Behavior

- Each domain owns identity, version, hash and authority decisions for its copy/record.
- Cross-domain sources require federation IDs, ownership arbitration and distributed conflict resolution.
- Update, rollback and supersession become multi-system transactions.

### Impact

- Better isolation for purely domain-local content, but AGM's corpus is not domain-local: at least 374 mapped sources already cross domains.
- `CS-DE-STVO` could receive different hashes, versions, effective dates or status in four libraries.
- Central audit cannot prove one current version without consensus or a master authority, which recreates Option A indirectly.
- Basic and runtime consumers would face multiple contracts and potentially inconsistent answers.

Complexity: **VERY HIGH**. Operational complexity: **VERY HIGH**. Migration risk: **HIGH**.

## Option C — Hybrid central identity/authority plus domain artifacts/rules

Central Registry owns `sourceId` and authority. Domain libraries own artifacts, rules and domain metadata.

### Behavior

- Central identity/authority is stable.
- Domain systems can optimize local processing and rule materialization.
- Artifact custody is split from canonical authority.

### Impact

- Useful only if “domain artifacts” means non-authoritative, content-addressed cache or derived rule products.
- If a domain owns an independent canonical copy, byte integrity and retention can diverge from the central record.
- Derived rules need explicit lineage to source, clause, jurisdiction, effective interval and transformation version.
- More failure isolation than A, but higher invalidation and rollback complexity.

Complexity: **HIGH**. Operational complexity: **HIGH**. Migration risk: **MEDIUM-HIGH**.

## Comparative impact matrix

| Concern | A | B | C |
|---|---|---|---|
| Ownership | Source authority central; domain relevance/applicability delegated | Full ownership per domain | Central source authority; domain derived-product ownership |
| Duplicate handling | One ID; identical-content records remain traceable until human decision | Duplicate/fork risk at every boundary | Cache/derived artifacts need strict non-authoritative labels |
| Versioning | One canonical version graph | Multiple graphs plus federation reconciliation | Canonical graph central; derived rule versions domain-local |
| Provenance/integrity | One chain and one expected hash | Multiple provenance chains | Central source chain plus derived lineage chain |
| Propagation | Deterministic regenerate/publish | Distributed sync | Registry event plus derived rebuild |
| Invalidation | Affected memberships/views marked stale | Distributed invalidation | Source invalidation cascades to dependent rules/artifacts |
| Conflict | Central `CONFLICT DETECTED` + owner review | Cross-domain arbitration | Central source conflict; domain applicability conflict separately |
| Rollback | Restore prior view manifest/registry version | Coordinated multi-domain rollback | Restore canonical and compatible derived snapshots |
| Runtime | Optional published snapshot; none required now | New federation dependency | New rule/materialization services likely |
| Basic | Can remain unchanged | Multiple potential integrations | New derivative contract pressure |

## Option verdicts

- **A: RECOMMENDED**, with mandatory atomic projection/invalidation improvements (“Option A+”).
- **C: SECONDARY**, only if domain artifacts are non-authoritative caches/derived products with complete lineage.
- **B: REJECTED** because it creates multiple authorities for heavily shared sources and makes consistency an unsolved distributed-governance problem.
