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

## Production TURN validation attempt — 2026-09-05

- Production revision: `ddfb0cb19184eb5d3191f70910b0ad4fccd0823e`.
- GitHub Actions run: `33938863920` — `success`.
- Production deployment: `6276143375` — approved explicitly and completed successfully.
- Browser preflight: Plugin `PASS`; IAB `SESSION_ATTACHMENT_MISSING / OPTIONAL`; controlled Browser session `PASS`.
- Authentication capability: neither `AGM_TURN_OWNER_ACCESS_TOKEN` nor `AGM_TURN_ADMIN_PIN` was present; values were not read or guessed.
- Approved alternate route attempted: visible controlled Chromium with interactive Owner login.
- Result: Owner login did not complete inside the 300-second window; protected requests remained HTTP 401 and the target-page test did not execute.
- Evidence: `browser/2026-09-05T02-31-11-422Z/report.json`.
- Classification: `PROCEDURE/GOVERNANCE — OWNER INTERACTION NOT COMPLETED`; not a TURN product verdict.
- Preserved evidence: push, build, publish and Production deployment for `ddfb0cb` remain accepted; no M2M or deployment retest is required.

`RESCUE ACTIVATED → EVIDENCE COLLECTION → APPROVED ALTERNATE ROUTE ATTEMPTED → OWNER INTERACTION REQUIRED → HANDOFF TO ATLAS`

Bounded next action: when Product Owner confirms readiness, rerun only `AGM_TURN_INTERACTIVE_OWNER_LOGIN=1 pnpm audit:turn-functional-overview`, enter the PIN directly in controlled Chromium, and evaluate the resulting real Production TURN payload and Premium panel.

## 2026-09-05 visible-session recovery

| Attempt | Evidence | Result | Decision |
|---|---|---|---|
| Repeat controlled Chromium after Product Owner `GATA` | Browser process existed but Windows reported no process with a non-zero `MainWindowHandle` | headed Playwright session was not attached to the visible desktop | stop the unchanged attempt before another timeout |
| Prepare a visible masked PowerShell credential prompt followed by headless controlled audit | script uses `Read-Host -AsSecureString`, HTTPS unlock, transient child-process token, and explicit memory/environment cleanup | execution rejected because prior approval covered Chromium only | do not circumvent; request separate explicit approval with credential-handling disclosure |

Preserved evidence: Production workflow `33938863920` and deployment SHA `ddfb0cb` remain successful. Product validation remains `PENDING`; the session attachment failure is not a TURN product verdict.

## 2026-09-05 secure prompt route and product findings

| Attempt | Evidence | Result | Decision |
|---|---|---|---|
| Product Owner explicitly approved the secure PowerShell prompt route for `ddfb0cb` | PIN read with `Read-Host -AsSecureString`; unlock performed over HTTPS; bearer token passed only to the controlled child process and redacted from reports | real Owner Access obtained; protected functional-overview and operational-dashboard APIs returned HTTP 200 | authentication blocker recovered; continue only the affected TURN Browser audit |
| Controlled Production audit with real token | `browser/2026-09-05T04-53-02-369Z/report.json` and `browser/2026-09-05T04-55-18-548Z/report.json` | validator incorrectly required runtime heartbeat for the human Product Owner identity | correct validator contract: human authority is `STANDBY / NOT_APPLICABLE`, with no fabricated runtime evidence |
| Controlled Production audit after human-runtime correction | `browser/2026-09-05T04-57-01-409Z/report.json` | API contracts passed with 28 nodes and zero capability gaps; UI still exposed 37 registry nodes while the registry `<details>` was closed, and the Premium board had returned to a loading state before capture | real Web defects confirmed; no Product PASS and no weakening of registry/runtime assertions |

Root causes isolated:

- author CSS on `.network-agent` overrode the browser's native hidden rendering for descendants of a closed `<details>`;
- Premium operational loading was unnecessarily sequenced behind browser linguistic-heartbeat publication, so an unrelated delayed/unauthorized heartbeat cycle could leave a newly rendered operational board pending.

Local remediation prepared:

- explicit closed-registry descendant hiding while preserving the inventory when the Product Owner opens it;
- immediate authenticated operational-dashboard binding, independent of linguistic-heartbeat completion;
- controlled validator waits for the current Premium panel to contain all 28 real operational cards after section navigation;
- operational-truth contract test updated to enforce these properties.

Local verification: functional-overview contract `PASS`; operational-truth UI contract `PASS`; Web production build `PASS`. A new Production revision is required before the minimal Browser retest can evaluate this remediation.

## 2026-09-05 Production closure evidence for `a8c7a5e`

- Product Owner explicitly approved push, Production deployment, and the secure masked-PIN audit route for `a8c7a5e`.
- GitHub Actions run `33946267911`: `verify`, `publish`, `publish-web`, and `deploy` completed successfully.
- Production deployment `6277390346` targeted exact SHA `a8c7a5ed4726a47b04307e681791097cd93ec920`.
- Browser preflight: Browser Plugin `PASS`; Integrated Browser Control `PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE`; controlled Browser Session `PASS`.
- Controlled Production evidence: `browser/2026-09-05T05-15-32-348Z/`.
- Protected functional-overview API: HTTP 200; protected operational-dashboard API: HTTP 200; real bearer token redacted and cleared after the child process exited.
- Target Page: `PASS`; Premium board present; 28/28 operational cards contain the required operational fields; registry is secondary, closed, and has 0 visible nodes; no static/orbital substitute; 23 functional zones; 0 unresolved UNKNOWN; 0 capability gaps; 0 missing registry identities.
- Current real system state shown by TURN: 27 runtime observations, 20 healthy, 6 degraded, 1 failed, 18 standby, 0 unknown; Authority Control Plane `FAIL`; Opportunity Intelligence `NO_ACTIVITY`.
- Browser page errors: 0. The admin-only controlled session also observed 36 HTTP 401 and 6 HTTP 429 responses from auxiliary user-authenticated probes; these were not used as evidence for the protected dashboard and do not convert the displayed degraded/failed system state to green.
- Product Owner acceptance remains `NOT_GRANTED`; `FINAL_PRODUCT_PASS` remains false and cannot be inferred from this technical Browser PASS.

`RESCUE RECOVERED AUTHENTICATION -> CONTROLLED PRODUCTION AUDIT PASS -> EVIDENCE PRESERVED -> HANDOFF TO PRODUCT OWNER`
