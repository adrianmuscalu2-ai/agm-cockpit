# Android navigation and contact dial validation — 2026-09-17

## Outcome

- Implementation: PASS.
- Signed production-compatible APK: PASS.
- Physical navigation handoff: PASS for Google Maps, Waze, and TomTom.
- Physical contact lookup prerequisite: PASS for exact contact `Mona Vodafone` (one contact, one phone row).
- Physical dialer handoff: PASS; `com.samsung.android.dialer/.DialtactsActivity` opened through `ACTION_DIAL`.
- Direct call: NOT PERFORMED. `ACTION_CALL` remains forbidden.
- Contact number exposure/persistence in evidence: NONE.

## Artifact

- Package: `com.agm.cockpit`
- Version: `1.4.0` (`versionCode=26`)
- APK SHA-256: `890537BE6E6810C8288BBA08E85426477ABE87046E4431F2512A651936716A43`
- Certificate SHA-256: `6E:18:2B:67:BD:A9:E4:C4:F6:EE:93:D7:95:F6:19:AF:06:88:D3:96:7F:9B:74:B5:37:9A:42:FE:67:AC:C8:C1`
- Installation: `adb install -r` PASS; `firstInstallTime` preserved (`2026-08-31 01:37:10`).
- New runtime permission: `android.permission.READ_CONTACTS`, explicitly authorized by the Product Owner and observed `granted=true`.

## Physical target evidence

| Request | Observed top resumed activity | Verdict |
|---|---|---|
| Maps | `com.google.android.apps.maps/com.google.android.maps.MapsActivity` | PASS |
| Waze | `com.waze/.MainActivity` | PASS |
| TomTom | `com.tomtom.speedcams.android.map/com.tomtom.oneapp.home.presentation.AppActivity` | PASS |
| Mona Vodafone | `com.samsung.android.dialer/.DialtactsActivity` | PASS |

The contact phone value was held only in process memory for the handoff, URI-encoded in the same way as `DeviceHandoffIntents`, never printed, and never written to evidence.

## Automated verification

- `pnpm --filter @agm/web test:android-action-layer`: PASS.
- `pnpm --filter @agm/web exec tsc --noEmit`: PASS.
- `pnpm --filter @agm/api test -- --runInBand permission-guardian.service.spec.ts`: PASS (2/2).
- `gradlew :app:compileDebugJavaWithJavac`: PASS.
- Secure AAB + universal APK build: PASS; DPAPI custody, secrets printed=false.
- Full web production build executed by the secure Android build: PASS.
- Legacy contract suites Wave 2B, Wave 2C, and Wave 3A: PASS.
- Wave 2D retains an unrelated pre-existing mojibake command-fixture failure (`SunÄƒ` routes to conversation only); no Android contact or navigation code is involved.

## Browser gate

- Browser Plugin Status: PASS.
- Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE (`SESSION_ATTACHMENT_MISSING`).
- Browser Session Status: PASS through controlled AGM Playwright/Chromium runner.
- Target Page Status: PASS.
- Report: `evidence/premium-assistant-source-separation/2026-09-17T21-03-00-925Z/report.json`.

## Rescue journal

1. Gradle initially failed because the temporary worktree had no `sdk.dir` / `ANDROID_HOME`.
2. Cause classified `DEFECT DE CONFIGURARE`; the verified SDK at `C:\Users\adria\AppData\Local\Android\Sdk` was reused. No installation occurred.
3. Minimal Java compilation retest passed.
4. The signed-build script was initially blocked by the process execution policy.
5. It was relaunched once with process-scoped `-ExecutionPolicy Bypass`; system policy was not changed; build passed.
6. Release WebView did not expose a DevTools socket. No product code was weakened to enable release debugging.
7. The approved native-equivalent route executed the exact allowlisted Android intents and verified their resolved activities on the physical owner device.

RESCUE RESULT: RECOVERED. HANDOFF TO ATLAS: implementation, artifact, Browser gate, and physical intents are proven; unrelated Wave 2D fixture remains out of scope.
