# AGM Voice Barge-In — Physical Remediation Status

Date: 2026-08-28 (Europe/Berlin)

## Verdict

- VOICE RELEASE BLOCKER: **OPEN**
- ANDROID RUNTIME REMEDIATION: **PASS**
- ANDROID OWNER-OBSERVED AUDIBLE STOP: **PASS — confirmed by Product Owner 2026-08-28 10:16 +02:00**
- WEB MOBILE LOAD / RESPONSIVE / CACHE / ASSETS: **PASS**
- WEB MOBILE VOICE BARGE-IN: **FAIL / NO PHYSICAL STT RESULT**
- APP ASSET ISOLATION: **PASS**
- READY FOR PUBLICATION: **NO**
- PUBLICATION EXECUTED: **NO**

No DNS, tunnel, connector, API routing, Production configuration, commit, push, or publication action was performed.

## Superseded claim

The earlier Android PASS is withdrawn. The old implementation returned `queueFlushed=true` immediately after calling `TextToSpeech.stop()` and did not require the engine's real `UtteranceProgressListener.onStop` callback. That evidence was insufficient and contradicted the Product Owner's physical observation.

## Root causes

### Android voice

1. `TextToSpeech.stop()` acceptance was treated as proof that audible output had stopped.
2. TTS start, stop, `onInit`, and progress callbacks did not share one serialized Android main-thread authority.
3. A delayed TTS initialization/start callback was not protected by a native generation authority and could race cancellation.
4. Manual text entry only used the later `input` event; cancellation now also begins at `beforeinput`.

### APP / WEBSITE asset isolation

The icon generator used `agm-app-icon-dual-route-master.png` for website/Windows and Android launcher resources. This violated surface isolation and allowed website-oriented artwork to replace the approved Android APP launcher.

### Web Mobile

The first physical public-page runner used `networkidle`, which is invalid for the continuously active AGM page. The corrected runner uses `domcontentloaded`, reloads with the Chrome network cache disabled, and inspects the real public surface. The physical voice scenario still produced no STT result and therefore remains FAIL.

## Changes made

- Serialized native Android TTS authority on the main thread.
- Added monotonic native TTS generation invalidation before engine stop.
- Added stale `onInit` / start suppression.
- Added real `onStop(utteranceId, interrupted)` acknowledgement and latency logging.
- Added native stop acceptance/acknowledgement fields instead of inferring completion.
- Added `beforeinput` cancellation for the first new manual character.
- Restored all 15 Android launcher resources to the approved APP launcher (white AGM truck + blue globe).
- Split the icon generator into independent website/Windows and Android masters.
- Added an isolation contract preventing the website master from becoming Android authority again.
- Added physical public Chrome validation with cache-disabled reload and `domcontentloaded`.

## Current physical build

- Device: Samsung SM-S931B
- Serial: RFCY70WDHXK
- Android: 16 / SDK 36
- Package: `com.agm.cockpit`
- Version: 1.3.0 / versionCode 21
- APK SHA-256: `A38235AEEF6BC921AC8C20903AE02A7DD36721F28E716623B3AC444A9070B81D`
- Installed APK SHA-256: `A38235AEEF6BC921AC8C20903AE02A7DD36721F28E716623B3AC444A9070B81D`
- Install time: 2026-08-28 08:50:01 local

## Android physical runtime evidence

Report: `evidence/voice-barge-in/android/2026-08-28T07-00-42-850Z/report.json`

- Delayed stale model delivery suppressed: PASS
- Microphone authority cancelled active native TTS: PASS
- Native stop accepted: PASS
- Native `onStop(interrupted=true)` acknowledged: PASS
- Request → native stop acknowledgement: 3 ms
- New manual question → native stop acknowledgement: 5 ms
- Five rapid interruptions: PASS
- Maximum simultaneous active-turn authority: 1
- Obsolete rapid answers suppressed: 4/4
- Old audio restart callback observed: no

This is real device/engine evidence, but it does **not** replace the Product Owner's audible observation. The exact metric `NEW SPEECH DETECTED → OLD AUDIO STOPPED` remains PENDING because the post-fix physical STT run did not produce a new speech-detected event.

Closure update: the Product Owner subsequently repeated the physical Android check and returned `PASS`. Android audible barge-in is therefore accepted as PASS for the installed APK hash recorded above. The earlier PARTIAL label remains in the immutable machine report to accurately identify what that automated run itself measured.

## Web Mobile physical evidence

PASS report: `evidence/voice-barge-in/web-mobile-public-physical/2026-08-28T06-54-10-425Z/report.json`

- Physical browser: Chrome Android 151.0.7922.173
- Public target: `https://app.agmcockpit.com/`
- Final route: `https://app.agmcockpit.com/basic?physicalReview=2026-08-28T06-54-10-425Z`
- HTTP: 200
- Viewport / scroll width: 384 / 384
- Cache-disabled reload: yes
- Production main asset loaded: `main-r6bybWmM.js`
- Responsive overflow: none
- Public page left open on Samsung for owner review

Voice FAIL report: `evidence/voice-barge-in/web-mobile-physical/2026-08-28T06-55-22-007Z/report.json`

- Old browser TTS cancellation request: 1 ms
- Browser speech synthesis cancellation callback: observed
- Voice state reached LISTENING
- Physical STT result within 120 seconds: no
- WEB MOBILE VOICE BARGE-IN: FAIL

## Browser preflight

- Browser Plugin Status: PASS
- Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE
- Browser Session Status: PASS (controlled Chrome on physical Samsung through Android CDP)
- Target Page Status: PASS

## Tests executed

- `pnpm.cmd --filter @agm/web build` — PASS
- `pnpm.cmd --filter @agm/web android:apk` — Web/cap sync PASS; Gradle wrapper download blocked by sandbox
- `.\gradlew.bat assembleDebug` — PASS through approved Rescue recovery
- `pnpm.cmd --filter @agm/web test:premium-assistant-ui` — 12/12 PASS
- `pnpm.cmd --filter @agm/web test:premium-handsfree` — 12/12 PASS
- `pnpm.cmd --filter @agm/web test:premium-voice-session` — PASS
- `pnpm.cmd --filter @agm/web test:app-icons` — PASS
- `node scripts/validate-voice-barge-in-android.mjs` — PARTIAL (real native stop evidence; human speech gate not executed)
- `node scripts/validate-web-mobile-public-physical.mjs` — PASS
- `node scripts/validate-voice-barge-in-web-mobile-android-chrome.mjs` — FAIL (no physical STT result)

## Repository state

- HEAD: `dc8d793d45fe4108bf3f9b8eb833d8423cd27201`
- Working tree: intentionally dirty from the open i18n/agent and voice mandates
- Tracked modified: 88
- Untracked entries: 17
- Commit/push: not performed

## Required closure action

1. Product Owner repeats the audible Android interruption on the installed APK hash above and confirms that old audio stops immediately.
2. Run one successful human-speech cycle in physical Chrome so `speechDetected` and the subsequent current turn are recorded.
3. Only if both are real PASS may the voice release blocker be closed. Publication remains separately prohibited until a later mandate.
