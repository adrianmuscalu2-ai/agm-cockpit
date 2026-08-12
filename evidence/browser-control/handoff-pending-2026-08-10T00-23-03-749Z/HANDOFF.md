# Rescue Browser handoff

Created: 2026-08-10T00:23:03.755Z

Route: VS CODE BLOCKED → RESCUE → CODEX DESKTOP iab → PROBĂ MINIMĂ → HANDOFF → ÎNCHIDERE

- Website: https://app.agmcockpit.com/
- Cockpit: http://127.0.0.1:5174/
- Email: http://127.0.0.1:5174/email
- Fitness: http://127.0.0.1:5173/ — RESERVED / DO NOT TOUCH
- Visual signature: 254D0FB63EC50013CCD6E70FAA92C1D531852FE9D81CF430E7FF59DFEAEFEF56
- AGM PRODUCT: PASS / FROZEN

Desktop: select exact iab, open the three validation URLs, perform minimal navigation and captures, then complete this file. Do not run Translator, Android, API, Production, or a full AGM retest.

## Slice A gate-closure probe (exclusive scope)

Source session exact selection result: `Browser is not available: iab`.

Build signature: `254D0FB63EC50013CCD6E70FAA92C1D531852FE9D81CF430E7FF59DFEAEFEF56`.

After exact `iab` selection succeeds, use only AGM Cockpit
`http://127.0.0.1:5174/before-departure.html` and validate the
`required-document` flow. Capture:

1. original import/photo, OCR, edited text, named human confirmation and READY;
2. missing/corrupt IndexedDB original → RECOVERY_REQUIRED;
3. missing document, missing OCR, missing confirmation, unreadable, expired and
   30-day warning decisions;
4. refresh/restart resume, language switch without state change, offline pending
   state, single sync after reconnect, and feature-flag legacy rollback;
5. rendered layout in RO/DE/EN/FR/NL/RU/PL/TR/SQ on desktop and Android viewport.

Record the four fields independently:

- Browser Plugin Status: PASS
- Integrated Browser Control Status: PENDING
- Browser Session Status: NOT STARTED
- Target Page Status: NOT STARTED

Do not test Slice B or the remaining 22 situations. Do not touch Production,
Basic, Fitness, Gmail or WhatsApp.
