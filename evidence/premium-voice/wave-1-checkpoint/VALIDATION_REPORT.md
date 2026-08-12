# Premium Voice Wave 1 — validation checkpoint

Status: **PASS / FROZEN**  
Product Owner acceptance: 2026-08-12  
Physical device: Samsung SM-S931B (`RFCY70WDHXK`)

## Accepted behavior

- one explicit `ASCULTARE ON/OFF` control;
- hands-free `listen → STT → AGM → TTS → listen` loop;
- automatic return to listening after playback;
- read-only conversation without repetitive confirmation;
- workspace and multi-turn context retained;
- STT suspended during TTS;
- verified-contact boundary remains fail-closed;
- perceived conversation described by Product Owner as almost natural;
- response latency accepted as a future optimization opportunity.

## Frozen audio configuration

- custom endpoint timeout: `2300 ms`;
- Android complete-silence hint: `900 ms`;
- Android possibly-complete-silence hint: `650 ms`;
- partial STT results enabled;
- RMS voice activity threshold: `5.0 dB`;
- TTS rate: `1.08`;
- TTS pitch: `0.82`;
- preferred offline-capable Android voice selection retained.

## Technical validation

- Voice Session state-machine test: PASS;
- Premium Copilot C0 regression: PASS;
- verified-contact grounding 9/9: PASS;
- TypeScript: PASS;
- Web build: PASS;
- Android build: PASS;
- APK installation: PASS;
- physical Product Owner conversation: PASS.

No optimization or functional change is part of this checkpoint.
