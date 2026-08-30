# Deterministic atomic mutation plan

Status: `PREPARED / NOT AUTHORIZED / NOT EXECUTED`

1. Require explicit Product Owner decisions for all 16 rows and a separate atomic-apply authorization.
2. Verify Registry count/hash `815 / af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31` and Routing/Toll view count/hash `263 / eb8e0b1b02b34033ad689b0aa35da616b924cc333d2d22187e466505ffcc801f`.
3. Verify all 16 sourceIds are absent and every canonical artifact matches its approved byte size and SHA-256.
4. Create same-directory preimage backups of the Registry and Routing/Toll view.
5. Build staged JSON by appending the 16 source objects in lexical sourceId order and the 16 deterministic memberships defined in the package.
6. Validate schemas, counts, uniqueness, classifications, artifacts, protected gaps and Basic hashes against staged files.
7. Atomically replace both controlled files as one governed operation; if the second replace or any validation fails, execute rollback immediately.
8. Run the post-mutation validation plan. Do not close `ROUTING-TOLL-001`.

Projected hashes are valid only for this exact package and formatting:

- Registry: `1aaf880710e08c4ca430094fc3edf64749aa9d074914f7efa0e7654b0c7cb0e0`;
- Routing/Toll view: `3c8de124d531341917e7dbf8cc11f9a22fd5a77cde2a96b6a07dcbd9bc6321ae`.
