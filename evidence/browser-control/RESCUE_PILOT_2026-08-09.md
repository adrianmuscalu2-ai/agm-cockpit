# Rescue pilot — Integrated Browser session attachment

## State flow

`ATLAS BLOCKED → RESCUE ACTIVATED → EVIDENCE COLLECTION → RECOVERY ATTEMPTS → MINIMAL RETEST → RECOVERY EXHAUSTED → HANDOFF TO ATLAS`

Preserved verdict: `AGM PRODUCT — PASS / FROZEN`.

No installation, removal, AGM startup, product test, Android test, Production
operation, DNS/Cloudflare/database change, or secret access occurred.

## Evidence collection

| Evidence | Result |
|---|---|
| Local Google Chrome | Present, version `151.0.7922.77` |
| Browser plugin/client | Present, version `26.730.61639` |
| Native helper binary | Present at the Codex `cua_node` runtime path |
| Configured backends | `chrome,iab` |
| Last known working session | Browser sidebar state from 2026-08-07 with `electron-webview`, controllable tab, navigation history, and AGM target |
| Current VS Code host | OpenAI ChatGPT extension runtime `26.803.41515` |
| Current Codex Desktop runtime/config | `26.730.61639` |
| VS Code / Extension Host processes | Present |
| `node_repl` control process | Present |
| `codex-computer-use` live process | Absent |
| Current `iab` selection | `Browser is not available: iab` |

## Cause classification

Primary: **Codex session / host mismatch**. The active Atlas execution is served
through the VS Code OpenAI extension runtime, while the installed Browser plugin,
saved Integrated Browser session, native pipe configuration, and prior working
evidence belong to Codex Desktop. The VS Code session advertises the browser
client tool but has no Desktop `iab` backend attached.

Secondary: **runtime session attachment**. The helper binary exists, disproving
a missing installation, but the host-specific live backend and pipe are absent.

This is not an AGM product defect, missing Chrome installation, missing plugin,
or failed VS Code Extension Host process.

## Recovery attempts

| Attempt | Action | Result | Decision |
|---|---|---|---|
| R1 | Fresh exact `iab` selection in the current session | FAIL: `Browser is not available: iab` | Inspect host/runtime boundary |
| R2 | Verify local browser, plugin, helper binary, config, processes, and last-working state | PASS for installed components; live backend absent | No reinstall; proceed to reconnect |
| R3 | Reset/reconnect the persistent browser-control runtime | Reconnection completed | Run minimal selection retest only |
| R4 | Exact `iab` selection after reconnect at `2026-08-09T05:04:04.073Z` | FAIL with unchanged exact error | Do not repeat retry |
| R5 | Verify VS Code Extension Host and compare runtime identities | Extension Host present; VS Code `26.803.41515` differs from Desktop/browser `26.730.61639` | Host mismatch established |
| R6 | Safe component restart | Not applicable: no attached `iab` component exists in this host to restart; directly launching the helper cannot bind it securely to the conversation | Do not simulate attachment |
| R7 | Approved alternate/fallback | Unattended Chromium exists but governance does not allow it to replace the `iab` gate | Preserve its PASS; do not promote it |
| R8 | Reprovision/new session | Not exposed to the agent from the active VS Code session; only the Desktop/platform host can create and bind it | External host boundary reached |

No unchanged action was repeated after R4.

## Minimal retest

The required recovery test was limited to exact `iab` selection. It failed
before any neutral tab could be created, so AGM was not started or retested.

Future recovery proof remains exactly:

1. `agent.browsers.get("iab")` returns a live binding in a host-provisioned
   session;
2. that binding creates a neutral tab;
3. one neutral navigation and capture succeeds through the same binding.

## Decision

`RECOVERY EXHAUSTED` for the **current VS Code-hosted session**. All applicable
approved local routes were attempted or proved inapplicable. The remaining
operation—creating a Codex Desktop session with its `iab` backend attached—is a
host/platform action unavailable to this agent and cannot be manufactured by a
local browser installation or helper launch.

This is not `AGM HOLD` and does not invalidate any frozen evidence.

## Handoff

`HANDOFF TO ATLAS`

- Preserve `AGM PRODUCT — PASS / FROZEN`.
- Do not reinstall and do not rerun AGM.
- Do not retry `iab` again in this unchanged VS Code session.
- Retry only the three-step neutral minimal proof when the execution host itself
  exposes the Desktop `iab` backend.

Pilot verdict: `RESCUE PILOT — PASS` because it added recovery actions, found
the host-version/session boundary, prevented the reinstall/full-retest loop,
and reached evidence-backed `RECOVERY EXHAUSTED`.

## Desktop recovery closure

The later Codex Desktop handoff completed the external session-provisioning
route documented by this pilot. Exact `iab` selection, public and local
navigation, DOM inspection, and captures passed. Evidence is recorded in
`integrated-browser-handoff-2026-08-09/HANDOFF.md`.

The earlier `RECOVERY EXHAUSTED` applies only to the originating VS Code
session. The cross-host incident is now `RECOVERED` through the approved route:

`VS CODE BLOCKED → RESCUE → CODEX DESKTOP iab → MINIMAL BROWSER PROBE → HANDOFF`

Final pilot status: `RESCUE PILOT — PASS / CLOSED`.
