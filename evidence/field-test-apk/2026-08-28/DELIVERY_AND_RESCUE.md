# AGM Transporte — local field-test APK delivery

Date: 2026-08-28
Scope: local-LAN delivery only; no Production publication.

## Artifact

- File: `AGM-Transporte-1.3.0-field-test.apk`
- Source: current validated Android debug build
- Package: `com.agm.cockpit`
- Size: `119483941` bytes
- SHA-256: `E1C52905738261C0F31FC4BD0BABDA43EE11D365CD5BF60BFEFCAB4106738FAD`

## Delivery evidence

- Server binding: `0.0.0.0:8765`
- Landing page: `http://192.168.178.86:8765/`
- APK response: HTTP 200
- MIME: `application/vnd.android.package-archive`
- Content-Length: `119483941`
- Content-Disposition: attachment with the canonical APK filename
- Cache: disabled (`no-store`)

## Rescue journal

Classification: `DEFECT DE RUNTIME/SESIUNE` — the previously connected Samsung SM-S931B disappeared from ADB before the LAN browser probe.

1. `adb devices -l`: no devices.
2. `adb reconnect`: `no devices/emulators found`.
3. Safe ADB server restart attempted; final `adb devices -l`: no devices.
4. No product rebuild, dependency installation, firewall, DNS, tunnel, connector or Production change was attempted.

`RECOVERY EXHAUSTED` for the physical-device probe because the device is no longer physically present. The download service itself remains PASS through direct LAN HTTP evidence.

`HANDOFF TO ATLAS`: provide the LAN URL to authorized test phones on the same Wi-Fi; repeat only the phone download probe when a device is connected or available on the LAN.
