# Android Production v26 physical evidence

The Production-signed `com.agm.cockpit` v26 artifact was installed as an in-place upgrade on the owner Samsung SM-S931B. Application data remained intact: `firstInstallTime` stayed `2026-08-31 01:37:10`, while `lastUpdateTime` advanced to `2026-09-15 06:23:26`.

## Result

- Secure AAB/APKS build: **PASS**.
- Production certificate fingerprint: **PASS**.
- DPAPI signing custody: **PASS** (`DPAPI_PROVISIONED`, 492-byte encrypted blob; secret not read or printed in evidence).
- Gmail deterministic no-result presentation on the physical app: **PASS**.
- User-visible answer: `Nu am găsit în Gmail niciun mesaj care să corespundă cererii tale.`
- Generic verified-contact refusal: **not observed**.
- User-visible sources, links, document identifiers, or inline citations: **not observed**.
- TTS start: **PASS** (`TTS→audio 827 ms`, `transcript→audio 1452 ms`).
- Force-stop/relaunch Premium session persistence: **PASS**; no PIN/login prompt was displayed.

The Production release build did not expose a WebView debugging socket. Following the Rescue principle `FAIL PE O CALE ≠ HOLD`, the affected physical test was completed through the real Android UI and accessibility hierarchy. No authentication/API mocks were used.

## Honest limitation

`Gmail → dispatcher address → navigation` remains unexecuted because the real mailbox has no matching dispatcher message containing an extractable destination. The application correctly avoided inventing an address or substituting an unrelated message.

Promotion of the local commits and the Production Guardian negative control still requires a new explicit push/deploy approval.
