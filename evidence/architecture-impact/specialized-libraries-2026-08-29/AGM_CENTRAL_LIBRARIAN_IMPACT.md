# AGM Central Librarian impact

## Recommended role

AGM Central Librarian should be the **documentary governance orchestrator and query/index coordinator** for Central Registry and its controlled domain views.

It should not become:

- a second source of truth;
- a legal, Tacho or routing authority;
- a runtime decision engine;
- a domain owner;
- a replacement for Basic Librarian;
- an autonomous conflict resolver.

## Responsibility allocation

| Capability | AGM Central Librarian | Domain steward/library | Product Owner / human reviewer |
|---|---|---|---|
| Register/index source proposal | Prepare and validate | Propose relevance/use | Approve authority change where required |
| Integrity/provenance checks | Verify and report | Supply domain evidence | Decide blocked/conflicting cases |
| Domain membership | Validate consistency and generate candidate view | Own rationale, applicability and consumer policy | Approve sensitive/promotional changes |
| Version/supersession graph | Maintain documentary linkage | Report domain impact | Approve legal/operational applicability |
| Query/discovery | Serve documentary index or generate snapshot | Define domain filters | N/A |
| Conflict handling | Mark and route `CONFLICT DETECTED` | Analyze impact | Resolve explicitly |
| Runtime decision | NONE | NONE under current mandate | Separate runtime mandate |
| Publication/Production | NONE | NONE | Separate release authority |

## Orchestrator versus federation

- **Registry orchestrator:** YES, for controlled validation and atomic projection packages.
- **Governance layer:** YES, for policy enforcement, traceability, open-gap preservation and audit trails.
- **Query/index layer:** YES, documentary/read-only and version-pinned.
- **Federation layer:** NO under Option A; federation implies multiple authorities that do not exist and are not recommended.
- **Artifact custodian:** coordinates hashes and references, but evidence custody stays with the designated Inspector/domain owner.

## Required future safeguards

If implementation is later authorized, the Central Librarian workflow should enforce:

1. source ID uniqueness and canonical hash/path resolution;
2. all memberships resolve against the exact registry version;
3. domain views publish atomically with a manifest;
4. open gaps remain open unless a human decision explicitly closes them;
5. domain roles never alter central classification;
6. derived rule lineage is complete;
7. stale/conflict/unknown states are visible;
8. every proposal has before/after diff and rollback reference;
9. Basic protected hashes remain unchanged;
10. no runtime/TURN/Production authority is implied.

## Impact assessment

The documentary role change from “Car Mover-first archive librarian” to “central multi-domain governance/query coordinator” is **MEDIUM**. Its current contract already permits most cataloguing and integrity functions. The new work is primarily deterministic view propagation, domain-owner handoff and manifest/invalidation governance, not a new autonomous agent.

Runtime impact remains **NONE** until separately authorized.
