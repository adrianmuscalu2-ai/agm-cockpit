# AGM Transporte — Android display-name integration

Timestamp: 2026-08-28T10:57:49+02:00
Device: Samsung SM-S931B (`RFCY70WDHXK`), Android 16
Scope: display/install name only; internal A.G.M. Cockpit identity preserved.

## Identity contract

- Android/PWA display name: `AGM Transporte`
- Android package ID: `com.agm.cockpit` (unchanged)
- Version: `1.3.0` / code `21` (unchanged)
- Internal product version label: `A.G.M. Cockpit 1.3.0` (unchanged)
- About relationship: `A.G.M. Cockpit — parte din ecosistemul AGM Transporte.`
- TURN, API routing, DNS, tunnels, connectors and Production: unchanged.

## Verification

- `pnpm.cmd --filter @agm/web test:app-icons`: PASS
- `pnpm.cmd --filter @agm/web android:apk`: Web build and Capacitor sync PASS; Gradle wrapper was blocked by sandbox network policy.
- Rescue classification: `DEFECT DE RUNTIME/SESIUNE`; no dependency installation performed.
- Minimal recovery: `.\gradlew.bat assembleDebug`: PASS (`BUILD SUCCESSFUL`).
- APK SHA-256: `E1C52905738261C0F31FC4BD0BABDA43EE11D365CD5BF60BFEFCAB4106738FAD`
- APK badging: package `com.agm.cockpit`; application and launcher label `AGM Transporte`.
- `adb -s RFCY70WDHXK install -r ...\app-debug.apk`: PASS (`Success`).
- Installed base APK SHA-256: `e1c52905738261c0f31fc4bd0babda43ee11d365cd5bf60bfefcab4106738fad` (exact match).
- Installed version: `1.3.0` / code `21`; last update `2026-08-28 10:56:56`.
- Runtime launch: `com.agm.cockpit/.MainActivity` is `topResumedActivity`.

## Rescue handoff

`RECOVERED` — only the affected Gradle step was repeated. Previously accepted Web build, naming-contract and visual evidence remained frozen. No code change was made to mask the sandbox failure.

`HANDOFF TO ATLAS` — Android integration is complete; no residual blocker for the approved naming change. Repository commit/push/publication remain outside this mandate.
