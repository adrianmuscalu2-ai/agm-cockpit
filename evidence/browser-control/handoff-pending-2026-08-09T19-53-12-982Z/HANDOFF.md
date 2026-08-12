# Rescue Browser handoff

Created: 2026-08-09T19:53:12.986Z

Route: VS CODE BLOCKED → RESCUE → CODEX DESKTOP iab → PROBĂ MINIMĂ → HANDOFF → ÎNCHIDERE

- Website: https://app.agmcockpit.com/
- Cockpit: http://127.0.0.1:5174/
- Email: http://127.0.0.1:5174/email
- Fitness: http://127.0.0.1:5173/ — RESERVED / DO NOT TOUCH
- Visual signature: 145AC9A6988E8055943CBCD87FB1AAB9B03FE792CC298549E38EDAE523507DFE
- AGM PRODUCT: PASS / FROZEN

Desktop: select exact iab, open the three validation URLs, perform minimal navigation and captures, then complete this file. Do not run Translator, Android, API, Production, or a full AGM retest.

## Current recovery task — provider authorization preflight

This handoff supersedes the generic product-URL probe for the current task.

1. Select the exact `iab` backend.
2. Open `https://console.cloud.google.com/` and record only whether an authenticated administrative session is available.
3. Open `https://business.facebook.com/` and record only whether an authenticated administrative session with access to the official AGM WhatsApp number is available.
4. Do not create projects, applications, credentials, tokens, webhooks, subscriptions, billing resources, or Production changes during this preflight.
5. Do not capture or record personal data, passwords, tokens, client secrets, account identifiers, recovery codes, or cookies.
6. If sign-in, consent, account selection, billing, or an irreversible administrator action is requested, stop on that screen and record `OWNER ACTION REQUIRED` without entering credentials.
7. Save only the two availability verdicts and return the handoff to VS Code.

Required result:

```text
Integrated Browser Control Status: PASS | FAIL
Google Cloud administrative session: AVAILABLE | OWNER ACTION REQUIRED | UNAVAILABLE
Meta Business administrative session: AVAILABLE | OWNER ACTION REQUIRED | UNAVAILABLE
No secrets captured: PASS
No provider or Production change: PASS
```

## Gmail-first provisioning mandate

Follow `deploy/operations/GMAIL_LOCAL_VALIDATION_RUNBOOK.md`. Gmail is the only
provider in scope. If the Google administrative session is available, identify
an existing matching AGM project/client or create the precisely named LOCAL
VALIDATION Desktop OAuth client, enable only Gmail API, and return the actual
project ID and OAuth client ID without any secret. Stop before owner account
authorization. Do not open or configure Meta during this handoff.

Required Gmail result:

```text
Google administrative session: AVAILABLE | OWNER ACTION REQUIRED | UNAVAILABLE
Project display name: AGM Cockpit Local Validation
Actual project ID: <non-secret ID or NOT CREATED>
OAuth client display name: AGM Cockpit Local Gmail Validation
Actual OAuth client ID: <non-secret ID or NOT CREATED>
Redirect URI: http://127.0.0.1:53682/oauth2/callback
Scopes: gmail.send, gmail.readonly
Stopped before owner authorization: PASS
No secret captured: PASS
No Production/Basic/Fitness change: PASS
```
