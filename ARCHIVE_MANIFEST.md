# TURN Owner-session expiry archive manifest

- Family: TURN Owner-session expiry / live validator
- Source worktree: `C:\Users\adria\Documents\AGM`
- Source HEAD: `3b5463e466ca75997625242d0c3c3a516a63525b`
- Original branch/ref: `agm-canonical-20260820` dirty worktree; test/validator were untracked.
- Archive branch: `archive/turn-owner-session-expiry-20260926`
- Payload layout: byte-exact source files encoded as Base64 under `payload-base64/`; dirty application files are stored under `payload-base64/context-only/` and are not merge-ready. Decode each `.b64` file to reconstruct the original bytes; source SHA-256 inventories are part of the archive.
- Tracked context snapshots included: dirty `admin-auth.ts`, `main.ts`, and `premium-governance.runtime.ts`, solely to reconstruct the implementation against which the validator passed.
- Untracked files included: static contract test and live Browser validator.
- Evidence: raw report/runtime audit/screenshot are not copied. Their path, size and SHA-256 inventory is included.
- Tests/validators: `test-turn-owner-session-expiry.ts`; `validate-turn-owner-session-live-browser.mjs`.
- Relationship to canonical: canonical has a newer refresh-cookie, cross-context locking and terminal auth-error architecture. It does not expose the exact absolute-expiry alert contract preserved here.
- Unique work: absolute expiry, legacy persistent-token purge, explicit Owner-session-expired UI and live 401/403 return to Owner Access.
- Duplicated/evolved work: sessionStorage and fail-closed authentication exist in newer canonical forms.
- Do not promote directly: the context snapshots are a mixed historical dirty state. Never replace current canonical auth or `main.ts` with them; selectively port only reviewed requirements/tests.
- Secrets/redactions: raw Browser/runtime evidence is hash-only. The validator contains synthetic invalid test tokens, not credentials. No cookie, Owner credential or live Authorization value is archived.
- Functional verdict: `PARTIAL`; `KEEP` for selective future port.

The 2026-09-26 static contract rerun passed using Node's built-in TypeScript stripping. This archive is not a release candidate.
