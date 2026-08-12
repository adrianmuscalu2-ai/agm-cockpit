# Browser installation and provisioning audit — 2026-08-09

## Governing status

- `AGM PRODUCT — PASS / FROZEN`
- `BROWSER CONTROL — EXTERNAL SESSION PROVISIONING BLOCKER`
- `NO REINSTALL / NO FULL RETEST`

No software was installed or removed and no AGM product test was run during
this audit.

## CE S-A INSTALAT

| Component | Evidence | Role |
|---|---|---|
| Google Chrome | Version `151.0.7922.77`, Windows `InstallDate=20260807`, `C:\Program Files\Google\Chrome\Application` | Local desktop browser |
| Playwright Chromium | `chromium-1234`, created 2026-07-25 under `%LOCALAPPDATA%\ms-playwright` | Managed browser used by the unattended AGM runner |
| Playwright Headless Shell | `chromium_headless_shell-1234`, created 2026-07-25 | Headless runtime for unattended automation |
| Browser plugin | Version `26.730.61639`, client/config present | Client integration and browser API surface |

No repository evidence or PowerShell history entry identifies the exact command
that installed Chrome or records a defensible incident-specific rationale. The
earlier claim that installing a local browser would restore Integrated Browser
was therefore unsupported. Playwright Chromium predates this incident and is
required only by the independent unattended runner.

## DE CE NU A FUNCȚIONAT

Installation changed layer 1 (local browser availability), while the failure
is in layer 3 (session backend provisioning). A Windows browser executable,
Playwright Chromium, or plugin files cannot register an `iab` backend in a
Codex session. The concrete result remained unchanged:

- local browser: available;
- Browser plugin/client: available;
- `agent.browsers.list()`: empty;
- `agent.browsers.get("iab")`: `Browser is not available: iab`;
- native Computer Use process and configured session pipe: absent.

## CE COMPONENTĂ LIPSEȘTE

The missing component is the live Integrated Browser/Computer Use native
backend attached to the current Codex Desktop session, including its active
process/transport and registration visible to the browser client. It is not a
Chrome, Chromium, Playwright, or plugin installation.

## CINE O POATE PROVISIONA

Only the Codex Desktop/platform session host can launch and attach that backend
when creating a browser-capable session. The repository, AGM application,
Browser Validation Agent, local Chrome installer, and Playwright installer
cannot provision it. If the host product/tenant/session does not offer that
capability, this is an external platform limitation requiring platform support
or a session created in an environment where Computer Use is enabled.

No documented local command is approved for manufacturing the backend, native
pipe, or attachment. Direct launch or simulation is prohibited.

## COMPONENT NECESSITY

- Google Chrome: not required for Integrated Browser `iab`; it may remain useful
  as a normal browser or extension surface. Necessity for other user workflows
  was not assessed.
- Playwright Chromium and Headless Shell: still required for the independent
  AGM unattended validation runner; they do not resolve `iab`.
- Browser plugin: necessary client-side prerequisite, but insufficient without
  the host-provisioned backend.

Nothing is authorized for removal.

## CARE ESTE TESTUL MINIM CARE CONFIRMĂ REMEDIEREA

In a newly host-provisioned Codex Desktop session:

1. select the exact `iab` backend successfully;
2. obtain a controllable neutral tab from that binding;
3. navigate once to a neutral page and capture/inspect it successfully;
4. record the session identifier and capture identifier.

Passing conditions are: selection returns a live binding rather than
`Browser is not available: iab`, and navigation plus capture complete through
that same binding. This minimum test does not start AGM and does not repeat any
frozen product validation.

## Runbook correction

`deploy/operations/BROWSER_VALIDATION_RUNBOOK.md` now separates the three
layers, checks actual backend selection first, stops before product tests when
the backend is absent, prohibits reinstall as session-backend recovery, and
assigns provisioning to the host platform.
