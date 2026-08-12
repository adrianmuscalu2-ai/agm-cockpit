# AGM Car Mover P0-02 — Owner Review

Date: 2026-08-12  
Status: **HOLD / ANDROID BUNDLE ORIGIN COLLISION**

## Changes

- Added isolated `/car-mover` route and `carMover` view.
- Added Android-first manual intake for all six approved vehicle classes.
- Added authenticated API client; company/tenant identifiers are never supplied by the browser.
- Added tenant/product-scoped Job list, lifecycle controls and read-only Job File/timeline.
- Added a separate `car-mover.jobs` capability requiring both Premium and Car Mover entitlement.
- Added complete shared-key i18n dictionaries for RO/DE/EN/FR/NL/RU/PL/TR/SQ.
- Added controlled Chromium runner with screenshots and machine-readable report.

## Validation

- P0-02 route/UI/i18n/auth contract: PASS.
- i18n dictionaries: 9/9 PASS.
- Web TypeScript: PASS.
- Web production build: PASS.
- API Car Mover + entitlement tests: PASS.
- API build: PASS.
- Controlled Chromium:
  - passenger car + tractor unit, same list: PASS;
  - Job File + timeline: PASS;
  - Android-first viewport 412x915: PASS.
- Browser preflight:
  - Browser Plugin Status: PASS;
  - Integrated Browser Control: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE;
  - Browser Session Status: PASS through Controlled AGM Chromium;
  - Target Page Status: PASS (`http://127.0.0.1:5174/car-mover`).

Evidence: `evidence/car-mover/p0-02/desktop/2026-08-12T05-37-00-431Z/report.json` and associated screenshots.

## Android result and blocker

- Official Gradle dependencies downloaded after explicit Product Owner authorization.
- Android build: PASS.
- APK SHA-256: `63B963B331A335C01796517A06DAB0A7FF225C5688ECAC63F46E0BE5ECBA5A4A`.
- Installation on Samsung SM-S931B: PASS.
- Package launch: PASS (`com.agm.cockpit/.MainActivity`).
- Car Mover route validation: FAIL before product interaction.
- Root cause: Capacitor assigns the WebView origin `https://app.agmcockpit.com`. The existing Production Service Worker controls that same origin and serves the older public bundle, overriding the newly packaged local assets. `/car-mover` therefore resolves through the old shell/access boundary rather than the APK bundle.
- Clear-data and reinstall were executed once; the collision reproduced. Controlled retries were stopped.
- No Production deployment or Service Worker change was authorized or performed.
- No Android functional PASS is claimed.

## Excluded and unchanged

- No Onlogist/MOCCA/platform integration.
- No Voice, Gmail or WhatsApp Car Mover.
- No invoicing, costs, payments, full handover protocol or automation.
- No Production deployment.

## Current verdict

**P0-02 — HOLD / ANDROID BUNDLE ORIGIN ISOLATION REQUIRED**

Minimal remediation required: give packaged Android assets an origin/cache namespace that cannot be controlled by the public website Service Worker, preserve public API access separately, rebuild the APK and repeat only the Android route/intake/Job File atomic validation. This is an Android packaging/runtime fix, not a Car Mover domain change.
