# Remaining worktree evidence provenance archive

- Family: provenance-only inventory for remaining Browser/runtime/device/APK/build evidence across dirty worktrees.
- Sources: main worktree; Android 1.6 coherent; Browser certification remediation; accountability release; final remediation; Tachograph/Dashboard worktree; language candidate 7; quick contacts; M2M/TURN; linguistic diagnostic; Premium assistant compatibility; voice/runtime worktree.
- Payload: no raw evidence.
- Inventory: 1,968 materialized evidence/build files, approximately 2.315 GB, recorded as absolute source path, byte size and SHA-256.
- Safety: evidence is treated as potentially sensitive because it may encode runtime URLs, device state, cookies/session context, identifiers, deployment metadata or screenshots. Only hashes and provenance are committed.
- Canonical relationship: many reports are duplicates of committed or separately archived evidence; others are local execution artefacts. Hash preservation prevents false equivalence claims without publishing sensitive content.
- Limitation: hash-only provenance proves identity/existence but does not reconstruct raw evidence. Raw worktrees remain KEEP until an explicit retention decision accepts hash-only preservation for their evidence class.
- Secret scan: raw evidence was deliberately not ingested into Git; manifest/inventory contain no secret values.
- Verdict: `PROVENANCE ARCHIVED â€” RAW RETENTION DECISION REQUIRED`.
