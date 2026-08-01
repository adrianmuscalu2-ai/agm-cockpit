# AGM — SR-03 App-Shell Contracts

Date: 2026-07-29  
Roadmap: MC-3B  
Authorized intervention: SR-03 only  
Production deployment performed: no  
Competition material: FROZEN AND PROTECTED

## 1. Objective and result

SR-03 established the contracts required before any future reduction of
`main.ts`:

- a composed `AppState`;
- an explicit ownership map for all 65 current flat state fields;
- a `ViewModule` lifecycle compatible with the current `render` then `bind`
  sequence;
- an explicit, data-only registry for all current views and all three Web
  entrypoints;
- a flat `LegacyAppStateFacade` compatibility type for a later, separately
  authorized transition.

No current consumer was switched. `main.ts` remains the sole active renderer and
does not import or execute the new contracts or registry.

## 2. State contract

The 65 current state fields are mapped exactly once across 11 named slices:

| Slice | Field count |
|---|---:|
| `shell` | 3 |
| `profile` | 3 |
| `contacts` | 6 |
| `mail` | 17 |
| `translator` | 6 |
| `ocr` | 5 |
| `corrector` | 4 |
| `voice` | 3 |
| `admin` | 6 |
| `incidents` | 2 |
| `guidance` | 10 |
| **Total** | **65** |

The characterization test compares this ownership registry directly with the
current `const state` inventory in `main.ts`. It rejects missing, duplicated or
additional fields.

## 3. View lifecycle and registry

`ViewModule` defines:

- `render(context): string`;
- `bind(context): void`;
- optional `dispose(context): void`.

The registry contains all 13 current `ViewName` values. Every entry is marked
`legacy-main`, making it explicit that SR-03 defines metadata only and does not
activate a replacement implementation.

The entrypoint registry contains:

- `index.html`;
- `before-departure.html`;
- `after-departure.html`.

The registry has no imports of implementations and therefore performs no
side-effect loading.

## 4. Files affected

- `apps/web/src/app-shell/app-state.contract.ts` — composed state contract,
  flat compatibility facade and field-ownership map.
- `apps/web/src/app-shell/view-module.contract.ts` — lifecycle and registration
  contracts.
- `apps/web/src/app-shell/view-module.registry.ts` — declarative view and
  entrypoint registries.
- `apps/web/scripts/test-sr03-app-shell-contracts.ts` — SR-03 characterization
  and non-activation guard.
- `apps/web/package.json` — adds the SR-03 characterization to `test:mc3a`.
- `AGM_SR03_APP_SHELL_CONTRACTS_REPORT_2026-07-29.md` — this report.

No file was deleted.

## 5. Characterization sequence

The SR-03 test was added before the implementation:

1. initial execution failed with `ERR_MODULE_NOT_FOUND`, as expected because the
   authorized contracts did not yet exist;
2. the three contract/registry files were added;
3. the same test passed;
4. TypeScript `tsc --noEmit` passed.

The test guards:

- exactly 65 current state fields;
- exactly one owner for every field;
- the 11 named slices;
- type-only imports in the state contract;
- `render`, `bind` and optional `dispose` lifecycle;
- all 13 views exactly once;
- all three entrypoints;
- no implementation imports in the registry;
- no SR-03 contract or registry import in `main.ts`.

## 6. Validation results

| Validation | Result |
|---|---|
| SR-03 targeted characterization | PASS |
| TypeScript `tsc --noEmit` | PASS |
| MC-3A main characterization | PASS |
| MC-3A Android static baseline | PASS |
| MC-3A module boundaries | PASS |
| SR-01 build-definition regression | PASS |
| Web import graph | PASS; 138 files, zero cycles |
| API import graph | PASS; 70 files, zero cycles |
| Premium foundation | PASS |
| Web production build | PASS; 158 modules |
| Production API endpoint validation | PASS |
| E6.3 Browser shell/navigation | PASS |
| E6.4–E6.6 regression | PASS |
| Local `/` | PASS; HTTP 200 |
| Local `/before-departure.html` | PASS; HTTP 200 |
| Local `/after-departure.html` | PASS; HTTP 200 |
| API tests | PASS; 8 suites, 31 tests |
| API build | PASS |
| Android `testDebugUnitTest` | BUILD SUCCESSFUL; 53 tasks up-to-date |
| Deleted files | PASS; none |
| Competition-material hashes | PASS; unchanged |

## 7. Regression and behavior assessment

- `main.ts` remained byte-identical to the SR-03 baseline:
  `B925A8055207631FA2F52A8ED78CF077ECE502A1A977E24F828C056B713B0146`.
- `premium-routes.ts` remained byte-identical:
  `7FDD8E9A76D01F36FD272F4A72F9338885276294F0636E05E5B9AD5B497CC552`.
- No renderer, binder, event handler, route, state initialization, storage key,
  API contract, native source or production configuration changed.
- The generated Web bundle remains at the same 158 modules and the same main
  chunk size.
- No runtime JavaScript from the new contracts is reachable from the
  application entrypoint.

## 8. Competition-material protection

| Protected item | SHA-256 |
|---|---|
| `AGM_OpenAI_Build_Demo_EN.mp4` | `E8D7156B5DBF1CB50F15478C0A4DB2AFEE73C36F2D2781E387CA2E547664F7B7` |
| `AGM_OpenAI_Build_Promo_Final_EN.mp4` | `E32437617EB1827A5EAAFFA60B5351C106F392297F1C19D7014012C068C8688E` |
| `OPENAI_BUILD_DEVPOST.md` | `F511C16A8805A25D2AA523F737C07DDD947D101403F54162FD9B07D1EA98DD90` |
| `OPENAI_BUILD_VIDEO_SCRIPT.md` | `57853B43F656D2BE0D380AFB5B1D0D4DF75448FFB441AEED1E104CC953EE72DA` |
| Protection register | `F19A40918D3146687F4B7DD6B722626D568224D244525EF960D8056FBEBD5E1D` |

All values match the protected baseline.

## 9. Warnings and observations

- The Web build retains the pre-existing 521.32 kB main-chunk advisory.
- Android retains the pre-existing Gradle `flatDir` advisory.
- The Android test required the local Android Studio JBR for the validation
  process and Gradle network access for its wrapper distribution. No repository
  or system configuration was changed.
- PowerShell validations use `pnpm.cmd` because local policy blocks
  `pnpm.ps1`; the policy was not changed.
- Pre-existing modified and untracked work outside SR-03 was preserved without
  reset, cleanup or inclusion.

## 10. Rollback

Rollback is fully structural:

1. remove the SR-03 test from the `test:mc3a` command;
2. remove the SR-03 characterization file;
3. remove the three unused `app-shell` contract/registry files;
4. rerun MC-3A, Web build and Browser regression.

Because no consumer was switched, no implementation binding, data, storage,
native or production rollback is required.

## 11. Verdict and recommendation

**SR-03 PASS — APP-SHELL CONTRACTS ESTABLISHED WITHOUT LOGIC MOVEMENT**

All acceptance criteria are satisfied:

- all 65 fields map exactly once to a named sub-state;
- the lifecycle matches the current render/bind flow;
- registry loading has no implementation side effects;
- all views and entrypoints are inventoried;
- `main.ts` remains the only active implementation;
- no consumer was switched;
- Browser, API and Android validations passed;
- competition materials remain unchanged.

Recommendation: close SR-03 independently. Do not begin SR-04 or move any
function from `main.ts` without a separate mandate that names one small,
characterized extraction.
