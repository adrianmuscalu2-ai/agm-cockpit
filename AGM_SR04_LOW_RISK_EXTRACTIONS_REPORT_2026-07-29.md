# AGM — SR-04 Low-Risk Extractions

Date: 2026-07-29  
Roadmap: MC-3B  
Authorized intervention: SR-04 only  
Production deployment performed: no  
Competition material: FROZEN AND PROTECTED

## 1. Objective and result

SR-04 extracted the smallest characterized, low-risk responsibilities from
`main.ts`:

- clipboard capability and DOM fallback;
- pure HTML/text-preview formatting;
- read-only translation health probes.

The extraction reduced `main.ts` from the characterized 4,687-line baseline to
4,590 lines, a reduction of 97 lines. Existing callers remain active and use
internal imports only.

Service Worker registration, storage reads/writes, health scheduling,
application-state updates, rendering, routes and domain workflows remain in
their previous owners.

## 2. Extracted boundaries

### 2.1 Clipboard

`apps/web/src/platform/clipboard.ts` now owns:

- primary `navigator.clipboard.writeText`;
- the existing hidden-textarea and `document.execCommand('copy')` fallback;
- the explicit result `clipboard | fallback`.

The Translator, Email and Text Corrector callers preserve their distinct
existing success/fallback translation keys. Other callers that previously
ignored the copy method continue to do so.

### 2.2 Text formatting

`apps/web/src/text-format.ts` now owns:

- `escapeHtml`;
- multiline preview formatting;
- inline multiline preview formatting.

The same entity encoding is retained, including `&#039;`, and newlines remain
rendered as `<br />`. The former default mail-preview placeholder is now passed
explicitly by the existing caller.

### 2.3 Translation health client

`apps/web/src/platform/translation-health.client.ts` now owns only the two
read-only probes:

- live/ready GET with cache busting, `no-store`, JSON accept header and
  five-second abort;
- functional translation GET with twelve-second abort and the existing
  404-to-POST operational-check fallback.

The following remain in `main.ts`:

- online/offline and visibility listeners;
- the 30-second refresh interval;
- dynamic adapter URL loading;
- state updates;
- conditional re-rendering.

## 3. Explicit exclusions honored

SR-04 did not move or modify:

- `registerServiceWorker`;
- OCR history or any other storage repository;
- storage keys, serialization or reset behavior;
- mail-framing logic dependent on profile state;
- UI markup or CSS;
- API source or contracts;
- Android source;
- production or infrastructure configuration.

## 4. Files affected

- `apps/web/src/main.ts` — imports the three extracted boundaries and removes
  only their former local definitions.
- `apps/web/src/platform/clipboard.ts` — new clipboard capability helper.
- `apps/web/src/platform/translation-health.client.ts` — new read-only health
  client.
- `apps/web/src/text-format.ts` — new pure text-format helpers.
- `apps/web/scripts/test-sr04-low-risk-extractions.ts` — parity and boundary
  characterization.
- `apps/web/package.json` — adds the SR-04 test to `test:mc3a`.
- `AGM_SR04_LOW_RISK_EXTRACTIONS_REPORT_2026-07-29.md` — this report.

No file was deleted.

## 5. Characterization and incremental execution

The SR-04 test was added before implementation:

1. initial execution failed with `ERR_MODULE_NOT_FOUND`, as expected;
2. text helpers were extracted and TypeScript was run;
3. TypeScript detected a local `uiLanguage` name collision in one explicit
   placeholder call;
4. the call was corrected to use the renderer's already-selected language;
5. TypeScript passed;
6. clipboard extraction was applied and TypeScript passed;
7. health-client extraction was applied;
8. the complete SR-04 characterization and TypeScript passed.

The test provides parity evidence for:

- exact HTML entity output;
- placeholder and multiline output;
- native clipboard and DOM fallback paths;
- health probe URL resolution and cache-busting query;
- request cache/header/method/body behavior;
- functional-health success;
- 404 translation fallback success;
- removal of the seven former local helper definitions;
- continued presence of Service Worker, health orchestration and storage
  boundaries in `main.ts`.

## 6. Validation results

| Validation | Result |
|---|---|
| SR-04 extraction parity | PASS |
| TypeScript `tsc --noEmit` | PASS |
| MC-3A main characterization | PASS |
| MC-3A Android static baseline | PASS |
| MC-3A module boundaries | PASS |
| SR-01 build-definition regression | PASS |
| SR-03 app-shell contracts | PASS |
| Web import graph | PASS; 141 files, zero cycles |
| API import graph | PASS; 70 files, zero cycles |
| Mail translation send guard | PASS |
| Premium foundation | PASS |
| Web production build | PASS; 161 modules |
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

## 7. Build and regression assessment

- The three extracted modules explain the Web module-count change from 158 to
  161.
- The main production chunk is 521.27 kB, compared with 521.32 kB before
  SR-04.
- Browser routes, navigation, shell and E6 behavior passed.
- Copy status keys and fallback behavior remain unchanged.
- Health request methods, payload, headers, timeouts and failure return value
  remain unchanged.
- No storage or Service Worker behavior entered the SR-04 diff.

## 8. Competition-material protection

| Protected item | SHA-256 |
|---|---|
| `AGM_OpenAI_Build_Demo_EN.mp4` | `E8D7156B5DBF1CB50F15478C0A4DB2AFEE73C36F2D2781E387CA2E547664F7B7` |
| `AGM_OpenAI_Build_Promo_Final_EN.mp4` | `E32437617EB1827A5EAAFFA60B5351C106F392297F1C19D7014012C068C8688E` |
| `OPENAI_BUILD_DEVPOST.md` | `F511C16A8805A25D2AA523F737C07DDD947D101403F54162FD9B07D1EA98DD90` |
| `OPENAI_BUILD_VIDEO_SCRIPT.md` | `57853B43F656D2BE0D380AFB5B1D0D4DF75448FFB441AEED1E104CC953EE72DA` |
| Protection register | `F19A40918D3146687F4B7DD6B722626D568224D244525EF960D8056FBEBD5E1D` |

All values match the approved baseline.

## 9. Warnings and observations

- The Web build retains the pre-existing main-chunk size advisory.
- Android retains the pre-existing Gradle `flatDir` advisory.
- The sandboxed Android attempt could not download Gradle. The same validation
  was rerun with approved Gradle network access and passed in seven seconds.
- Android used the local Android Studio JBR only for the validation process.
- PowerShell validations used `pnpm.cmd`; execution policy was not changed.
- Pre-existing modified and untracked work outside SR-04 was preserved without
  reset or cleanup.

## 10. Rollback

Rollback is isolated by extraction:

1. restore the selected helper body to `main.ts`;
2. restore each former local call path;
3. remove the corresponding import;
4. leave the extracted file in place until a separate cleanup authorization;
5. remove the SR-04 test from `test:mc3a` only if the entire SR-04 intervention
   is rolled back;
6. rerun SR-04 parity, MC-3A, Web build and Browser regression.

No database, storage, native, infrastructure, production or user-data rollback
is required.

## 11. Verdict and recommendation

**SR-04 PASS — LOW-RISK TEXT, CLIPBOARD AND HEALTH BOUNDARIES EXTRACTED**

All acceptance criteria are satisfied:

- user-visible text and statuses remain equivalent;
- clipboard fallback behavior is preserved;
- health request and failure behavior is preserved;
- Service Worker and storage mutation were deferred;
- Web and API graphs remain acyclic;
- Browser, API and Android gates passed;
- no file was deleted;
- competition material remains unchanged.

Recommendation: close SR-04 independently. Do not begin SR-05 or introduce a
Storage Registry without a separate mandate covering persistence
characterization, malformed-data recovery and reset parity.
