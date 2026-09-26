# Car Mover parity / physical archive manifest

- Family: Car Mover parity / physical validators
- Source worktree: `C:\Users\adria\Documents\AGM`
- Source HEAD: `3b5463e466ca75997625242d0c3c3a516a63525b`
- Original branch/ref: `agm-canonical-20260820` dirty worktree; earlier committed generation and evidence at `015d703c38af1ab80cfe838f24bb7d09c4bf8345`
- Archive branch: `archive/car-mover-parity-physical-20260926`
- Payload layout: exact source bytes under `payload/`; `SHA256SUMS.txt` records every payload file; `EVIDENCE_SHA256SUMS.txt` records evidence that is deliberately not copied.
- Tracked files included: none from the source index.
- Untracked files included: the current Browser parity validator and current physical Android entry validator.
- Evidence: raw Browser screenshots/reports and physical-device evidence are not duplicated. Their path, size and SHA-256 inventory is included; earlier evidence remains reconstructible from checkpoint `015d703c...`.
- Tests/validators: `validate-car-mover-browser-parity.mjs`; `validate-car-mover-entry-physical-android.mjs`.
- Relationship to canonical: Car Mover functionality is promoted; these two exact validator revisions are not in canonical.
- Unique work: protected-copy/hero/flow/overflow/reachability assertions and physical installed-version/safe-area/device-WebView checks, including the current 1.6.0 repin.
- Duplicated work: the earlier validator generation and historical evidence already exist in `015d703c...`; generic Car Mover application behavior exists in canonical.
- Do not promote directly: the validator payload must be reviewed and repinned to current auth, legal acceptance, package identity and build version before use. It is not application source.
- Secrets/redactions: no raw evidence is included. Physical device identifiers, screenshots and runtime captures are represented by hashes only.
- Functional verdict: `UNPROMOTED` validator/evidence family; `KEEP`.

This archive is an isolated provenance root, not a canonical application commit and not a release candidate.
