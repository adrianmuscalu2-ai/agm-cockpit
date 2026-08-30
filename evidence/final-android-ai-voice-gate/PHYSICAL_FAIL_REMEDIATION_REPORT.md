# Android physical voice failure — remediation report

Date: 2026-08-29 (Europe/Berlin)
Publication: **NOT EXECUTED**
Owner-observed pre-fix verdict: **FAIL**
First remediated candidate owner retest: **FAIL / SUPERSEDED**
Current candidate controlled retest: **PASS**
Owner physical retest: **PASS**
Voice release blocker: **CLOSED**
Publication: **NOT EXECUTED**

## Reported behavior

On Samsung SM-S931B, opening voice caused the microphone state to blink repeatedly. No answer was produced and the cycle stopped only when the owner pressed Cancel.

## Demonstrated root cause

1. The prior controlled Android runner left its injected WebView probe and forced English test profile active after completion.
2. Android STT returned `ERROR_NO_MATCH` (`7`). The application caught the error, waited 700 ms and automatically started another recognition cycle. That retry loop caused the visible blinking and made Cancel the only terminal action.

## Minimal remediation

- `premium-assistant.runtime.ts`: an STT failure is now terminal for the active hands-free session. It records `stt-terminal-error`, transitions the session to `OFF`, releases microphone authority, updates the toggle and exposes the translated error. No timeout/retry loop remains.
- `test-premium-assistant-ui.ts`: assertions now enforce terminal fail-closed behavior and forbid the former 700 ms retry contract.
- `validate-voice-barge-in-android.mjs`: the controlled runner force-stops and relaunches the app in a fresh process during cleanup, and validates the physical `NO_MATCH -> OFF` behavior plus a 2.5-second no-restart guard.

## Exact installed candidate

- Package: `com.agm.cockpit`
- Device: Samsung SM-S931B (`RFCY70WDHXK`)
- Version: `1.3.0`
- versionCode: `21`
- Local APK SHA-256: `B03473B18CC9ECB61DA2BB58B88BB78C97A14C44A97041418BF7D017A7DB0FED`
- Installed APK SHA-256: `B03473B18CC9ECB61DA2BB58B88BB78C97A14C44A97041418BF7D017A7DB0FED`
- Exact match: **PASS**

## Verification

- Web build: **PASS**
- Capacitor Android sync: **PASS**
- Gradle `assembleDebug --offline`: **PASS**
- Premium assistant UI contract + i18n 12/12: **PASS**
- Device Capability Router test: **PASS**
- TypeScript `--noEmit`: **PASS**
- Physical controlled voice run: **PASS**
- Native TTS stop acknowledgement: **PASS**, 9 ms for microphone barge-in and 1 ms for a new text question
- Five rapid interruptions / single authority: **PASS**
- Stale model suppression: **PASS**
- `ERROR_NO_MATCH (7) -> OFF`: **PASS**
- Automatic STT restart after terminal error: **ABSENT / PASS**
- Controlled probe after fresh launch: `false`
- Forced test token/profile/language after fresh launch: `null`

Canonical machine evidence: `evidence/voice-barge-in/android/2026-08-28T23-34-57-849Z/report.json`.

## Second physical contradiction and endpoint correction

The owner then demonstrated that the first replacement answered two or three questions and subsequently opened and closed recognition immediately. Physical logs proved a separate native endpointing defect:

- Android default recognition became ready and emitted a false `onBeginningOfSpeech` callback roughly 360 ms later in background noise;
- AGM treated that raw VAD callback as confirmed speech and armed an 850 ms endpoint timer;
- the timer stopped recognition before real text existed, producing `ERROR_NO_MATCH (7)`;
- the now fail-closed JavaScript layer correctly stopped the session, making the native premature stop visible instead of looping forever.

Current minimal correction:

- raw VAD no longer arms the AGM endpoint;
- a non-empty partial recognition result is required before AGM endpointing is enabled;
- RMS activity may rearm the endpoint only after partial text exists;
- the recognized-text silence window is 1600 ms; Android intent silence hints are 1500/1000 ms;
- a true no-match remains terminal, so the former infinite retry loop cannot return.

Current installed candidate:

- SHA-256 local and installed: `E488AF9A553935BC09F3F32B96D0FC4307C59C22CA879B3BD8910CC959BEF8E2`
- versionName `1.3.0`, versionCode `21`
- installed at `2026-08-29 01:47:45`
- contract/type/Java compile: **PASS**
- controlled Android run: **PASS**
- controlled no-speech duration before genuine `NO_MATCH`: about 5.1 seconds, not 850 ms
- controlled probe cleanup: **PASS**

Replacement machine evidence: `evidence/voice-barge-in/android/2026-08-28T23-48-22-395Z/report.json`.

## Owner closure

After recovery of the Premium session, the clean real application was left on `/premium/copilot` with no controlled probe present. The owner repeated the physical voice interaction on Samsung SM-S931B and returned the explicit verdict `PASS` on 2026-08-29.

- Premium access and automatic session restoration: **PASS**
- Microphone remains available across consecutive questions: **PASS**
- Premature open/close regression: **ABSENT / PASS**
- Physical owner validation: **PASS**
- Voice release blocker: **CLOSED**
- Publication: **NOT EXECUTED**

No commit, push, publication, DNS, tunnel, connector or API-routing change was executed.
