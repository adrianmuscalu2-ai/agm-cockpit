# WhatsApp external validation — controlled preflight

Status: AUTHORIZED / READ-ONLY PREFLIGHT

## Identity boundary

- Proposed official AGM number: `+49 173 4021893`
- The number is not considered a WhatsApp Cloud API identity until Meta reports
  its WABA and Phone Number ID and Product Owner confirms its use.
- No real message may be sent before both the AGM sender identity and a dedicated
  test recipient are explicitly confirmed.

## Required Meta inventory

- App ID and app display name;
- Business portfolio ID and display name;
- WhatsApp Business Account ID;
- test or real phone classification and Phone Number ID;
- access-token presence and lifetime classification without recording its value;
- webhook callback URL state;
- verify-token state without recording its value;
- subscription to the `messages` field, which carries inbound messages and
  delivery/read status notifications.

## Security

App Secret, access token and verify token are secrets. Store them only through
the approved local secret mechanism and expose them to the API process through
environment injection. Never put them in chat, screenshots, commits, evidence,
command arguments or plaintext `.env` files.

The callback must be public HTTPS for a real Meta webhook. Because Production,
Cloudflare and DNS are outside this mandate, absence of an already approved
callback is reported as `NOT CONFIGURED`; no tunnel or infrastructure change is
created speculatively.

## Owner intervention boundary

Product Owner is requested only for an unavoidable Meta login/MFA, Business
portfolio selection, permission consent, phone ownership verification, or final
confirmation of sender and test recipient. After each manual action, control
returns to Rescue for the minimal technical probe.
