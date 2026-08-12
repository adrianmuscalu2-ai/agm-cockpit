# AGM Premium Single Copilot — C0 Owner Review

Date: 2026-08-12

## Scope

C0 implements the approved single, voice-first Premium surface only. Car Mover remains frozen. No Production deployment or external Email/WhatsApp/Maps/phone action was introduced.

## Changes

- One visible Premium Copilot surface replaces the two-hub presentation behind `agm.premium.single-copilot.enabled`.
- Shared capability registry and deterministic intent routing are scoped to AGM Cockpit.
- Transcript remains editable and requires explicit confirmation before routing.
- Safety intent has precedence; an unsafe answer blocks normal continuation and is restored after refresh.
- Camera/OCR, location/Maps, phone and communication capabilities remain non-executing in C0.
- The prior Premium projection remains available through a nondestructive feature-flag rollback.
- Nine languages use one key set and one semantic contract.

## Validation

- Contract/i18n/safety/authority/rollback automated test: PASS.
- TypeScript: PASS.
- Web build: PASS.
- Controlled AGM Playwright/Chromium: PASS.
- Desktop scenarios: single surface, explicit confirmation, safety precedence, unsafe refresh recovery and feature-flag rollback: PASS.
- Android APK build: PASS.
- Samsung SM-S931B automated structural probe: PASS, but Product Owner physical usability test: FAIL. The real device showed an unusable oversized layout and a restored blocked test state. The previous Android PASS was withdrawn.

## Browser evidence

Latest complete runner report:

`evidence/premium-copilot/c0/desktop/2026-08-12T08-56-17-302Z/report.json`

Integrated Browser status: platform session-attachment limitation, optional/non-blocking. Controlled Chromium is the official evidence route.

## Verdict

- C0 implementation: PASS.
- Desktop browser gate: PASS.
- Android build gate: PASS.
- Android physical gate: FAIL / REMEDIATION IN PROGRESS.
- Overall: HOLD pending a new Product Owner usability test.

Android evidence:

`evidence/premium-copilot/c0/android/2026-08-12T09-35-01-817Z/report.json`

No C1–C3 functionality was started.
