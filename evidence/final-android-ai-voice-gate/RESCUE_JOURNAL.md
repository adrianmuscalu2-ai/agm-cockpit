# Final Android AI + Voice release gate — Rescue journal

Date: 2026-08-29 (Europe/Berlin)

Frozen candidate:

- APK: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`
- SHA-256: `92B358D70BB4BD86F5FAE16F40BD86133274E0B8D834ECEFE90847933738B56F`
- Expected package: `com.agm.cockpit`, versionName `1.3.0`, versionCode `21`
- Candidate was not rebuilt, committed, pushed or published during this gate.

## Recovery attempts

| Time | Classification | Action | Evidence / result |
|---|---|---|---|
| 2026-08-29 00:05 CEST | Session attachment failure | Queried ADB device inventory. | `List of devices attached` contained no device. |
| 2026-08-29 00:06 CEST | Runtime/session | Started the existing authorized ADB server and repeated device inventory. | No device attached. No install or device mutation executed. |
| 2026-08-29 00:07 CEST | Physical host path | Queried Windows present PnP devices for Samsung / Android / ADB / VID_04E8. | No matching present device; cable/physical device is not exposed to Windows. |
| 2026-08-29 00:09 CEST | Minimal retry after interval | Repeated ADB inventory once, without repeating server restart. | Still no device attached. |

## Preserved evidence

- Device Capability Router PASS remains frozen for the same APK hash in `evidence/device-capability-router/android/2026-08-28T21-16-35-515Z/report.json`.
- Browser and Web build PASS evidence was not reopened.
- The final voice runner was bound to the frozen candidate hash and syntax-checked. It has not been executed because a physical Android runtime is mandatory for this gate.

## Current handoff

`RECOVERY EXHAUSTED` for the current physical connection state. The bounded next action is to reconnect and unlock Samsung SM-S931B with USB debugging authorized, then execute only:

1. Browser preflight required by the project runbook;
2. `scripts/validate-voice-barge-in-android.mjs` against the frozen APK;
3. consolidated final verdict.

## Recovery completion

| Time | Action | Evidence / result |
|---|---|---|
| 2026-08-29 00:31 CEST | Samsung reconnected and ADB/PnP path recovered. | `RFCY70WDHXK device`, model `SM-S931B`. |
| 2026-08-29 00:31 CEST | Compared installed package with frozen candidate. | Local and installed SHA-256 both `92B358D70BB4BD86F5FAE16F40BD86133274E0B8D834ECEFE90847933738B56F`; versionName `1.3.0`, versionCode `21`. |
| Android run `2026-08-28T22-32-19-721Z` | Executed only the final physical Voice + Router gate. | 7/7 scenarios PASS; candidate identity PASS. `RECOVERED`; HANDOFF TO ATLAS. |

Final recovery status: `RECOVERED`.

## Owner contradiction and replacement recovery

| Time | Classification | Action | Evidence / result |
|---|---|---|---|
| 2026-08-29 01:24 CEST | Physical runtime contradiction | Owner reported endless microphone blinking, no response and stop only via Cancel. | Previous automated PASS and old candidate were revoked. |
| 2026-08-29 01:25 CEST | Runtime/session contamination | Inspected live WebView. | Controlled probe was still active; preferred language/profile were forced to English test values. |
| 2026-08-29 01:26 CEST | Runtime defect | Inspected Android speech logs. | Repeated `ERROR_NO_MATCH (7)` followed by automatic recognition restarts every ~700 ms. |
| 2026-08-29 01:27 CEST | Minimal product remediation | Replaced STT retry with terminal fail-closed `session.off()` and added runner cleanup. | UI/router/type checks PASS. |
| 2026-08-29 01:32 CEST | Dependency/runtime recovery | First Gradle invocation exceeded the command window; verified no new APK, then reran verified local Gradle offline. | Build successful; no installation performed speculatively. |
| 2026-08-29 01:33 CEST | Physical deployment | Installed replacement APK without clearing user data. | Local and installed SHA-256 both `B03473B18CC9ECB61DA2BB58B88BB78C97A14C44A97041418BF7D017A7DB0FED`. |
| Android run `2026-08-28T23-34-57-849Z` | Affected minimal physical retest | Barge-in, stale response, five rapid interruptions, native stop and explicit `NO_MATCH -> OFF` no-restart guard. | Controlled run PASS; final owner manual confirmation remains required. |

Current recovery status: `RECOVERED / OWNER MANUAL CONFIRMATION PENDING`.

## Second owner contradiction — premature native endpoint

| Time | Classification | Action | Evidence / result |
|---|---|---|---|
| 2026-08-29 01:43 CEST | Physical runtime contradiction | Owner reported 2–3 successful questions followed by recognition opening and closing immediately. | Candidate `B03473...` revoked for release purposes. |
| 2026-08-29 01:44 CEST | Native product defect | Preserved and inspected the live Samsung log. | `onBeginningOfSpeech` fired on noise; AGM 850 ms endpoint then forced `ERROR_NO_MATCH (7)` repeatedly on explicit attempts. |
| 2026-08-29 01:45 CEST | Minimal native remediation | Required non-empty partial text before custom endpointing; extended natural-pause values. | UI contract and TypeScript PASS; Java compiled successfully. |
| 2026-08-29 01:47 CEST | Physical deployment | Installed replacement without clearing user data. | Local/installed SHA-256 `E488AF9A553935BC09F3F32B96D0FC4307C59C22CA879B3BD8910CC959BEF8E2`, exact match. |
| Android run `2026-08-28T23-48-22-395Z` | Affected controlled retest | Repeated barge-in/stale/single-authority checks and no-match guard on the replacement. | PASS; a genuine no-speech timeout occurred after ~5.1 s and did not auto-restart. |

Current recovery status: `RECOVERED / SECOND OWNER MANUAL CONFIRMATION PENDING`.

## Premium access recovery before owner voice retest

| Time | Classification | Action | Evidence / result |
|---|---|---|---|
| 2026-08-29 01:54 CEST | External authentication/runtime | Owner reported Premium login returned “too many attempts” despite one intended attempt; Samsung Pass had populated the form. | Voice candidate and prior evidence frozen; no credential value inspected. |
| 2026-08-29 01:55 CEST | Read-only WebView inspection | Inspected route, visible state and resource timing. | Correct `/access` user-login form; no user/admin session; `access-error-status=429`; first visible login in the current page already received 429. |
| 2026-08-29 01:56 CEST | Client efficiency defect noted | Inspected authentication resources. | Unauthenticated Android heartbeat caused periodic `/auth/refresh` requests, with duplicate refresh paths on 401. No duplicate `/auth/login` submission was produced by one controlled submit. |
| 2026-08-29 01:57 CEST | Minimal recovery after documented server window | Submitted the already populated form exactly once without reading credentials. | One `/auth/login`, HTTP 201; Premium entitlement valid. |
| 2026-08-29 01:59 CEST | Session restoration proof | Force-stopped/relaunched the app without clearing data. | Automatic `/auth/refresh` HTTP 201 and `/auth/entitlements` HTTP 200; no login/Samsung Pass needed. |
| 2026-08-29 01:59 CEST | Handoff | Opened the clean real `/premium/copilot` route and cleared logcat after preserving prior evidence. | Session present, voice state OFF, controlled probe absent; owner voice retest marker recorded. |

Recovery status: `RECOVERED`; `HANDOFF TO ATLAS / OWNER PHYSICAL VOICE RETEST`.

## Owner verdict

| Time | Action | Evidence / result |
|---|---|---|
| 2026-08-29 02:00 CEST | Owner repeated the voice flow on the clean Samsung runtime after Premium session recovery. | Explicit owner verdict: `PASS`. Premature microphone open/close blocker closed for APK `E488AF9A553935BC09F3F32B96D0FC4307C59C22CA879B3BD8910CC959BEF8E2`. |

Final rescue status: `RECOVERED`; `HANDOFF TO ATLAS`; voice blocker `CLOSED`. Publication remains `NOT EXECUTED`.
