# Premium Voice Production and mobile-data deployment — 2026-08-11

## Authorized scope

- Promote the authenticated, read-only Premium Voice assistant API.
- Build and install an Android APK using `https://api.agmcockpit.com/api/v1`.
- Validate Product Owner access and one real assistant response over mobile data.
- No Cloudflare, DNS, Basic, Fitness, Gmail, WhatsApp or database-schema change.

## Preflight and rollback

- Production preflight: `READY` (8/8 checks PASS).
- Previous API image: `sha256:7de033cfd5d9a800353f4a662960fbd9f648f7e7f2fb5ec5aae57f0379795f9e`.
- Previous revision: `premium-foundation-20260810-r3`.
- Rollback directory: `/opt/agm/production/rollback/AGM-CHG-20260811-PREMIUM-VOICE`.
- Fresh PostgreSQL custom dump created, `pg_restore --list` validated and SHA-256 recorded.
- Previous Compose file, systemd unit and container inspection retained.

## Candidate

- Revision: `premium-voice-20260811-r2`.
- Image: `sha256:50aae585a32b76d52ad786ecddb450b4c38bc1c8078b960b0aa9f0ad4f0ba383`.
- Candidate isolated on `127.0.0.1:3013`: ready PASS.
- `/api/v1/premium-assistant/respond` mapped; anonymous request denied with HTTP 401.
- Premium assistant tests: 3/3 PASS.
- AuthSession tests: 14/14 PASS.
- Web assistant client/UI and i18n 9/9 tests: PASS.

## Production deployment

- Lifecycle executed through `agm-production-api.service`.
- Container: running / healthy.
- Public live, ready and translation health: HTTP 200.
- Anonymous Premium Voice: HTTP 401.
- Refresh without cookie: HTTP 401.
- Production migrations: 8 found; schema up to date; no migration applied by this change.
- Production error scan after deployment: no ERROR/FATAL/Unhandled/Exception entries.

## Regression

- RO real OpenAI translation: PASS — `Încărcarea este gata.`
- DE real OpenAI translation: PASS — `Die Beladung ist bereit.`
- EN real OpenAI translation: PASS — `The loading is ready.`

## Android mobile-data validation

- Device: Samsung SM-S931B (`RFCY70WDHXK`).
- APK SHA-256: `F4B5A764F99E55F363E573ECAFC10FE03CAF0A9AFEC5D129FA0B4116F77F4B0A`.
- Embedded API: `https://api.agmcockpit.com/api/v1`.
- ADB reverse list: empty.
- Wi-Fi disabled during test; Vodafone LTE data registered and connected.
- Existing secure refresh session restored `/access` to `state=premium` without password.
- `Vorbește cu AGM` opened through the Premium module.
- Confirmed text sent over mobile data: `Care este următorul pas pentru documentul obligatoriu?`
- Real Production response displayed: `Pentru a vă putea ajuta corect, puteți specifica despre ce document obligatoriu este vorba?`
- Android force-stop/relaunch on LTE restored `state=premium`, status `Acces Premium valid.` and the active Premium link without login.
- Wi-Fi was restored after the mobile-data proof; no ADB reverse was restored.

## Verdicts

- PRODUCTION PREMIUM VOICE API — PASS
- PRODUCT OWNER MOBILE-DATA ACCESS — PASS
- AUTH SESSION FORCE-STOP/RELAUNCH — PASS
- PREMIUM VOICE REAL RESPONSE OVER LTE — PASS
- BASIC / TRANSLATOR REGRESSION — PASS
- ROLLBACK READINESS — PASS / NOT TRIGGERED
- NO CLOUDFLARE / DNS / SCHEMA / FITNESS / GMAIL / WHATSAPP CHANGE

