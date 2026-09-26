# Accountability / recovery laboratory archive manifest

- Family: Accountability / recovery patch laboratory
- Source worktree: `C:\Users\adria\Documents\AGM`
- Source HEAD: `3b5463e466ca75997625242d0c3c3a516a63525b`
- Original branch/ref: `agm-canonical-20260820` dirty worktree; root patch/staging laboratory.
- Archive branch: `archive/accountability-recovery-lab-20260926`
- Payload layout: byte-exact laboratory files encoded as Base64 under `payload-base64/`, plus `SOURCE_SHA256SUMS.txt`; decode each `.b64` file to reconstruct the original bytes. Relevant evidence remains hash-only in `EVIDENCE_SHA256SUMS.txt`.
- Included source: accountability/recovery/domain/inspector/Web/Browser/Production-gate patch iterations; coherent `_codex_stage_agent_recovery` snapshot; standalone engine/spec/render files; edit helpers; rescue journal.
- Evidence: accountability and final-agent-runtime report/screenshot trees are inventoried by SHA-256 but not copied raw.
- Tests/validators: standalone engine specs, Web fixture patches, Browser validator patches and Production runtime-gate patches.
- Relationship to canonical: canonical has evolved operational-duty, mandate, audit, recovery and Browser certification behavior, but no proof makes every patch or the standalone staged engine/spec a duplicate.
- Unique work: fail-closed classification, mandate/output/evidence/freshness/independent-validation chain, false-ACTIVE detection, control-coverage-loss and many negative-case iterations.
- Duplicated work: later patches supersede some earlier iterations; current canonical implements overlapping final behavior.
- Do not promote directly: this is a laboratory, not a linear patch queue. Patches must be mapped and selectively reviewed; order is not implied by filenames.
- Explicit exclusion: legacy Premium Linguist ComponentHeartbeat/publisher patches are not part of this archive and remain obsolete by explicit decision.
- Secrets/redactions: no raw Production/browser evidence, cookies, credentials or runtime environment files are included.
- Functional verdict: `LAB-ONLY`; `KEEP` until every patch has a named incorporation/supersession/rejection/unique disposition.

This archive must never be merged wholesale.
