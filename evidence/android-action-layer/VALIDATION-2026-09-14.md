# Android Action Layer — validation journal (2026-09-14)

## Scope and release identity

- Isolated branch: `feature/android-action-layer-20260913`
- Base: `4c0b1f0b8ae894da23ecd03ffa4978fe5f099970`
- Android package: `com.agm.cockpit`
- Version: `1.4.0` (`versionCode 25`)
- Physical device: Samsung SM-S931B, Android 16 / API 36, serial `RFCY70WDHXK`
- Production signing certificate SHA-256: `6E:18:2B:67:BD:A9:E4:C4:F6:EE:93:D7:95:F6:19:AF:06:88:D3:96:7F:9B:74:B5:37:9A:42:FE:67:AC:C8:C1`

## Signed artifacts

| Artifact | SHA-256 | Validation |
| --- | --- | --- |
| `app-release.aab` | `F8354D9B5DE63F229210BA204C977789AA3601B04A375629F881A452CE3ACE62` | PASS: structure, Production signature, expected certificate, non-debug signer, v25 |
| `agm-1.4.0-25-production.apks` | `2E0608AAFEF4034C2740EED7D710B32A4F91996F3DEF4072F506913F0A99DBA0` | PASS: Bundletool runner status and immutable input contract |
| extracted `universal.apk` | `876F2378C1366A3684D91D0239388401106D77656942626090575A1C410314FA` | PASS: APK Signature Scheme v2/v3, expected signer, package/version/manifest |

The manifest contains only `INTERNET`, `ACCESS_NETWORK_STATE`, `RECORD_AUDIO`, `CAMERA`, and the generated non-exported dynamic-receiver permission. No direct-call, calendar-write, SMS, contacts, location, or Accessibility permission was added.

## Implemented control flow

`request -> Intent Router -> context validation -> confirmation policy -> Guardian evaluation -> official Android intent -> resolution/target/result or explicit fallback`

- Navigation uses the official geo/view route and the Android-selected compatible handler.
- Phone routes to the dialer; AGM does not place a call directly.
- Calendar routes to the system insert UI; AGM does not write the calendar directly.
- Share uses Android Sharesheet.
- Email creates a draft only; there is no general auto-send.
- General requests route only to the Android-selected assistant provider.
- Unsupported requests fail explicitly; no synthetic success is emitted.
- Driver Voice Mode stores bounded active context for 30 minutes in session storage and resolves short follow-ups such as “Navighează acolo”.
- Gmail retrieval returns a natural user answer, a separate engineering source trace, and a separate typed action context. Sources are never inserted into the user answer.

## Automated validation

| Gate | Result | Evidence |
| --- | --- | --- |
| Web Production build / TypeScript | PASS | Vite Production build completed; 300 modules transformed |
| Semantic TTS normalization | PASS | 12/12 languages |
| Android Action Layer protocol | PASS | `test-android-action-layer.ts` |
| Device Assistant handoff | PASS | 12 languages, six official handoff actions, controlled fallback |
| Premium Assistant UI | PASS | 12/12 languages |
| AGM session client refresh | PASS | automatic renewal plus explicit auth/read-only behavior |
| TURN UI contract | PASS | granular Android Action Layer projection |
| API suites | PASS | 6/6 suites, 48/48 tests: Assistant, knowledge, Gmail, Gmail action, Guardian, TURN |
| Java Android Release compile | PASS | `:app:compileReleaseJavaWithJavac` |
| Browser preflight | PASS with platform limitation | Browser Plugin PASS; Browser Session PASS; Target Page PASS; IAB attachment unavailable/optional; controlled runner required |
| Controlled Browser audit | PASS | `../premium-assistant-source-separation/2026-09-14T03-42-12-445Z/report.json` |

The Guardian negative-control unit test injects an unapproved permission/scope request. The request is denied, does not become authority, is journaled, and creates `PERMISSION_GUARDIAN_CONTROL_FINDING`. Missing telemetry remains `NOT_PROVEN`.

## Physical Android evidence completed

- Signed v25 installed with `adb install -r`; `firstInstallTime=2026-08-31 01:37:10` remained unchanged, proving upgrade without app-data deletion.
- The authenticated AGM home reopened after upgrade; no forced login appeared.
- Action Layer controls and all routes were rendered on the Production-signed APK.
- The selected assistant was resolved from Android as `com.google.android.googlequicksearchbox/com.google.android.voiceinteraction.GsaVoiceInteractionService` without vendor hard-coding.
- Assistant handoff opened `com.google.android.googlequicksearchbox/.GoogleAppImplicitActionAssistGatewayInternal`.
- Screenshots are stored in `physical-production-v25-2026-09-14/`.
- A second signed v25 containing the explicit Guardian auth-failure presentation fix was installed successfully as an upgrade at `2026-09-14 05:36:01`; app data again remained preserved.

## Protocol matrix status

| Protocol | Local deterministic states | Physical Production status |
| --- | --- | --- |
| Android permissions | `AUTHORIZED`, `DENIED`, `DENIED_DONT_ASK_AGAIN`, `REVOKED`, `NOT_PROVEN`, plus not-required/unavailable fallbacks | Upgrade and selected-provider paths proven; revoke/recovery, reinstall, data-clear, provider switch/unavailable, target unavailable, force-stop and reboot matrix still required |
| AGM authorization | Valid session, automatic refresh, revoked/expired authority and explicit `AUTH / PERMISSION FAILURE` are covered by code/tests | Upgrade persistence proven; complete Production expiration/revocation/force-stop/reboot matrix still required |
| Gmail authorization | Access expiry, proactive refresh, retry once on 401, revoked refresh, offline/recovery and non-Gmail request separation are covered by code/tests | Real Gmail-to-address-to-navigation and real revocation/recovery still required after deploy |
| Android intents | Every receipt carries request ID, resolution, target, result/fallback, permission status and timestamp | Assistant PASS; Navigation/Dialer/Calendar/Share complete physical matrix still required after Guardian deploy |
| Guardian | Allowlist, fail-closed policy, audit journal, negative control and control finding PASS locally | Production endpoint not deployed: `GET /api/v1/security/permission-guardian/status` returns HTTP 404 while API health returns 200 |

## Build-process recovery

The signed APKS runner wrote `PASS`, but a detached Gradle console stream filled after artifact generation and left the parent AAB status at `AWAITING_LOCAL_SECRET_INPUT`. The exact build process tree was stopped only after independent AAB/APKS/APK signature and hash validation. `build-secure-android-aab-local.ps1` now drains and sanitizes Bundletool output inside the parent process so future detached builds can terminate and persist their final status. No keystore mutation occurred and no secret was printed.

## Current verdict (before push/deploy)

- `ANDROID ACTION LAYER = FAIL` (implementation and partial physical evidence PASS; required full physical Production matrix incomplete)
- `PERMISSION PROTOCOLS = FAIL` (local PASS; required physical revoke/recovery/reboot/reinstall/data-clear matrix incomplete)
- `AUTHORIZATION PROTOCOLS = FAIL` (local PASS; required real expiration/revocation/recovery matrix incomplete)
- `GUARDIAN PERMISSION CONTROL = FAIL` (local negative control PASS; Production endpoint HTTP 404)
- `DRIVER MODE = FAIL` (local implementation/tests PASS; required physical Production voice chain incomplete)
- `FINAL PRODUCTION PASS = FAIL`

## Rescue continuation (2026-09-15)

- The first v26 Release compile failed because the Gradle child process did not inherit the installed Android SDK path. Classification: `DEFECT DE CONFIGURARE`; no dependency was missing.
- The minimal retest injected the verified SDK path only into the Gradle process. `:app:compileReleaseJavaWithJavac` completed successfully with 56 tasks; no software was installed and no global environment was changed.
- Two stale PowerShell signing sessions and their Bundletool/Gradle child from the unrelated `_codex_stage_premium_assistant_compat_20260913` worktree were still alive after their v25 status and APKS output were already PASS. Their exact PIDs and command paths were verified, then only those obsolete process trees were terminated. The accepted v25 APKS artifact remained intact.
- The first secure v26 signing attempt did not produce a new artifact: the sanitized preflight reported `ANDROID_RELEASE_KEYSTORE_OR_ALIAS_VALIDATION_FAILED`. The existing `app-release.aab` is still the older v25 artifact and must not be promoted as v26.
- No Android signing password exists in AGM DPAPI custody or Windows Credential Manager. Under the release runbook, one protected password entry remains necessary only after code freeze. It must not be requested repeatedly during implementation.
- The v26 contract is now consistent across Gradle, AAB validation, APKS naming, and the Android signing/device runbook.

These FAIL verdicts intentionally preserve operational truth. They must not be promoted until the implementation is pushed/deployed and the remaining physical Production matrix is recorded.

## Post-deploy continuation

### Release and Production identity

- Commit `b21f556ee55c62b15ee648e3ca06fa3e00f663ed` was pushed to both `origin/feature/android-action-layer-20260913` and `origin/agm-canonical-20260820`.
- Production workflow run `34885407946` completed successfully: verify, API publish, Web publish, deploy, and Production browser/runtime validation all passed.
- The public API health endpoints return HTTP 200. The deployed Guardian `status` and `evaluate` routes return HTTP 401 without authentication, proving that the routes exist and remain protected.
- Public `turn-operational-truth.v2` remained `PASS`, but its Android projection truthfully reported `guardianPermissionControl=NOT_PROVEN` because a persisted Production negative-control pair was still absent.

### Physical signed-v25 checks after deploy

- The same Samsung SM-S931B remained connected and the signed Production v25 remained installed as an upgrade, with application data preserved.
- Force-stop followed by relaunch preserved the authenticated AGM session: PASS.
- The AGM Guardian-approved assistant handoff opened the Android-selected provider at `com.google.android.googlequicksearchbox/.GoogleAppImplicitActionAssistGatewayInternal`: PASS.
- Physical screenshots are in `physical-production-v25-postdeploy-2026-09-14/`, including `07-force-stop-relaunch.png` and `12-guardian-approved-assistant-target.png`.

### Gmail-to-navigation diagnosis

The physical query was:

`Citește ultimul mail de la dispecerat și deschide adresa de descărcare`

- Gmail OAuth refresh and real Gmail read/search/message/thread calls passed in a fresh process.
- User-visible sources remained absent and three engineering source-trace entries remained available separately.
- The real mailbox search returned no message matching `from:dispecerat`; neither that search nor the latest available message contained an extractable destination, phone number, or date/time.
- Therefore, the router had no legitimate destination to hand to Android. No destination was invented and no unrelated latest message was substituted.
- A presentation defect independently replaced the deterministic Gmail no-result answer with the generic verified-contact refusal because the query contained `adresă`. This did not cause the missing action context, but it made the factual Gmail outcome misleading in the UI.

### Follow-up presentation correction

- `enforceVerifiedContactBoundary` now preserves deterministic `gmail-inbox` tool responses, including no-result and authorization-state answers, while the generic anti-fabrication boundary remains unchanged for non-tool answers.
- Functional regression test: PASS.
- Android Action Layer protocol test: PASS.
- Device Assistant handoff suite: PASS (12 languages, six official actions, controlled fallback).
- Web Production build and TypeScript: PASS.
- Controlled Browser audit: `../premium-assistant-source-separation/2026-09-14T19-59-06-157Z/report.json`.
  - Browser Plugin Status: PASS
  - Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE
  - Browser Session Status: PASS
  - Target Page Status: PASS
  - Natural response, no user-facing sources, engineering endpoint separation, semantic TTS, Gmail answer preservation in UI, and Gmail answer preservation in TTS: PASS.

### Production Guardian negative-control gate prepared

- A release gate now creates a 60-second in-memory user JWT inside the Production API container; it does not create a refresh session and never prints the token.
- The gate calls the canonical public Guardian endpoint with an intentionally non-allowlisted Android scope.
- It requires `DENIED`, `authorityGranted=false`, and `PERMISSION_OR_SCOPE_NOT_ALLOWLISTED`.
- It then verifies the exact `PERMISSION_GUARDIAN_EVALUATION` and associated open `PERMISSION_GUARDIAN_CONTROL_FINDING` directly in the Production database and outputs only event identifiers and safe verdict fields.
- Script syntax, SSH release transport contract, and Guardian service negative-control tests: PASS.
- This gate and the Gmail presentation correction are local and require a new explicit push/deploy approval before they can become Production evidence.

## Current truthful verdict

- `b21f556 PRODUCTION DEPLOYMENT = PASS`
- `FORCE-STOP / RELAUNCH SESSION PERSISTENCE = PASS`
- `ANDROID-SELECTED ASSISTANT HANDOFF = PASS`
- `GMAIL OAUTH REFRESH + REAL READ = PASS`
- `GMAIL → DISPATCH ADDRESS → NAVIGATION = FAIL / SOURCE DATA ABSENT`
- `GMAIL PRESENTATION FIX = LOCAL PASS / PRODUCTION PENDING`
- `GUARDIAN NEGATIVE CONTROL = LOCAL PASS / PRODUCTION PENDING`
- `REBOOT + PERMISSION REVOKE/RECOVERY + AUTH REVOKE/RECOVERY MATRIX = PENDING`
- `FINAL PRODUCTION PASS = FAIL`
