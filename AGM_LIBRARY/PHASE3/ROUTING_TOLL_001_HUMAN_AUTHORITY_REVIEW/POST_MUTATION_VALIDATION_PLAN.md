# Post-mutation validation plan

- Registry count `831`; exactly 16 additions, 0 existing-source modifications, 0 deletions.
- All 16 approved sourceIds present exactly once.
- Classification totals within the additions: 12 `AUTHORITATIVE_WITH_SCOPE`, 4 `CONTEXTUAL`.
- Canonical artifacts 16/16 present with byte size and SHA-256 match.
- Routing/Toll view count `279`; 16 deterministic memberships; no duplicate membershipId/sourceId.
- Projected Registry hash `1aaf880710e08c4ca430094fc3edf64749aa9d074914f7efa0e7654b0c7cb0e0` and projected view hash `3c8de124d531341917e7dbf8cc11f9a22fd5a77cde2a96b6a07dcbd9bc6321ae`.
- Apply generator and Registry/view regeneration idempotence PASS.
- Central Registry remains single source of truth; no canonical copies created.
- Basic Librarian 3/3 hashes MATCH.
- `ROUTING-TOLL-001`, `LEGAL-003`, `LEGAL-005` remain OPEN.
- Runtime, Production, TURN, application and API remain unchanged.
