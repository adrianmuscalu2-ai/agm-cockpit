# AGM UI Live Audit

This follow-up tool validates AGM services and produces isolated visual evidence
without changing the application, its baseline, or its deployment.

## Run

```powershell
pnpm audit:ui-live
```

The command checks local and public AGM Browser, Website, Turn Command Center,
and API readiness routes. UI routes are opened in a clean Playwright Chromium
context and captured at desktop (`1440x1000`) and mobile (`390x844`) sizes.
The local Turn validation also renders the read-only Operations Center component
in a test harness, waits for its live checks, verifies that no monitored service is
`DEGRADED` or `OFFLINE`, and captures the synchronized cards without using or
recording the administrative PIN.

UI LIVE and Operations Center read their URL and status-source definitions from:

```text
config/operations-health.json
```

This shared registry prevents the automated report and dashboard from checking
different endpoints.

Artifacts are written to:

```text
.tmp/ui-live-audit/<ISO timestamp>/
```

Each run contains:

- `report.md` for the operator;
- `report.json` for automation;
- Desktop and Mobile PNG captures for applicable UI services.

The command exits with code `0` only when every HTTP check returns `200` and
every required screenshot is created successfully.

## Optional configuration

All defaults can be overridden without editing source:

- `AGM_UI_AUDIT_OUTPUT`
- `AGM_UI_AUDIT_TIMEOUT_MS`
- `AGM_UI_AUDIT_HEADLESS=false` to show the isolated browser
- `AGM_BROWSER_LOCAL_URL`
- `AGM_TURN_LOCAL_URL`
- `AGM_WEBSITE_LOCAL_URL`
- `AGM_API_READY_LOCAL_URL`
- `AGM_BROWSER_PUBLIC_URL`
- `AGM_TURN_PUBLIC_URL`
- `AGM_API_READY_PUBLIC_URL`
- `AGM_WEBSITE_PUBLIC_URL`

Do not place credentials or secret-bearing query strings in these variables.
The runner removes URL credentials, query strings, fragments, and common secret
patterns from reports and never records HTTP bodies or headers. Browser contexts
start without the user's cookies or local storage.
