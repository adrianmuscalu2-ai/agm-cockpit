# Device Capability Router — Rescue journal

Rule applied: `FAIL PE O CALE ≠ HOLD`.

| Time / run | Classification | Action and evidence | Result / next decision |
|---|---|---|---|
| 2026-08-28 22:56 CEST | Runtime/configuration | Project wrapper attempted a network download for Gradle 8.14.3 and was denied by the isolated session. | Did not install or retry unchanged. Verified the existing local distribution. |
| 2026-08-28 22:57 CEST | Runtime isolation | Direct local Gradle in sandbox could not see cached Android Gradle Plugin / Google Services artifacts. | Switched to the approved local-host route; no network download. |
| 2026-08-28 22:59 CEST | Recovery | Ran verified local Gradle 8.14.3 outside isolation with `--offline`. | `assembleDebug` PASS. HANDOFF TO ATLAS. |
| 2026-08-28 23:02 CEST | Session attachment | ADB reported no devices. Safe server restart in isolation did not attach. | Reattached through the authorized host ADB route; Samsung `RFCY70WDHXK` returned `device`. |
| Android run `21-04-35-739Z` | Harness | Production chunk exports were minified; runner called a non-exported long function name. | Corrected runner to the actual chunk exports. Product unchanged. |
| Android run `21-05-56-398Z` | Harness | All product checks passed; CDP full-page screenshot timed out. | Replaced only the evidence capture path with Android `screencap`. Product unchanged. |
| Android run `21-07-32-288Z` | Product/runtime | Physical on-device STT selected, then Android returned error 13 for unavailable `en-US` local model. Existing plugin rejected instead of falling back. | Added a one-shot fallback to the Android default recognition service for errors 11/12/13. |
| 2026-08-28 23:12 CEST | Minimal retest | Rebuilt through verified offline Gradle, installed APK SHA-256 `92B358...B56F`, ran physical test. | Fallback log proved: on-device → error 13 → default service → ready. PASS. |
| Android run `21-14-45-273Z` | Harness/governance | Controlled entitlement fixture used an invalid policy version; the application's guard correctly denied Premium. | Corrected fixture to `access-entitlements@1.0.0`; no product guard change. |
| Android run `21-16-35-515Z` | Final minimal retest | Physical router, fallback, TTS, privacy gates, cache, benchmark and real assistant return/draft restoration. | 15/15 PASS. RECOVERED. HANDOFF TO ATLAS. |

Preserved PASS evidence: Web build, TypeScript, router contract, Premium assistant UI, Copilot C0 and hands-free tests were not reopened after unrelated runner-only corrections.
