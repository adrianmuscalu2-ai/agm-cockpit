# AGM Assistant + Gmail — Production session renewal

Date: 2026-09-13 (Europe/Berlin)
Canonical branch: `agm-canonical-20260820`
Canonical revision under test: `5293e056173a046f947a9dc61316b929f3d843a8`

## Production TTLs

| Credential/session | Effective TTL | Renewal behavior |
|---|---:|---|
| AGM access JWT | 1 hour | Reissued automatically from the valid HttpOnly refresh cookie. |
| AGM refresh session | 30 days absolute from login | Refresh token rotates on every successful refresh; the family keeps the original absolute expiry and is not extended past day 30. |
| Gmail OAuth access token | 3,599 seconds observed from the live Google token endpoint | API refreshes proactively when less than 60 seconds remain; an unexpected Gmail 401 clears the cache, refreshes, and retries once. |
| Gmail OAuth refresh token | No client-side TTL declared | Stored server-side as the protected Production secret; remains available across application, container, and phone restarts unless Google revokes/invalidates it or the Production secret is replaced/removed. |

Production explicitly configures `JWT_EXPIRES_IN=1h`. The AGM refresh cookie is `HttpOnly`, `Secure`, `SameSite=None`, scoped to `/api/v1/auth`, and has a 30-day Max-Age. The database stores only the SHA-256 hash of each AGM refresh token.

## Automatic renewal path

1. The short AGM bearer exists only in WebView `sessionStorage` and is intentionally not persisted in `localStorage`.
2. The long-lived AGM refresh credential is a secure HttpOnly cookie in the Android WebView cookie store.
3. At relaunch, if the bearer is absent, the app calls `POST /api/v1/auth/refresh`, stores the new one-hour bearer in `sessionStorage`, and verifies entitlements.
4. If the app stays open until the bearer expires, the first Assistant request receives 401, performs the same refresh, accepts the rotated cookie, stores the new bearer, and retries the original request once.
5. Concurrent refresh races are single-flighted in the Assistant client. The server's `409 SESSION_REFRESH_IN_PROGRESS` concurrency signal is retried up to three times with bounded backoff.
6. A terminal refresh 401/403 clears the short local bearer and requires a normal user login. Transient network/server failures do not revoke the server refresh family.
7. Gmail credentials never pass through Android. The API caches the Gmail access token in process memory and uses the protected server-side Gmail refresh token to renew it.

## Expected behavior by scenario

| Scenario | Production behavior | Manual authentication |
|---|---|---|
| Close and reopen app | `sessionStorage` bearer is recreated from the persistent HttpOnly refresh cookie during startup. | No, while the 30-day AGM refresh family is valid. |
| Force-stop and relaunch | Same startup restore path; WebView app data/cookies are preserved. | No, while the refresh family is valid. |
| Phone restart and relaunch | Android preserves application data and the WebView cookie store; startup restores a new bearer. | No, while the refresh family is valid and app data was not cleared. |
| Several hours idle, process removed | Relaunch executes startup refresh. | No. |
| Several hours idle, app remains open | First protected Assistant call refreshes after the expired one-hour JWT and retries automatically. | No. |
| Gmail access token expires | API obtains a new token from Google using the Production refresh token; no Android action is involved. | No. |
| AGM access JWT expires | Client refreshes via the HttpOnly cookie and retries. | No. |
| AGM 30-day refresh session expires | Server legitimately rejects refresh because the absolute security lifetime ended. | Yes: normal AGM email/password login. |

## When manual credentials are required

Normal AGM Assistant/Gmail use does **not** use the Turn administrator PIN. The PIN protects the separate Turn Command Center administrative session.

The normal AGM login is required only when one of these conditions applies:

- the 30-day AGM refresh-session absolute expiry is reached;
- the user explicitly logs out;
- application data/cookies are cleared, the app is uninstalled, or the secure cookie is otherwise removed;
- the refresh family is revoked or refresh-token reuse is detected outside the five-second concurrency grace;
- the user is no longer `Active`, or required Premium entitlement is removed;
- a security or account policy revokes the session.

Google consent/login is required again only when the server-side Gmail refresh token is revoked or invalidated by Google, the Google account/app authorization changes incompatibly, or the Production secret is removed/replaced with an invalid value. Expiration of the normal 3,599-second Gmail access token does not require Google login.

## Validation evidence

- Production revision label: `5293e056173a046f947a9dc61316b929f3d843a8`.
- Production public live health: HTTP 200 after deploy.
- Live Google initial refresh: HTTP 200.
- Live Gmail call with initial token: HTTP 200.
- Google-reported access-token TTL: 3,599 seconds.
- Real Gmail expiry probe: PASS. The live Google token was issued at `2026-09-13T12:19:36.577Z` with `expires_in=3599`. After the full 3,674-second wait, the old token received Gmail 401 at `2026-09-13T13:20:52.375Z`; the server-side refresh returned 200, produced a different access token, and the retried Gmail call returned 200. No grace wait was needed; no token, secret, or message content was printed.
- Controlled Production AGM real-expiry test: PASS. A real 20-second JWT was accepted before expiry; after a 22-second wait, the Assistant request received 401, `POST /auth/refresh` returned 201, the bearer changed, and the original Gmail request retried successfully with 201.
- Controlled Production result after refresh: 621-character natural answer, zero source UI elements, logout/temporary-session cleanup 201; no answer text, token, secret, or mailbox content was printed.
- Controlled Production relaunch test: PASS in two consecutive cycles. Each cycle started with empty `sessionStorage`, retained the HttpOnly cookie, received refresh 201 and entitlements 200, and restored Premium access; cleanup logout returned 201.
- Browser Plugin Status: PASS.
- Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE (`SESSION_ATTACHMENT_MISSING`).
- Browser Session Status: PASS — controlled AGM Playwright/Chromium runner.
- Target Page Status: PASS — `https://app.agmcockpit.com/` against Production API revision `5293e05`.
- Client automatic-renewal unit/contract tests: PASS.
- Web TypeScript/build and speech-semantics suite: PASS.
- Production continuity retest workflow `34757957772`: PASS (health, accountability renewal, and post-renewal operational truth). The earlier release validation exit 35 was a single transient connection reset after its lifecycle snapshots had already passed.
- Signed Android release upgrade: PASS. Version `1.4.0` / code `22` was installed in-place without clearing app data. APK SHA-256: `b7e839e184fa3daf8abfd49207f02ffeac5b8b8f926b542f1d52251255f5413a`; v2/v3 signature and Production certificate verified.
- Physical Android force-stop/relaunch: PASS. AGM reopened with Premium/Assistant navigation available, no authentication prompt, and no Assistant-unavailable state. The real query `Rezuma ultimele trei emailuri` produced one successful Assistant HTTP result, zero Assistant failures, active TTS engine events, and no source/link artifacts in the sanitized UI inspection. Mailbox text was not printed or retained as evidence.
- Physical phone restart: PASS. The device completed a real OS reboot; after the required Android post-boot device unlock and USB-debugging reauthorization, AGM was relaunched as the focused application. Sanitized OCR confirmed AGM Premium Assistant/Voice navigation, no authentication prompt, no Assistant-unavailable state, and no visible source artifacts. The post-boot transcript was empty, proving the prior mailbox query was not retained in the UI.

## Verdict

`NORMAL USE REQUIRES FREQUENT REAUTHENTICATION = NO`

`SESSION + GMAIL TOKEN AUTO-RENEWAL = PASS`
