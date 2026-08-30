# AGM Multi-Library Foundation — Phase 1

Version: `1.0.0`
Mode: `DOCUMENTARY / STRUCTURAL ONLY`
Runtime authority: `NONE`
Production authority: `NONE`
TURN authority: `NONE`

## Authority model

`AGM_LIBRARY/REGISTRY/canonical-sources.json` is the single documentary source
registry for the imported 798-source corpus. `CAR_MOVER/INDEX.json` is the
bootstrap catalog from which the canonical records were imported; it is not a
second authority after Phase 1.

Domain libraries are controlled reference indexes. They contain only
`sourceId` and `membershipId` references. They do not contain copies of source
content and cannot alter central status, version, checksum, ownership or
retention metadata.

## Structure

- `SCHEMAS/` — canonical-source, membership, mapping and view contracts;
- `REGISTRY/` — the canonical source registry;
- `MAPPINGS/` — flat memberships and source-to-domain mapping;
- `VIEWS/` — controlled domain indexes;
- `GOVERNANCE/` — ownership, policies and boundary decisions;
- `REPORTS/` — validation and Phase 2 source gaps.

## Required invariants

- `AGM CENTRAL REGISTRY = SINGLE SOURCE OF TRUTH`;
- `DOMAIN LIBRARIES = CONTROLLED VIEWS / INDEXES ONLY`;
- `PHYSICAL SOURCE COPIES BETWEEN LIBRARIES = 0`;
- every imported source keeps its original `sourceId`;
- Tacho and Legislation/Safety remain candidate discovery views;
- Basic Librarian remains a separate linguistic authority;
- Car Mover remains a functional AGM Premium component, not a separate project.

## Reproducible commands

```powershell
node scripts/build-agm-multi-library-foundation.mjs
node scripts/test-agm-multi-library-foundation.mjs
```

The build is deterministic: it uses the timestamp and source identities from
the validated bootstrap catalog, not the current clock.
