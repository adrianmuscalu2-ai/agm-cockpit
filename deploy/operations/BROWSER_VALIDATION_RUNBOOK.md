# AGM Browser validation runbook

**Status:** ACTIVE / MANDATORY  
**Owner:** Release & Operations  
**Executor:** Browser Validation Agent  
**Validator:** AGM Inspector  
**Escalation:** only after authorized recovery is exhausted

> **Product Owner amendment — 2026-08-11:** Controlled AGM
> Playwright/Chromium PASS is official and sufficient Browser release evidence.
> Integrated Browser `iab` is attempted once as optional interactive evidence.
> When absent, record `PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE` and
> continue automatically with the controlled runner. This amendment supersedes
> every older mandatory-IAB or stop-on-missing-IAB statement below.

## Environment contract

| Activity | Required surface |
|---|---|
| Development, code, build, technical tests | VS Code / Codex IDE |
| Controlled visual validation | AGM unattended Playwright + Chromium runner |
| Optional interactive evidence | Codex Desktop + Integrated Browser |
| Local target | Dynamically discovered local URL opened by the unattended runner |

An ordinary Chrome window is not a controlled audit session. The isolated AGM
Chromium session is controlled by the authorized runner and is distinct from a
user Chrome profile.

These are separate capabilities and must never be inferred from one another:

1. a locally installed Windows browser;
2. an installed/configured Browser plugin or extension;
3. an Integrated Browser/Computer Use backend provisioned for the current
   Codex session.

A local browser or plugin can be present while the session backend is absent.
Installing or reinstalling Chrome, Edge, Chromium, Playwright, or the Browser
plugin does not provision Integrated Browser Control and is not a recovery step
for a missing session backend.

Configured values such as `BROWSER_USE_AVAILABLE_BACKENDS=chrome,iab`, an old
`SKY_CUA_NATIVE_PIPE_DIRECTORY`, or an installed helper executable are not
runtime evidence. After an application update, restart, or session handoff,
these values can outlive the native `codex-computer-use` process that served the
pipe. Preflight must therefore report configured backends separately from live
runtime selection, compare the configured and installed Codex versions, and
classify a configured pipe without its serving process as
`SESSION_ATTACHMENT_MISSING`. Never persist a successful one-session
attachment as proof for a later session.

## Permanent execution routing

Canonical route:

`IAB PROBE ONCE → OPTIONAL EVIDENCE OR PLATFORM LIMITATION → CONTROLLED RUNNER → EVIDENCE → CLOSURE`

Run `pnpm rescue:browser-preflight` before every Browser test. The command
checks host identity, extension/runtime versions, helper, control executable,
named pipe, canonical URLs and ports, visual build signature, and reusable PASS
evidence. When `iab` is absent, preflight records the platform limitation and
routes automatically to the controlled runner without launching Desktop.

- VS Code/Codex owns development, audit, terminal work, non-integrated tests,
  evidence, and governance.
- Codex Desktop owns only optional interactive Integrated Browser evidence.
- Atlas probes `iab` once before starting the controlled Browser target.
- If the active session does not expose `iab`, do not install or retry it and do
  not issue product HOLD. Start the controlled runner automatically.
- The Desktop executor performs only `iab` selection, URL opening, minimal
  navigation, capture, and result recording. It must not reopen accepted
  Translator, Android, Production, or other frozen test scopes.
- Desktop records the minimal navigation and capture in `HANDOFF.md`.
- A local Windows browser and the VS Code extension do not guarantee that the
  Codex Desktop Integrated Browser backend is attached.
- Fitness owns `5173` permanently: `RESERVED / DO NOT TOUCH`.
- AGM Cockpit owns `5174`: `STRICT PORT`.
- Never terminate an existing process to release either port.
- Canonical URLs are `https://app.agmcockpit.com/`,
  `http://127.0.0.1:5174/`, `http://127.0.0.1:5174/email`, and protected
  `http://127.0.0.1:5173/`. Do not use `agm-cockpit.pages.dev` for current
  validation.

After a successful Desktop handoff, import the capture identifiers and verdict
into the AGM governance register and resume the interrupted audit automatically.
Do not repeat the accepted product tests.
Do not repeat Browser PASS daily. Retest only after a visual build change,
canonical URL or Browser contract change, invalid/missing evidence, or a proved
Browser regression.

The handoff packet must preserve the source session, build, public and local
URLs, reserved ports, process/HTTP evidence, exact minimal navigation, capture
destination, frozen verdicts, and prohibited scope.

An operator-declared reserved port remains reserved even when a point-in-time
TCP query does not observe a listener. Auto-reloading development servers can
temporarily release or recreate their listener. Never treat a missed snapshot
as authorization to reuse, restart, or terminate that port or project.

## Mandatory preflight

Before every audit, release, or visual validation:

1. confirm that the Browser plugin is callable;
2. attempt actual runtime selection of Integrated Browser (`iab`) once;
3. if selection fails, record `Integrated Browser Control Status: PLATFORM
   LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE`; do not retry or install;
4. confirm the unattended Browser runner and real Chromium executable are callable;
5. detect an existing healthy target or start Web on an OS-allocated free port;
6. create the required controllable sessions, open the discovered local route,
   verify HTTP 200, perform one navigation action, and capture the rendered
   page;
7. record the four-field result. Continue when Plugin, Browser Session, and
   Target Page are PASS; IAB may be optional-unavailable.

```text
Browser Plugin Status: PASS | FAIL
Integrated Browser Control Status: PASS | PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE
Browser Session Status: PASS | FAIL
Target Page Status: PASS | FAIL
Probe: <route, navigation action, capture identifier>
```

The target page is PASS only when it renders and the agent can inspect and
interact with it. HTTP 200, a user photograph, or an uncontrolled Chrome tab does
not replace the controlled probe.

## Automatic recovery sequence

When a required controlled-runner field fails, Release & Operations routes
recovery to the Browser Validation Agent without Product Owner intervention:

1. record an absent IAB backend once as optional platform limitation;
2. start the controlled runner independently of the Codex session;
3. verify real Chromium, HTTP target, navigation, interaction and capture;
4. retry only the failed atomic runner scenario;
5. issue product HOLD only for a concrete controlled-runner or product failure.

If a fresh Codex Desktop session still exposes no backend, local recovery is
exhausted. The permanent correction must be made by the Desktop/platform host:
attach the Integrated Browser backend during every eligible session bootstrap,
start the native helper, and issue a fresh pipe instead of reusing session
metadata. Until the host guarantees this, the only unavoidable manual action is
starting an eligible Desktop session; no local PATH, browser installation, or
repository setting can manufacture the missing backend.

Run the applicable unattended audit after the one-time IAB probe. Integrated
Browser cannot replace unattended product evidence. Controlled runner evidence
is sufficient when it includes per-scenario verdicts, screenshots, logs,
timestamp, target URL and build/revision context. Unexecuted scenarios remain
PENDING and can never be inferred PASS.

- Wave 1 surface: `pnpm audit:wave1-browser`
- Premium Slice A Desktop matrix: `pnpm audit:slice-a-desktop`

## Restart, update, or reinstall

The first visual task after restart, update, or reinstall always runs the full
preflight. No previous Browser session is assumed reusable. The Browser
Validation Agent creates a fresh session and reopens the target route. Plugin or
app reinstallation is permitted only through the normal approved plugin/app
workflow; it is never simulated by copying cache files.

Reinstallation is not authorized as recovery for an absent Integrated Browser
session backend. Provisioning belongs to the Codex Desktop/platform session
host. If the host cannot expose `iab` to the session, record a platform
limitation rather than installing another browser.

## HOLD and escalation

HOLD is permitted only when the recovery sequence has been exhausted. Product
Owner escalation is not permitted for a recoverable technical condition. Route
to Product Owner only for product decisions, scope changes, major risk,
irreversible actions, real authority conflict, or a non-recoverable capability
block after documented recovery.

## Evidence continuity after interruption

An interrupted Codex, Browser, or handoff session does not reset a validation.
Every scoped validation keeps a build-bound Evidence Manifest containing the
revision, platform, scenario, atomic checkpoint, proof, verdict, timestamp and
tool. On resume, read the manifest first, preserve every attributable PASS and
continue only PENDING or interrupted atomic tests.

Evidence is invalidated only by a relevant visual/functional build change,
different recorded hash/revision, relevant configuration change, or incomplete
attribution. A UI-only change invalidates only affected visual evidence; domain,
migration and deduplication evidence remains valid when its inputs and code are
unchanged. Integrated Browser unavailability must not erase evidence or cause a
full reset. Rescue may assemble remaining evidence from the controlled Browser
route, controlled manual captures, logs, automated tests and physical Android,
while recording the exact tool and limitations of each proof.
