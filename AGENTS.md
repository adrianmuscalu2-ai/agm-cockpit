# AGM agent instructions

## Browser validation — mandatory permanent flow

Before every visual audit, release validation, or stable-version verdict, follow
`deploy/operations/BROWSER_VALIDATION_RUNBOOK.md`.

The Browser preflight is a mandatory gate. Record these four fields separately:

- `Browser Plugin Status`;
- `Integrated Browser Control Status`;
- `Browser Session Status`;
- `Target Page Status`.

All four fields must be `PASS` before visual validation starts. A normal Chrome
window is not a controlled audit session. Localhost and `127.0.0.1` release
validation uses the unattended AGM Playwright/Chromium runner. Integrated
Browser is an optional interactive probe and must not make Product Owner
presence a normal recovery dependency.

The unattended runner detects or starts Web, allocates a live port, verifies
HTTP 200, creates an isolated controllable session, and records screenshots and
a machine-readable report.

If Browser control is unavailable, execute the runbook recovery completely:
verify the plugin, verify Browser settings, reactivate the mechanism, create a
fresh integrated session, reopen the local route, and repeat the minimal
navigation/screenshot probe. Continue automatically after recovery PASS. HOLD is
allowed only after all authorized recovery steps are exhausted and recorded.
