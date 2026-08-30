# Physical Chrome voice recovery journal

- Activated: `2026-08-28T08:16:00+02:00`
- Classification: `PROCEDURE / PHYSICAL INPUT`
- Frozen evidence: Android physical PASS, controlled Browser Mobile PASS, public Chrome load/responsive PASS, current asset PASS, physical Chrome TTS cancel PASS
- Prohibited scope preserved: no product masking, no infrastructure changes, no Production publication

## Attempts

1. Chrome Android launched on Samsung SM-S931B and loaded `https://app.agmcockpit.com/basic` successfully.
2. Current local candidate was exposed only through temporary ADB reverse and loaded exact asset `main-1_AwOZin.js`.
3. Chrome RECORD_AUDIO permission was confirmed `allow / foreground`.
4. Old real Browser TTS was cancelled in `1 ms`; runtime entered `LISTENING` with queue flush `true`.
5. External synthetic speech and same-device WAV were both filtered before `speechstart`.
6. A 120-second human speech window was opened; no `speechstart` callback arrived.

## Result

`RECOVERY EXHAUSTED` for unattended speech input. A callback was not injected, simulated or promoted to PASS.

`HANDOFF TO ATLAS`: resume only the minimal physical Chrome speech probe with a person speaking directly into the phone. All unrelated PASS evidence remains frozen.
