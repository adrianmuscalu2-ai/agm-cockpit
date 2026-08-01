# AGM — SR-01 Single Web Build Definition

Date: 2026-07-28  
Roadmap: MC-3B  
Authorized intervention: SR-01 only  
Production deployment performed: no  
Competition material: FROZEN AND PROTECTED

## 1. Result

The duplicated Web build definition was replaced with one shared factory:

`apps/web/web-build-definition.mjs`

Both consumers now use this source:

- `apps/web/vite.config.mjs` for development;
- `apps/web/scripts/build-web.mjs` for the controlled production build.

Development-only API proxy configuration remains owned by `vite.config.mjs`.
`configFile: false` remains owned by the scripted production build. Runtime
application logic was not changed.

## 2. Structural changes

The shared definition owns:

- `index.html`;
- `before-departure.html`;
- `after-departure.html`;
- the POC 02 navigation HTML transformation.

The duplicated and differently encoded navigation text was normalized to valid UTF-8:

`POC 02 · După Plecare / Nach der Abfahrt / After Departure`

This is the only intentional output correction. Route, link target, element attributes,
entrypoint set and application behavior remain unchanged.

Tests that formerly inspected literals inside `vite.config.mjs` were updated to
validate the canonical definition:

- `test-e6-3-browser-shell.ts`;
- `test-e6-4-to-e6-6.ts`;
- `test-poc02-stage4.ts`.

A dedicated structural test was added:

`test-sr01-web-build-definition.ts`.

It verifies entrypoints, plugin identity, transformation scope, UTF-8 content and that
both build consumers delegate to the common definition.

## 3. Validation results

| Validation | Result |
|---|---|
| SR-01 structural test | PASS |
| MC-3A shield | PASS |
| Import graph baseline | PASS; one known historical Web cycle, zero new cycles |
| Web production build | PASS; 158 modules |
| Production API endpoint build validation | PASS |
| Web regression scripts | 13/13 PASS |
| Pre-Departure canonical transitions | 18/18 PASS |
| API tests | 8 suites, 31 tests, 0 failures |
| API build | PASS |
| Android `testDebugUnitTest` | BUILD SUCCESSFUL; 53 tasks up-to-date |
| Vite development entrypoints | 3/3 HTTP 200 |
| Production preview entrypoints | 3/3 HTTP 200 |
| Built UTF-8 navigation check | PASS |

The three validated Browser routes were:

- `/`;
- `/before-departure.html`;
- `/after-departure.html`.

## 4. Impact

### Browser

- one build-entry source instead of two;
- all entrypoints remain active;
- development and production consume the same plugin/input definition;
- navigation text encoding is corrected;
- no application flow or public URL changed.

### API

- no API source, contract, route or environment setting changed;
- all API tests and the API build passed.

### Android

- no native source, Capacitor configuration, APK or application version changed;
- the Web build contract used by future Android packaging is now canonical;
- Android unit build passed.

### Production

- no deployment, rebuild of the approved Docker artifact, service restart,
  infrastructure change or public configuration change occurred.

## 5. Rollback

Rollback is limited to build tooling:

1. restore the former inline plugin and input definitions in both consumers;
2. remove their imports of the shared factory;
3. retain application sources and data unchanged;
4. rerun the MC-3A shield and both Web build paths.

No database, storage or runtime-data rollback is required.

## 6. Warnings

- The existing main Web chunk remains 521.32 kB after minification and still triggers
  Vite's advisory threshold. SR-01 did not change this bundle.
- Android retains the existing Gradle `flatDir` advisory.
- The known import cycle
  `agent-governance.registry.ts` ↔ `monitoring-department.ts`
  remains exactly at the MC-3A baseline. Its removal belongs to SR-02.
- The repository retains pre-existing modified/untracked work outside SR-01; it was
  preserved without cleanup or reset.

## 7. Competition-material protection

The following registered SHA-256 values were revalidated:

| Protected item | SHA-256 |
|---|---|
| `AGM_OpenAI_Build_Demo_EN.mp4` | `E8D7156B5DBF1CB50F15478C0A4DB2AFEE73C36F2D2781E387CA2E547664F7B7` |
| `AGM_OpenAI_Build_Promo_Final_EN.mp4` | `E32437617EB1827A5EAAFFA60B5351C106F392297F1C19D7014012C068C8688E` |
| `OPENAI_BUILD_DEVPOST.md` | `F511C16A8805A25D2AA523F737C07DDD947D101403F54162FD9B07D1EA98DD90` |
| `OPENAI_BUILD_VIDEO_SCRIPT.md` | `57853B43F656D2BE0D380AFB5B1D0D4DF75448FFB441AEED1E104CC953EE72DA` |
| Protection register | `F19A40918D3146687F4B7DD6B722626D568224D244525EF960D8056FBEBD5E1D` |

All match the approved baseline. No competition artifact was changed.

## 8. Acceptance criteria

- Single definition for entrypoints and HTML transform: PASS.
- Same three entrypoints: PASS.
- Development proxy unchanged: PASS.
- UTF-8 navigation content correct: PASS.
- Browser behavior preserved: PASS.
- API unaffected and validated: PASS.
- Android unaffected and validated: PASS.
- No production source behavior change: PASS.
- No file deletion from the application architecture: PASS.
- Competition material unchanged: PASS.

## 9. Verdict and next recommendation

**SR-01 PASS — SINGLE WEB BUILD DEFINITION ESTABLISHED**

Recommendation:

Authorize only **SR-02 — Neutral Governance Record Contract and Import-Cycle
Removal** under a separate mandate. SR-02 must remain a type/import-boundary change,
must preserve rendered governance/monitoring output and must reduce the known Web
cycle count from one to zero without introducing any new cycle.
