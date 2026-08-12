# Integrated Browser Control diagnosis — 2026-08-08

## Scope and frozen product state

- Android Translator functional closure: `PASS / FROZEN`.
- Production and physical Android validation: `PASS`.
- No backend, APK, Production, DNS, database, or Translator runtime was changed or retested during this investigation.
- The accepted Translator evidence is sealed by `evidence/android-translator-wave1/FROZEN_SHA256SUMS.txt`.

## Mandatory browser gate

| Field | Status | Evidence |
|---|---|---|
| Browser Plugin Status | PASS | Installed plugin version `26.730.61639`; browser client and trusted client hash are configured. |
| Integrated Browser Control Status | FAIL | `agent.browsers.list()` returned `[]`; `agent.browsers.get("iab")` returned `Browser is not available: iab`. |
| Browser Session Status | PASS | Unattended AGM runner created an isolated controllable Chromium session. |
| Target Page Status | PASS | Unattended report recorded HTTP 200 at `http://127.0.0.1:59532/`. |

Unattended validation report: `.tmp/wave1-browser-validation/2026-08-08T21-06-26-088Z/report.json`.

## Exact cause

The plugin installation and declared configuration are present and advertise `chrome,iab`, but the native Integrated Browser backend was not provisioned in the current Codex Desktop session:

- no `codex-computer-use.exe` process is running;
- configured native pipe `\\.\pipe\codex-computer-use-382f5d8a-1d4b-4455-9987-814907ea8e52` does not exist;
- consequently, the browser client discovers zero available backends;
- persisted browser tab data belongs to earlier thread IDs and cannot attach the current thread `019fe2f8-831a-7a91-8abb-58e3b894ca64`.

This is not a product/runtime failure and not a missing Browser plugin. It is a missing native tool-session attachment/provisioning failure.

## Recovery assessment

- **A — locally remediable:** No, not through an exposed and approved control surface in the current session. Directly launching internal binaries or fabricating a pipe/session is not an authorized recovery mechanism.
- **B — plugin/tool issue:** Yes, primary classification. The installed client receives no native browser backend.
- **C — external limitation:** Yes, secondary classification. Provisioning/reattachment requires the host Codex Desktop environment to create a fresh browser-capable session.
- **D — release procedure defect:** Yes. The runbook calls Integrated Browser an optional interactive probe and says it cannot block the unattended runner, while its preflight requires all four fields to pass. No precedence rule resolves this contradiction.

## Governance search

The approved runbook and repository-level browser instructions were searched for `degraded`, `exception`, `waiver`, `alternate evidence`, and `alternative evidence`. No approved degraded mode, alternate-evidence substitution, waiver, or exception exists.

Therefore unattended Chromium PASS cannot currently be promoted into Integrated Browser Control PASS, and no exception may be inferred.

## Verdict and bounded next action

- `ANDROID TRANSLATOR FUNCTIONAL — PASS / FROZEN`
- `FORMAL STABLE RELEASE — HOLD`
- blocker: `INTEGRATED BROWSER CONTROL ONLY`

Required recovery is host-side provisioning of a fresh Codex Desktop session with Integrated Browser/Computer Use enabled. After the native backend and pipe exist, repeat only the minimal navigation/screenshot probe and record the four fields. Do not repeat Translator tests unless that host recovery changes product runtime.
