# ROUTING-TOLL-001 — post-apply validation plan

- Registry count `831`, source ADD/MODIFY/DELETE `16/0/0`.
- All original 815 source objects unchanged; all 16 approved sourceIds present once.
- Addition classifications `12 AUTHORITATIVE_WITH_SCOPE + 4 CONTEXTUAL`.
- Canonical artifacts `16/16`: path, MIME, bytes and SHA-256 MATCH; canonical duplicates `0`.
- Registry expected SHA-256 `f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d`.
- Routing/Toll view count `279`; original 263 memberships preserved; 16 deterministic memberships present once.
- Routing/Toll view expected SHA-256 `001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997`.
- Apply idempotence and Registry/view regeneration idempotence PASS.
- Basic Librarian hashes 3/3 MATCH.
- `ROUTING-TOLL-001 = OPEN / PARTIALLY_READY`; `LEGAL-003` and `LEGAL-005` OPEN and unchanged.
- Runtime, Production, TURN, application and API unchanged; commit/push not executed.
