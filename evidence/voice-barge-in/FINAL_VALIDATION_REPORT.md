# AGM voice turn cancellation / barge-in — pre-release validation

Generated: `2026-08-28T07:42:36+02:00`

## Scope and release state

The voice-turn cancellation defect was corrected without publication or infrastructure changes. Browser Desktop and Browser Mobile runtime validation passed. The physical Android gate remains blocked because the authorized Samsung SM-S931B is not attached to the host, so the release blocker remains open and publication remains prohibited.

## Root cause

The prior implementation already aborted the main model request and called TTS stop, but it did not provide a complete single-authority contract:

1. stale Browser SpeechRecognition callbacks could mutate the current state after cancellation;
2. an aborted Browser recognition promise could remain unsettled;
3. concurrent rapid preemptions could resume an older caller after an awaited stop;
4. a delayed model response could reach completion after its AbortSignal was ignored by the transport;
5. repeated runtime binding retained old global/native listeners;
6. microphone activation while a typed answer was speaking did not always preempt that audio first;
7. Android did not return an explicit stop/queue-flush receipt or native speech-to-stop timing evidence.

## Changes

- Added generation/sequence leases and a process-wide serialized cancellation barrier.
- Invalidated the old request, recognition, turn ID, streaming continuation, TTS and audio authority before awaiting cleanup.
- Added explicit Browser recognition cancellation and cycle guards for speech-start, speech-end and result callbacks.
- Suppressed and journaled stale model/TTS/STT callbacks.
- Disposed old window and Capacitor listeners when the assistant runtime is rebound.
- Added exactly one observable active turn authority marker.
- Made microphone start preempt existing playback before opening a new recognition cycle, including typed-answer playback.
- Added Android native `TextToSpeech.stop()` queue-flush receipts and a defensive stop at `onBeginningOfSpeech()`.
- Added Android monotonic timestamps for `NEW SPEECH DETECTED -> OLD AUDIO STOPPED`.

## Browser runtime evidence

Controlled runner report: `evidence/voice-barge-in/browser/2026-08-28T05-41-04-579Z/report.json`

- Browser Plugin Status: `PASS`
- Integrated Browser Control Status: `PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE`
- Browser Session Status: `PASS`
- Target Page Status: `PASS`
- Desktop scenarios A–E: `PASS`
- Mobile scenarios A–E: `PASS`
- delayed response delivered after AbortSignal: `true`, suppressed as stale
- rapid interruptions: `5`, obsolete answers suppressed: `4`
- maximum active recognition count: `1`
- maximum active audio count: `1`
- maximum active turn authority count: `1`
- measured `NEW SPEECH DETECTED -> OLD AUDIO STOPPED`: Desktop `0 ms`, Mobile `0 ms`
- audio queue flush telemetry: `true`

Report SHA-256: `C641FFB23FB013BDE7C67E6D8E6C9389C7C12528ADF40B8C466026EDD974E4E9`

## Commands and results

- `pnpm.cmd --filter @agm/web test:premium-voice-session` — PASS
- `pnpm.cmd --filter @agm/web test:premium-assistant-client` — PASS
- `pnpm.cmd --filter @agm/web test:premium-assistant-ui` — PASS
- `pnpm.cmd --filter @agm/web test:premium-handsfree` — PASS
- `pnpm.cmd web:build` — PASS
- `pnpm.cmd rescue:browser-preflight` — PASS with optional IAB limitation recorded
- `node scripts/validate-voice-barge-in-browser.mjs` — PASS Desktop + Mobile
- `gradlew.bat :app:compileDebugJavaWithJavac` — PASS
- `pnpm.cmd exec cap sync android` — PASS
- `gradlew.bat :app:assembleDebug` — PASS
- physical `adb devices -l` / serial handshake — FAIL, no attached device

## Integrity

- Runtime SHA-256: `60531C42370226DB20DA495790BAF3365BF74BEBA2B1EA1FB52C628EB5049546`
- Native bridge SHA-256: `73100005F25963B49C1428A714EBD234497C3582FF0135601EB37E44FD9D734A`
- Android plugin SHA-256: `7621901110BA43BA35067D1D2C64A10B8F9DE2A2CC25CD5EF5C9920ED8AE24C9`
- APK SHA-256: `C40CA6D795B62A3DF469ED35FA95E8ABEA87B5983C44CDB33CA26F69BA63CA48`
- Base HEAD (no commit authorized): `dc8d793d45fe4108bf3f9b8eb833d8423cd27201`

## Verdict

- OLD TURN CANCEL = `PASS` on Browser runtime; Android physical evidence pending
- OLD TTS STOP = `PASS` on Browser runtime; Android native build PASS, physical evidence pending
- AUDIO QUEUE FLUSH = `PASS` on Browser runtime; Android native build PASS, physical evidence pending
- STALE RESPONSE SUPPRESSION = `PASS`
- SINGLE ACTIVE TURN = `PASS` on Browser Desktop/Mobile
- RAPID INTERRUPTION TEST = `PASS` on Browser Desktop/Mobile
- ANDROID BARGE-IN = `FAIL / EXTERNAL RUNTIME BLOCKER` (authorized phone absent)
- BROWSER DESKTOP BARGE-IN = `PASS`
- BROWSER MOBILE BARGE-IN = `PASS`
- PUBLICATION = `NOT EXECUTED`
- RELEASE BLOCKER = `OPEN / NO-GO` until the physical Samsung runtime test passes
