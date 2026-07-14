# AG-018 Stable Restoration

Date: 2026-07-14

## References

- Restored runtime checkpoint: `24fa84b` (`AG-020: establish stable Android foundation v0.5.0`)
- Preserved regression work: branch `ag-018-regression-backup-20260714`, commit `e3117d4`
- Restoration branch: `ag-018-stable-restoration`

No performance optimization was copied into the restoration branch. After restoration, one isolated P0 fix was applied to keep the first-run legal acceptance action reachable inside the Android safe area.

## Confirmed causes and findings

- The tested APK uses `http://192.168.178.86:3000/api/v1`; translation is unavailable whenever the API process is not running or the phone cannot reach that LAN address.
- The reported translation outage was reproduced with no listener on port 3000. With the stable API running and the OpenAI key loaded, both translation directions succeeded.
- The post-stable performance/UI/audio experiments are preserved only on the backup branch and are absent from this restored runtime.
- Mobile-data operation is not available in this checkpoint because a private LAN address is not publicly routable. A deployed public HTTPS API remains mandatory.

## Executed validation

| Test | Result |
| --- | --- |
| Web TypeScript/Vite production build | Passed |
| API Nest build | Passed |
| API Jest suite | Not available: repository contains no Jest tests |
| Real API RO -> DE: `când vine luna` | Passed: `wann der Mond kommt`, OpenAI, 3393 ms |
| Real API DE -> RO: `Wann kommt der Mond?` | Passed: `Când vine luna?`, OpenAI, 3773 ms |
| Capacitor Android sync | Passed |
| Android Gradle `assembleDebug` | Passed |
| Physical-device dictation and TTS | Pending user validation |
| Wi-Fi end-to-end APK | Pending user validation with API kept running |
| Mobile-data end-to-end APK | Blocked: no public HTTPS API exists |

## Device validation update

On 2026-07-14, physical-device testing confirmed that dictation captures the user's voice, dictated and typed text is recognized correctly, and translation returns the expected target-language result. The platform is accepted into extended stability testing with functionality frozen.

AG-018 remains under extended observation across additional devices and real Wi-Fi usage. Mobile-data validation requires a separate public HTTPS backend deployment and cannot be claimed for the LAN build.
