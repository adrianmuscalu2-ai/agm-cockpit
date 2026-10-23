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
| Multilingual wave 1 | PASS | French Basic/contact catalog completed; 27 previously missing keys covered |

## Stabilization evidence (2026-10-23)

- French keys were added in `apps/web/src/i18n/wave1-basic-i18n.dictionary.ts` with native translations and preserved placeholders.
- `test:multilingual-wave1`: PASS.
- `test:final-language-wave`: PASS; it/es/sv each validated with 1,182 app keys, 308 operational leaves, 37 Car Mover keys, 199 direct Premium keys, 0 missing keys and 0 wrong fallbacks.
- Relevant deterministic checks: device-assistant handoff, Android action layer, personal contacts, global camera/OCR, voice confirmation, Premium assistant UI, Premium voice foundation, Android entitlement cache and speech semantics: PASS.
- Web TypeScript and production build: PASS. The stable public API endpoint was supplied only temporarily for the build and no credentials were added to the candidate.
- Isolated local web probe: PASS, Vite on `127.0.0.1:5177` returned HTTP 200; no real authentication was used.
- APK debug: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`; version `1.6.0`, versionCode `28`, package `com.agm.cockpit`, size `47,072,876` bytes, SHA-256 `78358208C9D88131F3BDD87BA59DE3036E37DFDEFD7807E43448B5EF53BF7B65`.
- APK signing: Android Debug certificate, SHA-256 `287319d9c7540a9b48b63c1f5df99cafb0284a3e80fb603af8feef4f2aab7743`; v2 signature verified. APK was not installed on the Samsung Galaxy S25.
- Browser visual validation: NOT RUN in this phase; deterministic web contracts/build are not physical browser evidence.
- Physical Samsung Galaxy S25 validation: NOT RUN and remains an explicit separate gate.

The Android build initially failed because Capacitor generated files and SDK location were absent. `cap sync` regenerated the candidate-only files; the SDK was supplied through process-local `ANDROID_HOME`. No permanent environment variable was changed.

## Canonicalization decision

The candidate is a reproducible baseline, not yet a final production merge. The selected baseline has the broadest structural feature surface among the inspected worktrees, but feature presence is not treated as runtime proof. Feature-level decisions are in `CONSOLIDATION-MATRIX.md`.

## Required next gate

Run the mandatory browser validation runbook and physical Samsung Galaxy S25 validation. Only after those gates should this candidate be considered for promotion to the active AGM project.
