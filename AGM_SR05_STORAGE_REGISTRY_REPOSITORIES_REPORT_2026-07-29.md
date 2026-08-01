# AGM — SR-05 Storage Registry and Repository Boundaries

Date: 2026-07-29  
Roadmap: MC-3B  
Authorized intervention: SR-05 only  
Production deployment performed: no  
Competition material: FROZEN AND PROTECTED

## 1. Objective and result

SR-05 established explicit ownership for the four keys in the authorized
OCR/Tutorial persistence family and placed their access behind repositories:

- OCR history;
- main Tutorial completion;
- Email Tutorial completion;
- Roadmap invitation dismissal.

No key was renamed, no schema or stored value was migrated, and no dual-write
path was introduced. Existing user-visible persistence and reset behavior was
preserved.

`main.ts` was reduced from the SR-04 result of 4,590 lines to 4,557 lines.

## 2. Storage Registry

`apps/web/src/storage/storage-registry.ts` is the single literal source for the
four SR-05 keys:

| ID | Key | Schema | Owner | Retention | Reset scopes |
|---|---|---:|---|---|---|
| `ocrHistory` | `agm.ocr.history.v1` | 1 | `ocr` | until user reset | OCR-history delete; all-local-data |
| `tutorialCompletion` | `agm.tutorial.completed.v1` | 1 | `guidance` | until OCR-history delete | OCR-history delete |
| `emailTutorialCompletion` | `agm.tutorial.email.completed.v1` | 1 | `guidance` | until OCR-history delete | OCR-history delete |
| `roadmapInvitation` | `agm.roadmap.invitation.v1` | 1 | `guidance` | until OCR-history delete | OCR-history delete |

The unusual Tutorial retention policy records existing behavior; SR-05 did not
reinterpret or correct it.

## 3. OCR repository

`createOcrHistoryRepository(storage)` owns:

- reading the unchanged `agm.ocr.history.v1` key;
- invalid/malformed JSON recovery to `[]`;
- non-array recovery to `[]`;
- existing minimum validation of `id`, `createdAt` and `imageDataUrl`;
- the existing eight-item limit;
- byte-equivalent `JSON.stringify(items.slice(0, 8))` persistence;
- key removal for user reset.

Recreating the repository against the same storage restores the same serialized
history, providing restart evidence.

The UI action that clears OCR history continues writing an empty array. The
legal data-deletion/reset actions continue removing the key.

## 4. Tutorial repository

`createTutorialRepository(storage)` owns:

- Boolean existence checks for the three Tutorial/Roadmap markers;
- exact ISO timestamp persistence supplied by the existing callers;
- removal of all three markers during OCR-history deletion.

Any non-empty stored marker, including a malformed non-date string, continues
to be treated as completed/dismissed, matching the previous behavior.

## 5. Reset parity

The pre-existing reset distinction was preserved and characterized:

- `deleteOcrHistoryData()` clears OCR history and all three Tutorial/Roadmap
  markers;
- `resetAllLocalData()` clears OCR history but does not clear those three
  markers.

The test inspects the actual application wiring and fails if this distinction
changes.

## 6. Explicit exclusions honored

SR-05 did not move or modify:

- profile persistence;
- contact persistence;
- message-library preferences;
- incident journal persistence;
- legal-acceptance persistence;
- administrator session storage;
- Pre-Departure, After-Departure or Premium Operational Context persistence;
- storage keys or reset policies outside the four-key SR-05 family;
- UI markup, CSS, routes or user-visible messages;
- API, Android native, production or infrastructure configuration.

## 7. Files affected

- `apps/web/src/storage/storage-registry.ts` — new SR-05 ownership and policy
  registry.
- `apps/web/src/storage/ocr-history.repository.ts` — new OCR repository and
  moved `OcrHistoryItem` type.
- `apps/web/src/storage/tutorial.repository.ts` — new Tutorial/Roadmap
  repository.
- `apps/web/src/main.ts` — connects only the authorized OCR/Tutorial consumers.
- `apps/web/scripts/test-sr05-storage-repositories.ts` — persistence, restart,
  malformed-data and reset characterization.
- `apps/web/scripts/test-mc3a-main-characterization.ts` — checks storage markers
  across `main.ts` and the authorized registry.
- `apps/web/scripts/test-sr04-low-risk-extractions.ts` — removes the historical
  location guard superseded by SR-05; all remaining SR-04 boundaries stay
  protected.
- `apps/web/package.json` — includes the SR-05 test in `test:mc3a`.
- `AGM_SR05_STORAGE_REGISTRY_REPOSITORIES_REPORT_2026-07-29.md` — this report.

No file was deleted.

## 8. Characterization and gate handling

The SR-05 test was added before implementation and initially failed with
`ERR_MODULE_NOT_FOUND`, as expected.

After repository implementation:

1. isolated repository tests passed up to the expected assertion that local
   definitions still existed;
2. OCR was connected and TypeScript passed;
3. Tutorial/Roadmap was connected and TypeScript plus SR-05 passed;
4. MC-3A stopped because its historical key marker required the OCR key literal
   inside `main.ts`;
5. that marker was relocated, without changing its expected value, to inspect
   `main.ts` and the registry together;
6. MC-3A stopped again because SR-04 intentionally protected the local OCR
   reader until a future storage mandate;
7. SR-05 superseded that single historical location guard, while the dedicated
   SR-05 persistence guard replaced it;
8. the full MC-3A suite then passed.

Neither stop represented a runtime or persistence regression; both were
authorized boundary-location changes detected by the characterization shield.

## 9. Validation results

| Validation | Result |
|---|---|
| SR-05 registry/repository parity | PASS |
| OCR exact serialization and eight-item limit | PASS |
| OCR malformed JSON/non-array recovery | PASS |
| OCR minimum-record filtering | PASS |
| OCR restart/restore | PASS |
| Tutorial exact marker values | PASS |
| Tutorial restart/restore | PASS |
| Tutorial malformed non-empty marker parity | PASS |
| OCR/Tutorial reset wiring | PASS |
| TypeScript `tsc --noEmit` | PASS |
| MC-3A complete shield | PASS |
| SR-01, SR-03 and SR-04 regressions | PASS |
| Web import graph | PASS; 144 files, zero cycles |
| API import graph | PASS; 70 files, zero cycles |
| Premium foundation | PASS |
| Premium Operational Context persistence | PASS |
| Pre-Departure canonical transitions | PASS; 18/18 |
| Pre-Departure offline outbox | PASS |
| After-Departure Stage 3 | PASS |
| Web production build | PASS; 164 modules |
| Production API endpoint validation | PASS |
| E6.3 Browser shell/navigation | PASS |
| E6.4–E6.6 Browser regression | PASS |
| Local `/`, `/before-departure.html`, `/after-departure.html` | PASS; 3/3 HTTP 200 |
| API tests | PASS; 8 suites, 31 tests |
| API build | PASS |
| Android `testDebugUnitTest` | BUILD SUCCESSFUL; 53 tasks up-to-date |
| Deleted files | PASS; none |
| Competition-material hashes | PASS; unchanged |

## 10. Build and regression assessment

- The three storage modules explain the source graph change from 141 to 144
  files and the production transformation change from 161 to 164 modules.
- The main chunk is 521.83 kB and retains the existing size advisory.
- All four SR-05 key literals occur only in the registry under application
  source; no dual-write literal remains in `main.ts`.
- Out-of-scope profile, contacts, message-library, incident and legal storage
  call sites remain in place.
- Browser entrypoints, navigation and shell behavior passed.

## 11. Competition-material protection

| Protected item | SHA-256 |
|---|---|
| `AGM_OpenAI_Build_Demo_EN.mp4` | `E8D7156B5DBF1CB50F15478C0A4DB2AFEE73C36F2D2781E387CA2E547664F7B7` |
| `AGM_OpenAI_Build_Promo_Final_EN.mp4` | `E32437617EB1827A5EAAFFA60B5351C106F392297F1C19D7014012C068C8688E` |
| `OPENAI_BUILD_DEVPOST.md` | `F511C16A8805A25D2AA523F737C07DDD947D101403F54162FD9B07D1EA98DD90` |
| `OPENAI_BUILD_VIDEO_SCRIPT.md` | `57853B43F656D2BE0D380AFB5B1D0D4DF75448FFB441AEED1E104CC953EE72DA` |
| Protection register | `F19A40918D3146687F4B7DD6B722626D568224D244525EF960D8056FBEBD5E1D` |

All values match the protected baseline.

## 12. Warnings and observations

- The Web build retains the pre-existing main-chunk size advisory.
- Android retains the pre-existing Gradle `flatDir` advisory.
- The sandboxed Gradle attempt lacked network access. The approved retry passed
  in 11 seconds using the local Android Studio JBR.
- PowerShell validation used `pnpm.cmd`; execution policy was not changed.
- Pre-existing modified and untracked work outside SR-05 was preserved without
  reset or cleanup.

## 13. Rollback

Rollback is family-specific and does not transform stored data:

1. restore the former OCR key constant and local read/save functions;
2. return OCR callers to those local functions;
3. restore the former Tutorial/Roadmap constants, reads and direct writes;
4. restore the previous reset calls;
5. retain extracted files until a separate cleanup authorization;
6. restore the two historical characterization locations if the entire SR-05
   intervention is rolled back;
7. rerun persistence parity, MC-3A, Web build, Browser and Android.

No key deletion, migration, dual-write or user-data transformation is required.

## 14. Verdict and recommendation

**SR-05 PASS — STORAGE OWNERSHIP AND OCR/TUTORIAL REPOSITORIES ESTABLISHED**

All SR-05 acceptance criteria are satisfied:

- keys and serialized values are unchanged;
- no migration or dual-write exists;
- reset behavior is unchanged;
- ownership for the authorized four-key family is complete;
- malformed-data recovery is demonstrated;
- restart/restore is demonstrated;
- Web, API, Browser and Android validations passed;
- competition materials remain unchanged.

Recommendation for SR-06: do not begin platform capability ports without a
separate mandate naming exactly one capability, its Browser/native adapters,
permission matrix, fallback behavior and required physical-device evidence.
