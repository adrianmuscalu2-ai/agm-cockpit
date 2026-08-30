# Final Android AI + Voice release gate

> **REVOKED / SUPERSEDED — 2026-08-29.** The owner reproduced a physical-device failure after this automated PASS: the microphone blinked indefinitely and stopped only through Cancel. The frozen APK hash below is not the current candidate. See `PHYSICAL_FAIL_REMEDIATION_REPORT.md` and the replacement physical report under `evidence/voice-barge-in/android/2026-08-28T23-34-57-849Z/`.

Date: 2026-08-29 (Europe/Berlin)
Publication: **NOT EXECUTED**
Gate verdict: **PASS**

## Exact release candidate

- Package: `com.agm.cockpit`
- Version: `1.3.0`
- versionCode: `21`
- APK: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`
- Local SHA-256: `92B358D70BB4BD86F5FAE16F40BD86133274E0B8D834ECEFE90847933738B56F`
- Installed SHA-256: `92B358D70BB4BD86F5FAE16F40BD86133274E0B8D834ECEFE90847933738B56F`
- Exact match: **PASS**
- Physical device: Samsung SM-S931B, serial `RFCY70WDHXK`

The APK was not rebuilt between the Device Capability Router validation and this final Voice gate.

## Frozen Android AI / Router evidence

The same APK hash previously passed:

- runtime capability detection and five-minute cache;
- `LOCAL DEVICE → AGM AI → EXTERNAL DEVICE AI` policy;
- one-shot STT fallback from unavailable on-device language model to the Android default recognition service;
- explicit external handoff confirmation;
- sensitive document / Car Mover external-transfer block;
- fail-closed safety-critical readings;
- route and draft restoration after Android assistant handoff.

Canonical Router evidence: [Device Capability Router Android report](../device-capability-router/android/2026-08-28T21-16-35-515Z/report.json).

## Physical Voice gate results

All 7 physical runtime scenarios passed:

1. A deliberately delayed old model answer arrived after cancellation and was marked stale; it did not enter history, UI or TTS.
2. Microphone authority cancelled active native TTS. Full cancellation completed in 25 ms; native stop acknowledgement took 2 ms; audio queue flush was confirmed.
3. A new manual question cancelled the active STT cycle.
4. A new text question cancelled active native TTS; native stop acknowledgement took 4 ms.
5. Five rapid interruptions left only answer 5 active; answers 1–4 were suppressed.
6. Old audio did not restart after cancellation.
7. Device Capability Router added no material voice latency: maximum cached capability lookup was 0.1 ms against the 2 ms budget; routing decision latency was 0–0.1 ms.

Authority evidence:

- maximum simultaneous active voice turns: `1`;
- active voice turns at completion: `1` (the newest turn);
- delayed stale deliveries observed: `5`;
- obsolete rapid answers suppressed: `4/4`;
- audio queue flushed: `true`;
- old audio restarted: `false`.

Canonical Voice evidence:

- [Machine-readable report](../voice-barge-in/android/2026-08-28T22-32-19-721Z/report.json)
- [Native Android runtime log](../voice-barge-in/android/2026-08-28T22-32-19-721Z/runtime-logcat.txt)
- [Stale model suppression](../voice-barge-in/android/2026-08-28T22-32-19-721Z/01-stale-model-suppressed.png)
- [Native TTS barge-in](../voice-barge-in/android/2026-08-28T22-32-19-721Z/02-native-tts-barge-in.png)
- [Five rapid interruptions / final authority](../voice-barge-in/android/2026-08-28T22-32-19-721Z/05-rapid-final-authority.png)

## Final verdict

- ANDROID AI EFFICIENCY = PASS
- DEVICE CAPABILITY ROUTER = PASS
- LOCAL → AGM → EXTERNAL ROUTING = PASS
- CAPABILITY DETECTION + CACHE = PASS
- STT AUTOMATIC FALLBACK = PASS
- PRIVACY GATES / NO SENSITIVE AUTO-TRANSFER = PASS
- PAGE / ROUTE / DRAFT RESTORATION = PASS
- VOICE TURN CANCELLATION = PASS
- OLD TTS STOP = PASS
- AUDIO QUEUE FLUSH = PASS
- NO STALE TTS / RESPONSE = PASS
- SINGLE ACTIVE TURN = PASS
- DEVICE ROUTER VOICE LATENCY = PASS
- PHYSICAL ANDROID = PASS
- SAME RELEASE CANDIDATE = PASS

The candidate is ready for the owner's separate publication authorization. No publication, commit or push was executed by this gate.
