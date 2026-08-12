# Rescue Browser handoff

Created: 2026-08-09T22:42:39.552Z

Route: VS CODE BLOCKED → RESCUE → CODEX DESKTOP iab → PROBĂ MINIMĂ → HANDOFF → ÎNCHIDERE

- Website: https://app.agmcockpit.com/
- Cockpit: http://127.0.0.1:5174/
- Email: http://127.0.0.1:5174/email
- Fitness: http://127.0.0.1:5173/ — RESERVED / DO NOT TOUCH
- Visual signature: C72CC24238F10FB5BFE89EC1ACACA25A8307B4DBDF8854880C33C25BE4A29FBC
- AGM PRODUCT: PASS / FROZEN

Desktop: select exact iab, open the three validation URLs, perform minimal navigation and captures, then complete this file. Do not run Translator, Android, API, Production, or a full AGM retest.

## Current task — Premium two-workspace visual projection

This task supersedes the generic URL probe. Use the already validated local
Product Owner session; do not request or record credentials.

1. Select exact `iab`.
2. Open the active local Premium route on the already running validation
   surface (`http://127.0.0.1:5175/premium` if the authenticated 5175 session is
   still active; otherwise use the authenticated local Cockpit surface).
3. Confirm exactly two user-facing operational workspace cards, in this order:
   `Pre-Departure`, `Journey Operations Workspace`.
4. Confirm the visible page contains none of: `HUB-00` through `HUB-07`,
   `available`, `partial`, `foundation`, `NO_ACTIVE_TRIP`.
5. Open each workspace link only far enough to confirm its existing route;
   do not execute workflows or alter trip data.
6. Capture the Premium root and record URLs/results. Do not test Gmail,
   WhatsApp, Production, Basic, Fitness, Translator or Android.

Required result:

```text
Integrated Browser Control: PASS | FAIL
Premium access preserved: PASS | FAIL
Visible workspace count: 2 | <actual>
Workspace 1: Pre-Departure — PASS | FAIL
Workspace 2: Journey Operations Workspace — PASS | FAIL
Technical HUB labels visible: NO | YES
Technical states visible: NO | YES
Internal routing preserved: PASS | FAIL
Capture: <identifier>
No unrelated change/test: PASS | FAIL
```
