# Rescue Browser handoff

Created: 2026-08-09T21:24:28.328Z

Route: VS CODE BLOCKED → RESCUE → CODEX DESKTOP iab → PROBĂ MINIMĂ → HANDOFF → ÎNCHIDERE

- Website: https://app.agmcockpit.com/
- Cockpit: http://127.0.0.1:5174/
- Email: http://127.0.0.1:5174/email
- Fitness: http://127.0.0.1:5173/ — RESERVED / DO NOT TOUCH
- Visual signature: C841D84FA7A0BA8EAAACF2596892D143E0B41E1E7F681C18AC45AA2AB4B94592
- AGM PRODUCT: PASS / FROZEN

Desktop: select exact iab, open the three validation URLs, perform minimal navigation and captures, then complete this file. Do not run Translator, Android, API, Production, or a full AGM retest.

## Current task — Meta / WhatsApp read-only preflight

This task supersedes the generic product URL probe. Gmail OAuth is out of scope.

1. Select exact `iab` and open only official `https://business.facebook.com/` and `https://developers.facebook.com/apps/` surfaces.
2. Record whether an authenticated Meta administrative session exists. If login, MFA, consent or account selection is required, stop and record `OWNER ACTION REQUIRED`.
3. Read only; do not create or modify an app, Business portfolio, WABA, phone number, token, webhook, subscription, billing resource or system user.
4. If visible, record the non-secret identifiers and state only:
   - app display name and App ID;
   - Business portfolio display name and Business ID;
   - WhatsApp Business Account ID;
   - test/real phone display and classification;
   - Phone Number ID;
   - access token state as PRESENT/ABSENT and TEMPORARY/PERMANENT/UNKNOWN, never its value;
   - webhook callback hostname/path and configured/not configured;
   - verify token as CONFIGURED/ABSENT, never its value;
   - subscribed fields, especially `messages`.
5. Official AGM proposed real number is `+49 173 4021893`; do not attach, verify or send to it during preflight.
6. Do not inspect Gmail, Production, Basic or Fitness.

Required result:

```text
Integrated Browser Control: PASS | FAIL
Meta authorization: READY | OWNER ACTION REQUIRED | UNAVAILABLE
Meta app: <name/id or NOT FOUND>
Business account: <name/id or NOT FOUND>
WABA ID: <id or NOT FOUND>
Phone: <masked display + TEST/REAL/UNKNOWN or NOT FOUND>
Phone Number ID: <id or NOT FOUND>
Access token: PRESENT/ABSENT — TEMPORARY/PERMANENT/UNKNOWN
Webhook callback: CONFIGURED/ABSENT — <non-secret URL if configured>
Verify token: CONFIGURED/ABSENT
Subscribed events: <names or NONE>
Manual owner action: <exact minimal step or NONE>
No secret captured: PASS
No Gmail/Production/Basic/Fitness change: PASS
```
