# ROUTING-TOLL-001 — deterministic atomic mutation plan

Status: `READY / NOT AUTHORIZED / NOT EXECUTED`

1. Require a separate explicit Product Owner atomic-apply authorization for this exact changeset hash.
2. Recheck preconditions: Registry `815 / af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31`; Routing/Toll view `263 / eb8e0b1b02b34033ad689b0aa35da616b924cc333d2d22187e466505ffcc801f`.
3. Recheck all 16 artifacts against byte size and SHA-256 and ensure every new sourceId/membershipId is absent.
4. Create recoverable same-directory preimages for both controlled JSON files.
5. Build staged Registry and view using the exact ordered additions in `FINAL_ATOMIC_CHANGESET.json`.
6. Validate schemas, ADD/MODIFY/DELETE `16/0/0`, classifications `12/4`, hashes, uniqueness, protected gaps and Basic hashes.
7. Atomically replace both files. Any partial replace or post-apply mismatch triggers immediate rollback of both files.
8. Run `POST_APPLY_VALIDATION_PLAN.md`. Keep `ROUTING-TOLL-001` OPEN.

No step in this plan has been executed.
