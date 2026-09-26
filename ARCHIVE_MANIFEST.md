# Dirty machine-auth / OCR / accountability archive manifest

- Family: Machine-auth / OCR / accountability dirty copies
- Source worktree: `C:\Users\adria\Documents\AGM`
- Source HEAD: `3b5463e466ca75997625242d0c3c3a516a63525b`
- Original branch/ref: `agm-canonical-20260820` dirty worktree.
- Archive branch: `archive/dirty-machine-auth-ocr-accountability-20260926`
- Payload layout: byte-exact dirty/untracked source, tests, migration and validators encoded as Base64 under `payload-base64/`; decode each `.b64` file to reconstruct the original bytes. Source SHA-256 inventories are included; evidence is hash-only.
- Machine-auth inventory: current dirty module/service/controllers/contracts/guards/strategy, tests, DB validator and migration.
- OCR inventory: current dirty global-camera OCR service/native capture, deterministic tests and Browser validator.
- Accountability inventory: current dirty Web accountability source/CSS/test and Browser validator. Patch-laboratory files are intentionally excluded and archived separately.
- Evidence: M2M, global-camera-OCR and accountability evidence trees are represented by path/size/SHA-256 only.
- Relationship to canonical: canonical contains the promoted machine-auth and OCR implementations and a current accountability surface. Some payload blobs are byte-identical; others are older or divergent. Canonical also contains hardened GitHub Actions OIDC provisioning absent from the dirty materialized machine-auth folder.
- Unique work: dedicated Browser validators and differing test/contract revisions not proven equivalent.
- Duplicated work: exact duplicated decorator/DTO/JWT guard/strategy/migration/DB validator and accountability CSS are retained only to reconstruct the dirty snapshot.
- Do not promote directly: never overwrite canonical from this archive. Each differing blob needs classification as older, unique test-contract or selectively portable delta.
- Secrets/redactions: no `.env`, keystore, credential store, raw M2M/Browser evidence, token or device capture is included. Evidence is hash-only.
- Functional verdict: `PARTIAL`; `KEEP` pending a signed IDENTICAL / OLDER / UNIQUE TEST-CONTRACT mapping.

This archive is a forensic source snapshot, not an application candidate.
