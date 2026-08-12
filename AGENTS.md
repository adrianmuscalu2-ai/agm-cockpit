# AGM agent instructions

## Rescue activation — mandatory

Activate the project skill `.codex/skills/rescue/SKILL.md` before issuing HOLD
when Atlas reports `NU POT CONTINUA`, `TOOL UNAVAILABLE`, `RUNTIME UNAVAILABLE`,
`DEPENDENCY FAILURE`, `SESSION ATTACHMENT FAILURE`, or another potentially
recoverable technical blocker. Apply `FAIL PE O CALE ≠ HOLD`, preserve accepted
PASS evidence, exhaust applicable approved recovery paths without repeating an
unchanged attempt, run only the affected minimal retest, and hand control back
to Atlas with a complete recovery journal.

Rescue is registered as `OFFICIAL_PERSISTENT` in
`.codex/agents/registry.json`. Before every Browser test, run
`pnpm rescue:browser-preflight`. The canonical recovery route is:

`IAB PROBE ONCE → OPTIONAL EVIDENCE OR PLATFORM LIMITATION → CONTROLLED AGM PLAYWRIGHT/CHROMIUM → EVIDENCE → CLOSURE`

Browser PASS is reused while its evidence, canonical URLs, Browser contract,
and visual build signature remain unchanged; it is not repeated daily.

Rescue dependency policy is active: classify `NECESAR`,
`DEFECT DE CONFIGURARE`, `DEFECT DE RUNTIME/SESIUNE`, or `OPȚIONAL` before any
installation. Install automatically only when `NECESAR` is proved and the
verified source, compatibility, minimal test, and rollback are recorded. Never
perform speculative installations.

## Browser validation — mandatory permanent flow

Before every visual audit, release validation, or stable-version verdict, follow
`deploy/operations/BROWSER_VALIDATION_RUNBOOK.md`.

The Browser preflight is a mandatory gate. Record these four fields separately:

- `Browser Plugin Status`;
- `Integrated Browser Control Status`;
- `Browser Session Status`;
- `Target Page Status`.

`Browser Plugin Status`, `Browser Session Status`, and `Target Page Status`
must be `PASS`. `Integrated Browser Control Status` is attempted once and
recorded separately. When `iab` is absent, record `PLATFORM LIMITATION /
OPTIONAL EVIDENCE UNAVAILABLE` and continue automatically with the unattended
AGM Playwright/Chromium runner. A controlled runner PASS is official and
sufficient Browser release evidence; `iab` is optional interactive evidence
and cannot block the product. A normal Chrome window is not a controlled audit
session. Localhost and `127.0.0.1` validation uses the unattended runner.

The unattended runner detects or starts Web, allocates a live port, verifies
HTTP 200, creates an isolated controllable session, and records screenshots and
a machine-readable report.

If Browser control is unavailable, execute the runbook recovery completely:
verify the plugin, verify Browser settings, reactivate the mechanism, create a
fresh integrated session, reopen the local route, and repeat the minimal
navigation/screenshot probe. Continue automatically after recovery PASS. HOLD is
allowed only after all authorized recovery steps are exhausted and recorded.
