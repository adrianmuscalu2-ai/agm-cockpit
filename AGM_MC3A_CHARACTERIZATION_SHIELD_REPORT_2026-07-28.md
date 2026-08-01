# AGM — MC-3A Characterization Shield

Date: 2026-07-28  
Scope: tests, characterization and read-only validation  
Production logic moved or extracted: no  
Competition material: frozen and protected

## 1. Executive result

MC-3A established a repeatable characterization shield around the critical Browser,
Android and API surfaces identified by MC-2. No production source file was changed by
this increment. One obsolete assertion in an existing Pre-Departure test was aligned
with the already-implemented restore contract: a restored session explicitly contains
`confirmation: undefined`.

## 2. Shield introduced

| Area | Evidence | Result |
|---|---|---|
| `main.ts` | State inventory, critical function markers, persistence markers and three HTML entrypoints | PASS |
| Browser boundaries | Pre-Departure, After-Departure and Operational Context import boundaries | PASS |
| Android baseline | Capacitor identity, HTTPS scheme, application version, permissions and registered native plugins | PASS |
| Import graph | Web: 134 files; API: 70 files | PASS against recorded baseline |
| `TransportsService` | Successful accept, invalid state and archived transport; transaction/audit/history and no mutation on rejection | 3/3 PASS |
| Pre-Departure | Canonical transitions, browser shell, validation, outbox, issues, final report and UUID fallback | PASS |
| After-Departure | Stage 3 behavior and Stage 4 presentation | PASS |
| Communication | Mail translation send guard | PASS |
| Administrative diagnostics | Android administrative report | PASS |

New executable checks:

- `apps/web/scripts/test-mc3a-main-characterization.ts`
- `apps/web/scripts/test-mc3a-android-baseline.ts`
- `apps/web/scripts/test-mc3a-boundaries.ts`
- `apps/web/scripts/check-import-cycles.ts`
- `apps/api/test/transports.service.characterization.spec.ts`
- package command: `pnpm --filter @agm/web run test:mc3a`

## 3. Test and build evidence

- Web MC-3A characterization: PASS.
- Premium foundation and canonical Operational Context: PASS.
- Pre-Departure core: 18/18 canonical transitions PASS.
- All additional Web characterization scripts executed: PASS.
- API: 8 suites, 31 tests, 0 failures.
- API build: PASS.
- Web production build: PASS.
- Browser local smoke:
  - `/`: HTTP 200;
  - `/before-departure.html`: HTTP 200;
  - `/after-departure.html`: HTTP 200.
- Android `testDebugUnitTest`: BUILD SUCCESSFUL, 53 tasks (9 executed,
  44 up-to-date).

The first Android invocation exposed only a workstation prerequisite: `JAVA_HOME` was
unset. The test was rerun with the Android Studio JBR selected for that process; no
system or project configuration was changed.

## 4. Demonstrated findings and explicit gaps

### Known import cycle

The Web graph contains one pre-existing cycle:

`agent-governance.registry.ts` → `monitoring-department.ts` →
`agent-governance.registry.ts`.

MC-3A records this exact cycle as the accepted current baseline. The automated check
fails if it disappears unexpectedly, changes, or if any additional cycle appears.
Removal belongs to a separately authorized structural increment.

### Coverage gaps

- The 65-field `main.ts` state inventory and selected side-effect/persistence markers
  are locked, but `main.ts` does not yet have branch-level DOM coverage.
- Outbox behavior is covered at the domain/script level; browser storage failure,
  quota and multi-tab races are not automated.
- Android native configuration and unit build are covered. A device/emulator UI
  regression suite is not present.
- Network failures and physical-device permissions for Camera, microphone and email
  require a later controlled integration suite.
- No numerical line/branch coverage gate is currently configured.

These gaps are visible and do not invalidate the shield established for the currently
characterized contracts.

## 5. Warnings

- The Web build reports a main JavaScript chunk of 521.32 kB after minification,
  exceeding Vite's 500 kB advisory threshold. This confirms the MC-2 hotspot and is
  not remediated in MC-3A.
- Android Gradle reports the existing `flatDir` repository advisory.
- The repository contained pre-existing modified and untracked work. MC-3A preserved
  it and made no attempt to clean, reset or reclassify those files.

## 6. Competition-material integrity

Revalidated SHA-256:

| Protected item | SHA-256 |
|---|---|
| `AGM_OpenAI_Build_Demo_EN.mp4` | `E8D7156B5DBF1CB50F15478C0A4DB2AFEE73C36F2D2781E387CA2E547664F7B7` |
| `AGM_OpenAI_Build_Promo_Final_EN.mp4` | `E32437617EB1827A5EAAFFA60B5351C106F392297F1C19D7014012C068C8688E` |
| `OPENAI_BUILD_DEVPOST.md` | `F511C16A8805A25D2AA523F737C07DDD947D101403F54162FD9B07D1EA98DD90` |
| `OPENAI_BUILD_VIDEO_SCRIPT.md` | `57853B43F656D2BE0D380AFB5B1D0D4DF75448FFB441AEED1E104CC953EE72DA` |
| Protection register | `F19A40918D3146687F4B7DD6B722626D568224D244525EF960D8056FBEBD5E1D` |

All values match the registered MC-0 baseline. No protected item was changed.

## 7. Traceability and reversibility

MC-3A changes are limited to new test/instrumentation files, one package test command,
one corrected historical test assertion, and this report. No deployment, public
service, production database, APK, production configuration or competition artifact
was modified.

## 8. Verdict

**MC-3A PASS — CHARACTERIZATION SHIELD ESTABLISHED**

Recommendation: MC-3B may be proposed as the first small structural extraction, but
only under a separate mandate, using this shield as its mandatory regression gate.
