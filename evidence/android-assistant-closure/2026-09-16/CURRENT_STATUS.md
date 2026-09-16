# AGM Android Assistant closure — Production status

Date: 2026-09-16 (Europe/Berlin)  
Canonical revision: `b430545f5ed6cefec5370a29924d72e6e512d20d`  
Implementation revision: `e1214b88a10783f3e2589ecbcd0c8a8f175f1a03`  
Camera correction revision: `0fdddd7`  
Production workflow: `35030903720`

## Completed implementation

- All Android Assistant actions enter the Permission Guardian before the native effect.
- Guardian coverage includes assistant handoff, settings, navigation, dialer, open app, calendar, reminder, alarm, share, email, camera, and Gmail retrieval.
- Gmail read is authorized server-side before retrieval and its safe Guardian evidence identifiers are retained in the tool trace.
- Natural voice routing covers Maps, Gmail, Camera, explicit dialer requests, Android Assistant handoff, and calendar phrases including “mâine la 10”, “vineri la 14:30”, and “peste două ore”.
- Retrieved Gmail context and the user answer remain separate from engineering source trace.
- Camera capture uses `Guardian REQUEST → Android permission → Guardian EXECUTION → capture` and fails closed.
- The user command to open Camera now uses the official system still-image camera intent. This prevents launcher-label matching from selecting an unrelated third-party camera application.
- No Accessibility Service, Device Owner, MDM, root, Shizuku, general UI control, or direct-call permission was introduced.

## Validation completed

- Android Action Layer protocol: PASS.
- Device Assistant handoff suite: PASS across 12 supported languages.
- Native Camera runtime suite: PASS.
- API targeted tests: 19/19 PASS.
- Full API test suite: 77 suites / 466 tests PASS.
- API lint and TypeScript builds: PASS.
- Web Production build: PASS.
- Semantic TTS normalization: 12/12 languages PASS.
- Browser Plugin Status: PASS.
- Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE.
- Browser Session Status: PASS through the controlled AGM Playwright/Chromium runner.
- Target Page Status: PASS.
- Natural response and engineering source separation Browser audit: PASS.

## Signed Android artifact and installation

- Application: `com.agm.cockpit`, version `1.4.0`, versionCode `26`.
- Signed AAB SHA-256: `91ACE93779990504BC3D29805B6786E78D9E36CFD37E7F939AFE0A49E19FBE49`.
- Production signer SHA-256: `6E:18:2B:67:BD:A9:E4:C4:F6:EE:93:D7:95:F6:19:AF:06:88:D3:96:7F:9B:74:B5:37:9A:42:FE:67:AC:C8:C1`.
- Universal APK SHA-256: `8D5B99EE879310A694E661CE9C99E3ACE93BF27852A2BF157F40D7F5792248D0`.
- DPAPI credential custody: PASS; no secret printed or materialized as evidence.
- In-place upgrade on Samsung SM-S931B (`RFCY70WDHXK`): PASS.
- `firstInstallTime=2026-08-31 01:37:10` remained unchanged.
- `lastUpdateTime=2026-09-16 02:59:02`.

## Production deployment and controls

Workflow `35030903720` completed successfully:

- verify: PASS;
- API publish: PASS;
- Web publish: PASS;
- deploy: PASS;
- canonical M2M lifecycle: PASS;
- two post-deploy soak cycles over 200 seconds: PASS;
- final Production agent runtime: PASS;
- Production Browser/runtime audit: PASS.

Permission Guardian Production control:

- ALLOW: `APPROVED`, reason `ALLOWLIST_AND_AUTHORITY_VERIFIED`;
  - evaluation event: `f4ebacfc-0de2-4224-8067-9d8448d5f9e5`;
  - correlation: `dc209636-ea73-4f78-9fab-c477cfac4a32`.
- DENY: `DENIED`, reason `PERMISSION_OR_SCOPE_NOT_ALLOWLISTED`;
  - evaluation event: `426ee8a9-7c58-46d2-ad01-6c123374b670`;
  - correlation: `d2610882-2dfb-4077-8e00-724df0306678`;
  - finding: `b0e96aea-7797-4431-8269-3a34031fbdac`.

Post-deploy public checks:

- API live: HTTP 200;
- API ready: HTTP 200, database available, translation provider configured;
- public app canonical redirect: `/basic`, final HTTP 200.

## Recovery journal

1. Native patching was blocked by the Windows workspace ACL. The project-approved Codex apply-patch helper was used; no direct file-write workaround was introduced.
2. PowerShell script execution policy blocked the `pnpm` shim. `pnpm.cmd` was used without changing host policy.
3. The isolated worktree had unresolved dependency paths. The existing lockfile/store was used for an offline install; no speculative dependency was installed.
4. The first Production run reached deployment and Guardian PASS, then encountered a transient HTTP 503 in the immediate post-rollout M2M call. Curl retry/backoff was added to the lifecycle step, the SSH transport validator passed, and the minimal affected Production run `35030903720` completed successfully.

## Physical-device execution

The signed current build was exercised on Samsung SM-S931B with Android API 36. No Accessibility Service, keyguard bypass, PIN automation, or direct-call permission was used.

- Text transcript → Maps: PASS. Android opened Google Maps from the AGM UID.
- Text transcript → dialer: PASS. AGM used `ACTION_DIAL`; no call was placed.
- Calendar handoff: PASS at the AGM boundary. Android resolved the event intent to the only installed handler, Outlook; actual event insertion remains PARTIAL because that external application is not configured and displayed onboarding.
- Open Gmail: PASS.
- Open Camera: the initial build exposed a real routing defect by opening a third-party launcher match. Revision `0fdddd7` replaced label matching with the official system camera intent; the rebuilt signed APK then opened `com.sec.android.app.camera/.Camera`: PASS.
- Android default assistant handoff: PASS. Android opened the configured Google voice interaction service without vendor hard-coding in AGM.
- Gmail read and Romanian TTS: PASS. The current signed APK returned a natural answer, displayed no source URLs/headings, and completed TTS playback. Mailbox content is intentionally excluded from this report.
- Force-stop and relaunch: PASS. Premium/Basic UI returned without a login prompt and without the assistant-unavailable state.
- Acoustic STT on this station: NOT PROVEN. The on-device Romanian recognizer reported a missing language pack and AGM correctly fell back once to the default recognizer, but station-generated audio did not produce a reliable handset microphone capture. Historical accepted real-phone STT evidence remains valid for unchanged STT code.
- Gmail-derived destination navigation: NOT PROVEN. No legitimate address-bearing source was established; AGM did not invent an address.

## Restart recovery state

A real `adb reboot` was issued. After legitimate USB/RSA reattachment, Android reported `sys.boot_completed=1` with boot id `5e79c6b6-ee39-4792-b900-cb875666192f`.

- AGM force-stop/relaunch after the real restart: PASS.
- Existing AGM session after restart: PASS. Premium/Basic UI loaded without a login or PIN prompt.
- Post-restart Gmail request execution: NOT PROVEN. The command was entered, but the WebView remained at its explicit confirmation step during the bounded automated attempt; no Gmail authorization failure, assistant-unavailable state, visible source URL, or source heading was observed. This is not recorded as an application or authentication failure because the request was never confirmed.
- Gmail read and Romanian TTS on the same signed APK before restart: PASS, preserved above.

No security boundary was bypassed and no mailbox content is retained in this report.

## Current truthful verdict

`GUARDIAN PRE-ACTION ENFORCEMENT = PASS`

`GUARDIAN ALLOW CONTROL = PASS`

`GUARDIAN DENY CONTROL = PASS`

`GMAIL TOKEN AUTO-RENEWAL = PASS` (real Production expiry evidence preserved)

`NORMAL OPERATION REQUIRES PASSWORD REENTRY = NO`

`NORMAL OPERATION REQUIRES OWNER APPROVAL = NO`

`AGM SESSION PERSISTENCE AFTER REAL PHONE RESTART = PASS`

`POST-RESTART GMAIL RETRIEVAL = NOT PROVEN — REQUEST REMAINED UNCONFIRMED`

`GENERAL UI CONTROL = NOT AVAILABLE BY DESIGN`

`CURRENT-BUILD PHYSICAL ANDROID E2E = PARTIAL — ACOUSTIC STT, EXTERNAL CALENDAR INSERT, GMAIL-DERIVED DESTINATION, AND POST-RESTART GMAIL EXECUTION NOT FULLY PROVEN`

`AGM ANDROID ASSISTANT = PARTIAL`

`DRIVER HANDS-FREE FLOW = PARTIAL`

`GUARDIAN COVERAGE = PASS`

`ZERO-TOUCH NORMAL OPERATION = PARTIAL`

No final PASS is granted until the remaining current-build physical matrix is proven under its real external prerequisites.
