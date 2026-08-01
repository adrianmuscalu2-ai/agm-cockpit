# AGM — SR-06 Diagnostics Capability Port

Date: 2026-07-29  
Roadmap: MC-3B  
Authorized capability: Diagnostics only  
Production deployment performed: no  
Competition material: FROZEN AND PROTECTED  
Final gate status: STOP / NOT READY — PHYSICAL ANDROID EVIDENCE MISSING

## 1. Capability implemented

SR-06 placed Diagnostics behind an explicit platform capability port while
retaining the existing compatibility entrypoint:

`apps/web/src/native-diagnostics.ts`

The active caller in `main.ts` was not changed. The same two public operations
remain available:

- `collectSafeTechnicalDiagnostics()`;
- `isNativeAndroidApp()`.

Voice, Email handoff and Camera/OCR were not changed.

## 2. Architecture

The Diagnostics boundary now contains:

- `DiagnosticsPort` and `SafeTechnicalDiagnostics` contracts;
- Browser diagnostics adapter;
- Android Capacitor plugin adapter;
- platform-selection facade;
- declarative Browser/Android capability matrix;
- legacy facade re-export for existing consumers.

The facade uses the Browser adapter when Capacitor reports a non-native
platform and the Android plugin adapter for native execution, matching the
previous selection behavior.

## 3. Browser/Android matrix

| Platform | Adapter | Inputs | Permission model | Result | Fallback |
|---|---|---|---|---|---|
| Browser | `browser-diagnostics` | `navigator.onLine` | none | Web/build/Browser/not-applicable/online-or-offline | safe Browser payload |
| Android native | `AgmDiagnostics` plugin | package info, build/device OS, active network capabilities | `ACCESS_NETWORK_STATE`, normal install-time, no runtime prompt | app version, build, model, Android version, connection type | plugin error propagates to the existing safe-report fallback in `main.ts` |

## 4. Permission model

The Android plugin reads `ConnectivityManager` and therefore requires:

`android.permission.ACCESS_NETWORK_STATE`

This is a normal install-time permission:

- no runtime permission dialog is introduced;
- no permission request or check method was added to the plugin;
- no microphone, camera, storage, location or contacts permission is requested
  by Diagnostics.

The permission was added to the source manifest and verified in:

- merged debug manifest;
- packaged debug manifest;
- generated debug APK.

## 5. Fallback parity

### Browser

The Browser adapter returns exactly the previous safe payload:

- `appVersion: Web`;
- `build: web`;
- `phoneModel: Browser`;
- `androidVersion: Nu se aplică`;
- connection `online` or `offline`.

### Android

The Android adapter does not mask plugin failure. It propagates the same error
to the existing caller in `main.ts`, whose established `.catch(...)` builds the
safe fallback with unknown device/build values and online/offline connection.

No new status, message, dialog or UI branch was introduced.

## 6. Files affected

- `apps/web/src/capabilities/diagnostics/diagnostics.port.ts`;
- `apps/web/src/capabilities/diagnostics/diagnostics.capability.ts`;
- `apps/web/src/capabilities/diagnostics/browser-diagnostics.adapter.ts`;
- `apps/web/src/capabilities/diagnostics/android-diagnostics.adapter.ts`;
- `apps/web/src/capabilities/diagnostics/diagnostics.facade.ts`;
- `apps/web/src/native-diagnostics.ts`;
- `apps/web/android/app/src/main/AndroidManifest.xml`;
- `apps/web/scripts/test-sr06-diagnostics-capability.ts`;
- `apps/web/scripts/test-mc3a-android-baseline.ts`;
- `apps/web/package.json`;
- `AGM_SR06_DIAGNOSTICS_CAPABILITY_REPORT_2026-07-29.md`.

No file was deleted. The existing Java plugin and `main.ts` remained
byte-identical to the SR-06 baseline.

## 7. Automated validation results

| Validation | Result |
|---|---|
| SR-06 Diagnostics capability characterization | PASS |
| Browser online payload | PASS |
| Browser offline payload | PASS |
| Browser/Android port selection | PASS |
| Native failure propagation | PASS |
| Existing safe-report fallback retained | PASS |
| Android permission matrix | PASS |
| No Diagnostics runtime permission prompt | PASS |
| Native plugin field contract | PASS |
| Admin Android report formatting | PASS |
| TypeScript | PASS |
| MC-3A complete shield | PASS |
| SR-01/SR-03/SR-04/SR-05 regressions | PASS |
| Web import graph | PASS; 149 files, zero cycles |
| API import graph | PASS; 70 files, zero cycles |
| Web production build | PASS; 167 modules |
| Browser E6.3 and E6.4–E6.6 | PASS |
| Local routes | PASS; 3/3 HTTP 200 |
| API tests | PASS; 8 suites, 31 tests |
| API build | PASS |
| Android unit build | PASS |
| Android debug APK assembly | PASS |
| Android Gradle result | BUILD SUCCESSFUL; 102 tasks |
| Merged/packaged manifest permission | PASS |
| Physical Android Diagnostics execution | NOT RUN; no ADB device |

APK produced:

`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`

Size: 22,110,988 bytes.

## 8. Physical-device gate

Two ADB checks were performed. Both returned:

`List of devices attached`

with no device entries.

The mandatory physical validation must therefore remain open. To close it:

1. connect and unlock the Android device;
2. authorize USB debugging;
3. confirm exactly one `device` entry with `adb devices -l`;
4. install the generated debug APK with replacement enabled;
5. verify `ACCESS_NETWORK_STATE` in the installed package;
6. open the application and trigger the existing safe technical report;
7. verify non-secret values for app version, build, phone model, Android
   version and connection type;
8. repeat for Wi-Fi and offline state, and for mobile data if available;
9. confirm that no permission dialog appears;
10. capture only redacted evidence, without identifiers or secrets.

Build success, static checks or an emulator must not be reported as physical
device evidence.

## 9. Regression assessment

- `main.ts` SHA-256 is unchanged:
  `AE7F7272A86A4AA20AF7E399792C64DF5C9A659B0AE3CD4EFAF139FEEFF14972`.
- `AgmDiagnosticsPlugin.java` SHA-256 is unchanged:
  `258B4A0458D93A4737A448650A8F42388FDC3E677A62D83B113994215CCB9D7B`.
- UI, messages, report fields and fallback ownership are unchanged.
- No production or infrastructure action occurred.

## 10. Competition-material protection

| Protected item | SHA-256 |
|---|---|
| `AGM_OpenAI_Build_Demo_EN.mp4` | `E8D7156B5DBF1CB50F15478C0A4DB2AFEE73C36F2D2781E387CA2E547664F7B7` |
| `AGM_OpenAI_Build_Promo_Final_EN.mp4` | `E32437617EB1827A5EAAFFA60B5351C106F392297F1C19D7014012C068C8688E` |
| `OPENAI_BUILD_DEVPOST.md` | `F511C16A8805A25D2AA523F737C07DDD947D101403F54162FD9B07D1EA98DD90` |
| `OPENAI_BUILD_VIDEO_SCRIPT.md` | `57853B43F656D2BE0D380AFB5B1D0D4DF75448FFB441AEED1E104CC953EE72DA` |
| Protection register | `F19A40918D3146687F4B7DD6B722626D568224D244525EF960D8056FBEBD5E1D` |

All values match the protected baseline.

## 11. Warnings

- The Web build retains the pre-existing main-chunk size advisory; current
  main chunk is 522.02 kB.
- Android retains the pre-existing Gradle `flatDir` advisory.
- The sandboxed Gradle attempt lacked network access; the approved retry passed.
- Pre-existing modified and untracked work outside SR-06 was preserved.

## 12. Rollback

Rollback is limited to the Diagnostics binding:

1. restore the previous implementation in `native-diagnostics.ts`;
2. remove the `ACCESS_NETWORK_STATE` manifest declaration only if reverting the
   Diagnostics connectivity read;
3. leave the new port/adapter files until a separate cleanup authorization;
4. remove the SR-06 test from MC-3A only for a complete SR-06 rollback;
5. rerun MC-3A, Web, Browser, API and Android gates.

No data, schema, storage, production or infrastructure rollback is required.

## 13. Verdict

**SR-06 FAIL / STOP — IMPLEMENTATION AND AUTOMATED GATES PASS, PHYSICAL ANDROID
EVIDENCE MISSING**

No regression was identified. The only failed acceptance condition is the
absence of mandatory physical Android evidence.

Recommendation: keep SR-06 open. Do not begin another capability or SR-07.
Resume only when an authorized Android device is visible through ADB, execute
the physical matrix above, and then issue the final PASS/FAIL closure report.
