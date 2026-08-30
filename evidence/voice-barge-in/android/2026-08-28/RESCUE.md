# Android physical barge-in rescue journal

- Activated: `2026-08-28T07:34:00+02:00`
- Classification: `DEFECT DE RUNTIME/SESIUNE`
- Affected gate: physical Samsung SM-S931B runtime barge-in validation only
- Authorized serial: `RFCY70WDHXK`
- Frozen PASS evidence: targeted voice tests, Web build, controlled Browser Desktop/Mobile runtime, Android Java compile and local APK assembly
- Prohibited scope preserved: no publication, Production, DNS, tunnel, connector, API routing, infrastructure, driver installation or speculative dependency changes

## Evidence and recovery attempts

1. The verified Android SDK ADB binary exists at `C:\Users\adria\AppData\Local\Android\Sdk\platform-tools\adb.exe`.
2. Initial `adb devices -l` returned an empty device list; `adb -s RFCY70WDHXK get-state` returned `device not found`.
3. The existing ADB daemon was stopped and restarted once. The post-restart `adb devices -l` list remained empty.
4. Read-only Windows PnP inventory, executed outside the restricted sandbox, returned no Samsung, Android, ADB or SM-S931B device.
5. `adb mdns services` returned no discovered wireless-debugging service.
6. `adb reconnect` returned `no devices/emulators found`.
7. No driver or software installation was attempted: ADB is present and operational, so this is not a missing dependency.

## Prepared minimal retest artifact

- APK: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`
- SHA-256: `C40CA6D795B62A3DF469ED35FA95E8ABEA87B5983C44CDB33CA26F69BA63CA48`
- Gradle task: `:app:assembleDebug` — PASS
- Java task: `:app:compileDebugJavaWithJavac` — PASS

## Result

`RECOVERY EXHAUSTED` for the current host state. The required real Android barge-in scenario cannot be executed until the authorized physical phone is attached and visible to ADB.

`HANDOFF TO ATLAS` — preserve all Browser and build PASS evidence. Resume only the minimal Samsung install/launch/live barge-in measurement after `RFCY70WDHXK` appears in `adb devices -l`.
