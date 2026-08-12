# Android Translator Wave 1 — Production deployment validation

Date: 2026-08-08 (Europe/Berlin)  
Device: Samsung SM-S931B (`RFCY70WDHXK`)  
Application: `com.agm.cockpit`, version `1.3.0`, versionCode `16`  
Production APK SHA-256: `08B4C32401EE2B70EC2ADA7EAF35BE5D98BFEFF2DB925F4D6A6D883434DF0A49`  
Input: `The vehicle is ready for pickup tomorrow at 09:00.`

## Root cause and correction

1. The `translatorTargetLanguage` More-languages handler was registered in
   `bindEmailAssistant()` instead of `bindTranslator()`. The handler now belongs
   to the Translator route and is protected by a regression assertion.
2. Production used a three-language DTO/provider contract. A scoped image was
   derived from the exact active image and changed only the translation DTO
   list and provider language-name map for `fr/nl/ru/pl/tr/sq`.
3. The Android helper was extended to exercise language selection, source input,
   real translation, rendered result/status, Email Assistant, and screenshots.

## Production deployment

- Preflight: `READY` at `2026-08-08T20:37:28.8005688Z`.
- Previous image: `sha256:c232624416236ede00aa992369e8c519668694399fff1d9266de19da0db4d43c`.
- Active image: `sha256:f781a66a0f2cf17c4360e0274ca124bf9a8a12e95d02bdeacfb81edd96933808`.
- Revision label: `translator-wave1-1c3eeaf`.
- Activation: `2026-08-08T20:45:13Z`.
- Rollback backup stamp: `20260808T204513Z`.
- Cloudflare/DNS: unchanged.
- Database/schema: unchanged; five migrations complete and schema up to date.
- Service: active/enabled; API container healthy on `127.0.0.1:3000`.
- Post-deployment log scan: no critical/fatal/unhandled/migration-failure matches.

## Public Production API matrix

All calls used `https://api.agmcockpit.com/api/v1` and returned HTTP 201,
`available=true`, provider `openai`, and non-empty real output.

| Target | Production result | Status |
|---|---|---|
| RO | Vehiculul este gata pentru preluare mâine la ora 09:00. | PASS |
| DE | Das Fahrzeug ist morgen um 09:00 Uhr zur Abholung bereit. | PASS |
| EN | The vehicle is ready for pickup tomorrow at 09:00. | PASS |
| FR | Le véhicule est prêt pour le ramassage demain à 09:00. | PASS |
| NL | Het voertuig is morgen om 09:00 uur klaar voor ophalen. | PASS |
| RU | Автомобиль готов к вывозу завтра в 09:00. | PASS |
| PL | Pojazd jest gotowy do odbioru jutro o godzinie 09:00. | PASS |
| TR | Araç yarın saat 09:00'da teslim alınmaya hazır. | PASS |
| SQ | Mjeti është gati për marrje nesër në orën 09:00. | PASS |

## Physical Android Production matrix

Every row was produced by the installed Production-endpoint APK on the Samsung
device. Each status confirmed provider `agm-api`. Screenshots show the rendered
result and are named `production-<language>.png` in this directory.

| Target | Android result | Status |
|---|---|---|
| RO | Vehiculul este gata pentru preluare mâine la ora 09:00. | PASS |
| DE | Das Fahrzeug ist morgen um 09:00 Uhr zur Abholung bereit. | PASS |
| EN | The vehicle is ready for pickup tomorrow at 09:00. | PASS |
| FR | Le véhicule est prêt pour le ramassage demain à 09h00. | PASS |
| NL | Het voertuig is morgen om 09:00 uur klaar voor ophalen. | PASS |
| RU | Транспортное средство готово к вывозу завтра в 09:00. | PASS |
| PL | Pojazd jest gotowy do odbioru jutro o godzinie 09:00. | PASS |
| TR | Araç yarın saat 09:00'da teslim alınmaya hazır. | PASS |
| SQ | Mjeti është gati për marrje nesër në orën 09:00. | PASS |

## Regression

- Translator RO/DE/EN: PASS.
- Translator FR/NL/RU/PL/TR/SQ: PASS.
- Email Assistant DE translation through `agm-api`: PASS.
- Email Assistant FR selection and translation through `agm-api`: PASS.
- Basic multilingual contract test: PASS.
- API provider test: 5/5 PASS.
- Web build, Capacitor sync, Gradle build, APK install: PASS.

## Browser preflight

- Browser Plugin Status: PASS.
- Integrated Browser Control Status: FAIL — browser runtime discovery returned
  no available integrated browser after the prescribed recovery check.
- Browser Session Status: PASS — fresh isolated AGM Playwright/Chromium session.
- Target Page Status: PASS — `http://127.0.0.1:59532/` rendered and navigated.
- Probe: unattended Wave 1 run `2026-08-08T21-06-26-088Z`, PASS.

## Verdict

`PRODUCTION API 9/9 — PASS`  
`APK PRODUCTION / SAMSUNG 9/9 — PASS`  
`TRANSLATOR + EMAIL REGRESSION — PASS`

The functional Android Translator closure conditions are satisfied. The AGM
stable-version gate remains `HOLD` only because the mandatory four-field Browser
preflight requires Integrated Browser Control Status to be PASS, and that
mechanism is currently unavailable. The unattended browser runner itself is
PASS and does not replace the missing integrated field under the active runbook.
