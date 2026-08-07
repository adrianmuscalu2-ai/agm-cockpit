# AGM Browser validation runbook

**Status:** ACTIVE / MANDATORY  
**Owner:** Release & Operations  
**Executor:** Browser Validation Agent  
**Validator:** AGM Inspector  
**Escalation:** only after authorized recovery is exhausted

## Environment contract

| Activity | Required surface |
|---|---|
| Development, code, build, technical tests | VS Code / Codex IDE |
| Controlled visual validation | ChatGPT Desktop + Integrated Browser |
| Local target | `localhost` or `127.0.0.1` opened in Integrated Browser |

An ordinary Chrome window is not a controlled audit session.

## Mandatory preflight

Before every audit, release, or visual validation:

1. confirm Browser plugin is enabled and callable;
2. confirm Integrated Browser Control is available in ChatGPT Desktop;
3. create or select a controllable Integrated Browser session in the same audit conversation;
4. open the target local control route;
5. perform one navigation action and capture the rendered page;
6. record the four-field result below and continue only when every field is PASS.

```text
Browser Plugin Status: PASS | FAIL
Integrated Browser Control Status: PASS | FAIL
Browser Session Status: PASS | FAIL
Target Page Status: PASS | FAIL
Probe: <route, navigation action, capture identifier>
```

The target page is PASS only when it renders and the agent can inspect and
interact with it. HTTP 200, a user photograph, or an uncontrolled Chrome tab does
not replace the controlled probe.

## Automatic recovery sequence

When any preflight field fails, Release & Operations routes recovery to the
Browser Validation Agent:

1. verify the Browser plugin remains installed and enabled;
2. verify ChatGPT Desktop **Settings > Browser** and site permissions;
3. reactivate Browser control if disabled;
4. open a fresh Integrated Browser in the same audit conversation (`@Browser`
   or `Ctrl+Shift+B` on Windows);
5. reopen the local target route;
6. repeat navigation and capture;
7. if all four fields pass, resume the interrupted audit automatically;
8. otherwise record every attempted mechanism and issue HOLD.

Do not substitute standalone Playwright, Computer Use, Chrome, HTTP-only checks,
or a Browser opened in another conversation for the Integrated Browser session
bound to the audit conversation.

## Restart, update, or reinstall

The first visual task after restart, update, or reinstall always runs the full
preflight. No previous Browser session is assumed reusable. The Browser
Validation Agent creates a fresh session and reopens the target route. Plugin or
app reinstallation is permitted only through the normal approved plugin/app
workflow; it is never simulated by copying cache files.

## HOLD and escalation

HOLD is permitted only when the recovery sequence has been exhausted. Product
Owner escalation is not permitted for a recoverable technical condition. Route
to Product Owner only for product decisions, scope changes, major risk,
irreversible actions, real authority conflict, or a non-recoverable capability
block after documented recovery.

