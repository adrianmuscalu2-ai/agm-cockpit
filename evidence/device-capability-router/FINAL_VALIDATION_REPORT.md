# AGM Device Capability Router — final validation

Date: 2026-08-28
Publication: **NOT EXECUTED**
Final router verdict: **PASS**

## Architectural rule

Every supported operation is classified before execution. The default authority order is:

`LOCAL DEVICE → AGM AI → EXTERNAL DEVICE AI`

External device AI is never an automatic fallback. It is reachable only through an Android capability that exists at runtime and an explicit, visible user action. Documents, Car Mover data, secrets and other sensitive classes are blocked from external handoff.

Safety-critical readings are fail-closed. If a strap value, document value, tachograph value, road-safety value or load-safety value cannot be read and verified, the router returns `SAFETY_CRITICAL_VALUE_CANNOT_BE_READ_SAFELY`. AGM AI and external AI are prohibited from filling or estimating the missing measurement.

## Capability and fallback matrix

| Operation | Primary | Fallback | Final safe state | Data transfer |
|---|---|---|---|---|
| STT | Android on-device recognizer | Android default recognition service, once | typed input | microphone audio may be processed by the user-selected Android recognition service |
| TTS | user-selected Android TTS engine, offline voice preferred | visible text | visible text | response text to the selected Android TTS engine |
| OCR | local Tesseract/WebView | none for safety-critical input | manual read/review | no automatic document/image transfer |
| Simple translation | verified local phrase/result | AGM translation API | original text | selected text only when AGM is required |
| Selected-text processing | local processor | AGM; Android `PROCESS_TEXT` only after confirmation | original text | confirmed selected text only |
| General reasoning | local result when one exists | AGM AI; external share only after confirmation | no generated answer | confirmed question only |
| AGM context reasoning | AGM AI | none | explicit unavailable state | allowlisted AGM context |
| Document analysis | local processing | AGM only after explicit document-transfer confirmation | manual review | never external device AI |
| Safety-critical reading | verified local result only | none | mandatory manual measurement | none |
| Car Mover action | AGM authority | none | no action | never external device AI |
| Open device assistant | Android `ACTION_ASSIST`, user initiated | none | hidden/unavailable | no AGM payload |
| Share context | Android chooser, user initiated | none | remain in AGM | exact previewed text only |

## Implemented behavior

- Native capability detection covers Android SDK, validated connectivity, camera, speech recognition, on-device speech recognition, TTS, Share, Process Text, Translate, Assist and voice settings.
- Capability snapshots are cached for five minutes and invalidated on connectivity changes and native resume.
- STT requests prefer `createOnDeviceSpeechRecognizer`. Android error 11/12/13 triggers exactly one fallback to the default recognition service; no loop is permitted.
- TTS no longer selects a Google package. It uses the user's default Android engine and prefers an installed, non-network voice.
- OCR remains local. An unusable OCR result is returned as uncertain and requires manual review; it is not rewritten or completed by AI.
- Known local translations execute before the AGM API. Unknown translations use AGM when online.
- Premium contextual reasoning remains routed through `POST /premium-assistant/respond`.
- External assistant/share actions retain route, scroll position and a non-sensitive draft in session storage; native resume restores the same AGM context.
- Execution and routing metrics record authority, execution mode, cache hit, capability lookup latency, execution latency, success and fallback use.

## Physical Android evidence

Device: Samsung SM-S931B (`RFCY70WDHXK`)
Android: 16 / SDK 36
App: `com.agm.cockpit`, version `1.3.0`, versionCode `21`
APK SHA-256: `92B358D70BB4BD86F5FAE16F40BD86133274E0B8D834ECEFE90847933738B56F`

Detected on the physical device:

- speech recognition: available;
- on-device speech recognition: available;
- TTS: available;
- camera: available;
- Share and Process Text: available;
- Translate intent: unavailable, therefore not presented as an available route;
- Assist and voice settings: available.

Physical results: **15/15 PASS**.

- On-device STT was selected in native runtime.
- The phone returned error 13 for the missing on-device `en-US` model.
- AGM immediately performed the single authorized fallback to the Android default recognition service, which reached `Speech recognizer ready`.
- TTS played completely through the user-selected Android engine and selected the local `en-us-x-iom-local` voice.
- External handoff returned to `/premium/copilot`, restored the exact draft `AGM contextual handoff draft`, and removed the pending handoff context.
- Sensitive external sharing and unverified safety-critical readings were rejected by the runtime router.

Canonical evidence: [Android report](./android/2026-08-28T21-16-35-515Z/report.json) and [physical screenshot](./android/2026-08-28T21-16-35-515Z/physical-android-runtime.png).

## Latency benchmark on Samsung

| Measurement | Result |
|---|---:|
| Capability lookup, cold | 15.8 ms |
| Capability lookup, cached | 0.2 ms |
| Local translation, 5-run average | 0.72 ms |
| AGM translation, real API round trip | 1008.5 ms |

The benchmark uses the physical WebView. The local case is a deterministic local translation result; the AGM case is a neutral text request to the configured AGM translation endpoint. No document, personal, Car Mover or runtime data was sent.

## Browser evidence

Controlled Chromium Desktop and Mobile: **2/2 PASS**.

- platform snapshot is `web`;
- local result routes remain local;
- AGM context routes remain AGM-owned;
- Android-only external routes and controls remain unavailable/hidden;
- safety-critical values fail closed;
- no horizontal overflow.

Browser gate:

- Browser Plugin Status: PASS;
- Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE;
- Browser Session Status: PASS (controlled Playwright/Chromium);
- Target Page Status: PASS.

Canonical evidence: [Browser report](./browser/2026-08-28T21-09-05-363Z/report.json).

## Commands and results

- `pnpm.cmd --filter @agm/web test:device-capability-router` — PASS, 12 operations.
- `pnpm.cmd --filter @agm/web exec tsc --noEmit` — PASS.
- `pnpm.cmd --filter @agm/web test:premium-assistant-ui` — PASS, 12/12 i18n.
- `pnpm.cmd --filter @agm/web test:premium-copilot-c0` — PASS.
- `pnpm.cmd --filter @agm/web test:premium-handsfree` — PASS, 12/12.
- `pnpm.cmd --filter @agm/web build` — PASS.
- Gradle `assembleDebug --offline` through the verified local Gradle 8.14.3 distribution — PASS.
- `node scripts/validate-device-capability-router-android.mjs` — PASS, 15/15 physical checks.
- `node scripts/validate-device-capability-router-browser.mjs` — PASS, Desktop + Mobile.

## Explicit non-actions and remaining release state

- No publication, deployment, commit or push was performed.
- No DNS, tunnel, connector, API routing or Production infrastructure was changed.
- No Android default assistant, TTS engine or device network setting was changed.
- No generic external-AI result round trip was invented because Android `ACTION_ASSIST` does not provide a standard result contract.
- Working tree is not clean because it contains the larger, previously authorized uncommitted work set: 99 tracked entries and 38 untracked entries at report time. The router work is validated but is not a release snapshot.

## Verdict

- DEVICE CAPABILITY ROUTER = PASS
- RUNTIME CAPABILITY DETECTION = PASS
- LOCAL → AGM → EXTERNAL POLICY = PASS
- AUTOMATIC FALLBACK = PASS
- PRIVACY / EXTERNAL CONFIRMATION = PASS
- SAFETY-CRITICAL NO-INVENTION POLICY = PASS
- CACHE = PASS
- PHYSICAL ANDROID = PASS
- BROWSER DESKTOP / MOBILE = PASS
- LATENCY BENCHMARK = PASS
- PUBLICATION = NOT EXECUTED
