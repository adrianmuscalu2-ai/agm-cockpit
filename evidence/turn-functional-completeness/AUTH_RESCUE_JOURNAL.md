# TURN functional Browser authentication — Rescue journal

## Context and preserved evidence

- Affected component: Production Browser validation of `turn-functional-overview.v1`.
- Production revision: `7c74821d664fa6de82a77637be288e319880c875`.
- GitHub Actions run: `33923031565` — `success`.
- Deploy job: `101186054358` — `success`.
- Preserved PASS evidence: build, targeted functional tests, release pipeline, operational-truth infrastructure and false-green prevention.
- Prohibited scope: no PIN guessing, no secret extraction, no route stubs, no mock payloads, no status fallback, no ordinary/uncontrolled browser.

## Blocker

The protected Production endpoint requires a real TURN Owner Access bearer token. The current execution environment contains neither `AGM_TURN_OWNER_ACCESS_TOKEN` nor `AGM_TURN_ADMIN_PIN`; only presence was tested and no secret value was read.

Classification: `PROCEDURE/GOVERNANCE` plus missing session credential. Product runtime is deployed; the affected test session is not authenticated.

## Recovery attempts

| Time | Attempt | Evidence | Result | Decision |
|---|---|---|---|---|
| 2026-09-04 | Inspect process environment for token/PIN presence only | all three presence flags false | unavailable | do not guess or expose secrets |
| 2026-09-04 | Search documented configuration/evidence for an approved non-secret route | only TURN admin token contract found | no reusable credential | preserve authentication boundary |
| 2026-09-04 | Inspect existing machine-auth scope | `acp:read` only | not authorized for functional overview | do not broaden scope or present registry evidence as product evidence |
| 2026-09-04 | Prepare controlled interactive Owner login | validator commit `daa8e6f`; token remains in browser memory and is redacted from evidence | ready, requires explicit visible-window approval | run Browser preflight, then one controlled Chromium session |

## Handoff to Atlas

`RESCUE ACTIVATED → EVIDENCE COLLECTION → APPROVED ALTERNATE ROUTE PREPARED → OWNER AUTHORIZATION PENDING → HANDOFF TO ATLAS`

Bounded next action: after explicit approval, run `pnpm rescue:browser-preflight`, start `AGM_TURN_INTERACTIVE_OWNER_LOGIN=1 pnpm audit:turn-functional-overview`, let Product Owner enter the PIN directly in controlled Chromium, and retain only the redacted report/screenshots.
