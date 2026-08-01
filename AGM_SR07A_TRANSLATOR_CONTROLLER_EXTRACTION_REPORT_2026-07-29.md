# AGM — SR-07A Translator Controller Extraction

Date: 2026-07-29  
Scope: Translator only  
Verdict: **PASS**

## Objective

Extract the Translator domain state transitions from `apps/web/src/main.ts`
behind one injected controller without changing markup, UI behavior, storage,
voice, OCR, Mail, Contacts, Incident or Diagnostics.

SR-06 remains **ON HOLD — Pending Final Device Validation**.

## Implementation

`createTranslatorController()` now owns the existing Translator transitions:

- translate and unavailable-result handling;
- correction;
- copy with the existing clipboard fallback;
- clear, including the existing transient OCR fields;
- handoff of translated text to the existing Mail view.

The shell retains rendering, DOM binding, legal-acceptance checks, voice,
OCR/camera adapters and navigation. Existing services are injected into the
controller, so there is one active implementation and no dual-write path.

## Files affected

- `apps/web/src/translator/translator.controller.ts` — new controller and
  explicit state/dependency contract;
- `apps/web/src/main.ts` — controller composition and thin legacy-compatible
  delegates;
- `apps/web/scripts/test-sr07a-translator-controller.ts` — characterization and
  single-binding assertions;
- `apps/web/package.json` — SR-07A test added to the MC-3A shield;
- `AGM_SR07A_TRANSLATOR_CONTROLLER_EXTRACTION_REPORT_2026-07-29.md` — this
  report.

No file was deleted. Android generated assets were synchronized for the build,
but no Android source, permission or Diagnostics implementation was changed by
SR-07A.

## Validation

| Gate | Result |
|---|---|
| SR-07A Translator controller characterization | PASS |
| Translation success/unavailable transitions | PASS |
| Correction/copy/clear/Mail handoff parity | PASS |
| Single controller binding; no duplicate result write in `main.ts` | PASS |
| TypeScript | PASS |
| MC-3A complete shield | PASS |
| SR-01 through SR-06 automated regression gates | PASS |
| Web import graph | PASS — 150 files, 0 cycles |
| API import graph | PASS — 70 files, 0 cycles |
| Web production build | PASS — 168 modules |
| Browser E6.3 | PASS |
| Browser E6.4–E6.6 | PASS |
| API tests | PASS — 8 suites, 31 tests |
| API build | PASS |
| Android `testDebugUnitTest` | PASS |
| Android `assembleDebug` | PASS |
| Android result | BUILD SUCCESSFUL — 102 tasks |

The synchronized debug APK was produced at:

`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`

Size: 22,275,727 bytes.

The existing Vite warning for the main chunk above 500 kB remains non-blocking.
No new warning was introduced by the extraction.

## Regression and protection assessment

- Translator markup, labels, selectors and DOM bindings are unchanged.
- Input trimming, language detection, provider status, unavailable fallback,
  OCR-history callback, correction result, clipboard fallback, clear policy and
  Mail handoff preserve the previous sequence and values.
- Voice and OCR/camera implementations remain in the legacy shell.
- Mail, Contacts, Incident and Diagnostics remain outside the intervention.
- `AgmDiagnosticsPlugin.java` retains SHA-256
  `258B4A0458D93A4737A448650A8F42388FDC3E677A62D83B113994215CCB9D7B`.
- Production and infrastructure were not touched.

Protected competition hashes remain unchanged:

| Protected item | SHA-256 |
|---|---|
| `AGM_OpenAI_Build_Demo_EN.mp4` | `E8D7156B5DBF1CB50F15478C0A4DB2AFEE73C36F2D2781E387CA2E547664F7B7` |
| `AGM_OpenAI_Build_Promo_Final_EN.mp4` | `E32437617EB1827A5EAAFFA60B5351C106F392297F1C19D7014012C068C8688E` |
| `OPENAI_BUILD_DEVPOST.md` | `F511C16A8805A25D2AA523F737C07DDD947D101403F54162FD9B07D1EA98DD90` |
| `OPENAI_BUILD_VIDEO_SCRIPT.md` | `57853B43F656D2BE0D380AFB5B1D0D4DF75448FFB441AEED1E104CC953EE72DA` |
| Protection register | `F19A40918D3146687F4B7DD6B722626D568224D244525EF960D8056FBEBD5E1D` |

## Rollback

Rollback is localized: restore the five thin Translator functions in
`main.ts` to their prior bodies and remove the controller composition. Storage,
schema, markup and native adapters require no rollback.

## Final decision

**SR-07A PASS.** The Translator controller extraction is complete within the
authorized scope, with no identified regression. SR-06 remains ON HOLD and was
not modified.

No SR-07B work is authorized by this report.
