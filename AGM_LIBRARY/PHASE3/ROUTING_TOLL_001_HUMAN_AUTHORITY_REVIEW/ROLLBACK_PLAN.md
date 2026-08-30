# Rollback plan

Rollback trigger: any precondition, atomic-write or post-apply validation mismatch.

1. Stop without touching any other Registry, view, runtime or application file.
2. Restore the same-directory Registry and Routing/Toll view preimages.
3. Verify Registry `815` and SHA-256 `af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31`.
4. Verify Routing/Toll view `263` and SHA-256 `eb8e0b1b02b34033ad689b0aa35da616b924cc333d2d22187e466505ffcc801f`.
5. Verify Basic Librarian hashes 3/3 and all three protected gaps OPEN.
6. Record the failing check, staged hashes, rollback hashes and filesystem error details.

The rollback operation is not authorized or executed by this review mandate.
