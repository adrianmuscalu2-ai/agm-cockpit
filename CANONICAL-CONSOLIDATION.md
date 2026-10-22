# AGM/AGMa canonical candidate

Date: 2026-10-22

This directory is an independent candidate created from:

- source worktree: `C:\Users\adria\Documents\AGM\.codex-stage\phase3-rc-preparation`
- branch: `phase3-rc-preparation`
- source HEAD: `ce51183bd755db1015edcd6fa9bfdcf11a8f2398`
- candidate baseline: shallow clone, no source worktree modified

No `.env.production`, credentials, keys, certificates, databases, Docker volumes or Intenso data were imported. The tracked production environment file was intentionally omitted from the candidate. Configuration must be supplied outside Git at deployment time.

## Verification evidence

| Check | Result | Evidence |
|---|---|---|
| Dependency installation | PASS | `pnpm install --frozen-lockfile` |
| Prisma client generation | PASS | `pnpm db:generate` |
| API build | PASS | `pnpm build` |
| API tests | PASS | 86 suites, 605 tests |
| Web TypeScript | PASS | `pnpm --filter @agm/web exec tsc --noEmit` |
| Web build | PASS | production API, PWA and UI contracts; speech 12/12 |
| Android sync | PASS | Capacitor sync completed |
| Android debug build | PASS | `assembleDebug`, 127 tasks |
| Physical Samsung Galaxy S25 | NOT RUN | no physical-device evidence in this phase |
| Multilingual wave 1 | FAIL | 27 French Basic/contact keys missing |

The Android build initially failed because Capacitor generated files and SDK location were absent. `cap sync` regenerated the candidate-only files; the SDK was supplied through process-local `ANDROID_HOME`. No permanent environment variable was changed.

## Canonicalization decision

The candidate is a reproducible baseline, not yet a final production merge. The selected baseline has the broadest structural feature surface among the inspected worktrees, but feature presence is not treated as runtime proof. Feature-level decisions are in `CONSOLIDATION-MATRIX.md`.

## Required next gate

Resolve the French i18n gap, then run browser validation and physical Samsung Galaxy S25 validation. Only after those gates should this candidate be considered for promotion to the active AGM project.
