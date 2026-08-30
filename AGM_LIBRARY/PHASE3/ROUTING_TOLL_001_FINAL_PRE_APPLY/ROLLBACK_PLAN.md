# ROUTING-TOLL-001 — rollback plan

Trigger rollback on any precondition, write, schema, count, identity, classification, artifact, hash, Basic or protected-gap mismatch.

1. Stop all changes; do not touch runtime, Production, TURN, application or API files.
2. Restore both preimages as one controlled recovery operation.
3. Verify Registry `815 / af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31`.
4. Verify Routing/Toll view `263 / eb8e0b1b02b34033ad689b0aa35da616b924cc333d2d22187e466505ffcc801f`.
5. Verify all 815 original sources and all 263 memberships are byte-for-byte restored.
6. Verify Basic Librarian 3/3 and all three protected gaps OPEN.
7. Record the failed condition, staged hashes, restoration hashes and filesystem journal.

Rollback has not been executed and is not authorized by this mandate.
