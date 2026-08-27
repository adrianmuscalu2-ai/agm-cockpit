# Working tree classification — 2026-08-27

## Audit boundary

- branch: `agm-canonical-20260820`
- starting HEAD: `6bdb27835ffcad4168b7ce44fa3bd5d12652397d`
- mandate-entry state: 110 tracked modified files and 4,891 untracked files
- tracked deletions or renames at classification: none

## Disposition

| Class | Scope | Release disposition |
|---|---|---|
| Release source and configuration | `.codex`, root AGM contracts, `apps`, `config`, `deploy`, `packages`, `prisma`, `scripts`, workflow and release documents | Included in the reviewed candidate snapshot. |
| Current release evidence | `evidence/production-release/**` plus the recovered `NUL` file and custody report | Included in the candidate snapshot. |
| Generated/cache/runtime output | `tmp`, `artifacts`, `baselines`, and `android-current.png` | Preserved in place and excluded by explicit repository-root ignore rules. |
| Historical untracked evidence | All other untracked files below `evidence` | Moved without deletion to ignored `local-preserved/production-release-20260827/evidence`, retaining relative paths. Verification: 1,577 files and 549,990,574 bytes before and after. |
| Superseded local Android packages | unversioned package, 1.2.6 and 1.2.9 under `apps/web/public/downloads` | Preserved in place and ignored by exact path. The tracked 1.3.0 package remains in the candidate. |

## Safety and reproducibility

- No source, evidence, cache, APK, or user work was deleted.
- The preservation move used literal source/destination paths inside the workspace and required exact file-count and byte-count equality.
- Ignore rules are narrow and rooted; they do not hide current release source or current release evidence.
- The Git index is the authoritative candidate boundary. Its tree hash and commit hash are recorded after remote integration in the final Production closure evidence.
- The remote branch is integrated before deployment so the candidate cannot omit files introduced by the 21 commits that preceded this release mandate.

## Release decision

The prior mixed working tree is now fully classified. `git status` must be empty after the release commit and remote integration; ignored local preservation data is intentionally outside the Production snapshot.
