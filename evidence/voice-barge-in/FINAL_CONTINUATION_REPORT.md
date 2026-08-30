# AGM voice barge-in — Android physical and Web mobile continuation

Generated: `2026-08-28T08:18:00+02:00`

## Outcome

The Android physical blocker is closed with runtime PASS on Samsung SM-S931B. The public website loads and renders responsively in the phone's real Chrome browser. The remaining release blocker is the final real-Chrome speech callback: Chrome stopped old TTS immediately and entered LISTENING, but did not emit `speechstart` for synthetic audio, and no human speech was detected during the controlled 120-second window. The controlled Browser Mobile runner remains PASS, but it is not promoted to the explicitly requested physical-Chrome speech PASS.

## Installed Android build

- Device: `Samsung SM-S931B`
- Serial: `RFCY70WDHXK`
- Android: `16` / API `36`
- Package: `com.agm.cockpit`
- Version: `1.3.0` / versionCode `21`
- Update timestamp: `2026-08-28 07:53:04`
- APK and installed base.apk SHA-256: `C40CA6D795B62A3DF469ED35FA95E8ABEA87B5983C44CDB33CA26F69BA63CA48`
- Local hash equals installed package hash: `PASS`

## Android physical runtime

Evidence: `evidence/voice-barge-in/android/2026-08-28T06-08-07-454Z/report.json`

- interrupt while native TTS speaks: `PASS`
- new question while model generates: `PASS`
- new question immediately after real STT: `PASS`
- five rapid interruptions: `PASS`
- delayed response delivered after cancellation: `PASS`, suppressed
- old audio does not return: `PASS`
- maximum active authority count: `1`
- audio queue flush receipt: `true`
- real STT transcript: `hello there`
- `NEW SPEECH DETECTED -> OLD AUDIO STOPPED`: `0 ms`

The native log proves the sequence `TTS playback started -> TTS playback stopped -> speech recognizer ready -> speech detected -> speech recognition result`.

## Web mobile on physical Chrome

Evidence: `evidence/voice-barge-in/web-mobile-physical/2026-08-28T06-15-53-708Z/report.json`

- Browser: Chrome Android on the same Samsung device
- Public canonical URL: `https://app.agmcockpit.com/basic`
- Public page HTTP/navigation and content load: `PASS`
- Physical viewport: `384 px`
- Document scroll width: `384 px`
- Horizontal overflow: `0 px`
- visual responsive inspection: `PASS`
- current local candidate asset expected and loaded before voice probe: `main-1_AwOZin.js`
- public deployed asset observed: `main-r6bybWmM.js`
- old APK/cache on the installed app: `ABSENT`, hash equality proved
- current local Web candidate cache mismatch: `ABSENT`, exact asset assertion passed
- old Browser TTS cancel at microphone initiation: `PASS`, `1 ms`
- audio queue flushed: `true`
- Chrome microphone app-op: `allow / foreground`
- Chrome entered `LISTENING`: `PASS`
- Chrome real `speechstart` during final human window: `FAIL / NO EVENT`

The public/candidate asset difference is expected because publication was explicitly prohibited. No Production mutation was performed.

## Recovery journal for physical Chrome speech

1. Confirmed Chrome DevTools runtime, real page, microphone API, Web Speech API and Android RECORD_AUDIO permission.
2. Confirmed current build, responsive layout and real TTS playback/cancel.
3. Tried external host synthetic speech; Chrome emitted no `speechstart`.
4. Tried same-device WAV playback; Chrome echo cancellation suppressed it.
5. Opened a 120-second real-human-speech window; no Chrome speech callback was received.
6. Did not inject or fabricate a SpeechRecognition callback and did not alter the product to force green evidence.

`RECOVERY EXHAUSTED` for unattended physical Chrome speech input. Minimal next action: rerun only the physical Chrome voice probe while a person speaks `hello there` directly into the phone after LISTENING appears.

## Verdict

- OLD TURN CANCEL = `PASS`
- OLD TTS STOP = `PASS`
- AUDIO QUEUE FLUSH = `PASS`
- STALE RESPONSE SUPPRESSION = `PASS`
- SINGLE ACTIVE TURN = `PASS`
- RAPID INTERRUPTION TEST = `PASS`
- ANDROID BARGE-IN = `PASS`
- BROWSER CONTROLLED MOBILE BARGE-IN = `PASS`
- WEB MOBILE LOAD = `PASS`
- MOBILE RESPONSIVE UI = `PASS`
- NO OLD CACHE / OLD BUILD = `PASS` for installed APK and local candidate
- MOBILE VOICE BARGE-IN IN PHYSICAL CHROME = `FAIL / SPEECH EVENT NOT OBSERVED`
- VOICE RELEASE BLOCKER = `OPEN`
- ANDROID = `PASS`
- WEB MOBILE = `FAIL` only on the physical-Chrome speech gate
- READY FOR FINAL PUBLICATION MANDATE = `NO`
- PUBLICATION = `NOT EXECUTED`
