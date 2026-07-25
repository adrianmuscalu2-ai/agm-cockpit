# AGM email alerting runbook

## Scope

The monitor is independent from AGM Cockpit, Email Assistant, PostgreSQL and the
Cloudflare connector. It checks:

- `http://127.0.0.1:3000/api/v1/health/ready`;
- `https://api.agmcockpit.com/api/v1/health/ready`;
- `http://127.0.0.1:5173/`;
- `https://app.agmcockpit.com/`.

Two consecutive failures are required before an outage alert. Only one alert is sent
for the same outage. A separate recovery message is sent after the next successful
check. State is stored outside Git under:

```text
C:\ProgramData\AGM\monitor\state.json
```

Alert transport errors are recorded in `lastAlertError` and do not prevent the
service status from being persisted. SMTP operations have a 15-second timeout.

To add the Browser checks to an existing secured monitor installation without
re-entering the SMTP credential, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Update-AGM-Browser-Monitor.ps1
```

The updater backs up the previous configuration and state, captures any pending
recovery notifications in a local outbox, and restarts the scheduled task.

## Secure configuration

Run in an administrative PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Configure-AGM-Monitor.ps1 `
  -Recipient "<RECIPIENT>" `
  -SmtpHost "<SMTP HOST>" `
  -SmtpPort 587 `
  -From "<SENDER>"
```

The command prompts for the SMTP credential. It is encrypted with Windows DPAPI for
the current user and saved outside the repository. Do not place it in `.env`.

Install the two-minute scheduled task:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Install-AGM-Monitor.ps1
```

## Controlled tests

Use a temporary state file so production monitor state is not changed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Monitor-AGM-Services.ps1 `
  -StatePath "$env:TEMP\agm-monitor-test-state.json" `
  -Simulation Failure
```

Run the failure command twice. Exactly one outage email must be delivered. Run it a
third time to prove deduplication, then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Monitor-AGM-Services.ps1 `
  -StatePath "$env:TEMP\agm-monitor-test-state.json" `
  -Simulation Recovery
```

Exactly one recovery email must be delivered.

## Validation record — 2026-07-25

The final operator screenshot supplied in Turn AGM records the following:

- `Configuration saved: C:\ProgramData\AGM\monitor\config.json`;
- the SMTP credential was encrypted for the current Windows user;
- the configuration script returned normally to the PowerShell prompt;
- the later controlled sequence `Failure -> Deduplication -> Recovery -> SMTP ->
  Inbox` passed in full;
- two alert messages and two recovery messages were received by
  `adrianmuscalu2@gmail.com`.

The screenshot is treated as operator evidence associated with this validation
record. It is not copied into the repository because the original attachment is
held in the Turn AGM audit conversation and shows local configuration context.

Final result: **PASS**.

### Non-blocking implementation observation

During configuration, `icacls` printed:

```text
Invalid parameter: "(OI)(CI)F"
```

The message did not prevent `config.json` or the encrypted credential from being
written and did not affect the subsequent SMTP tests.

Probable cause, based on inspection of `Configure-AGM-Monitor.ps1`: the expression
`"$env:USERNAME:(OI)(CI)F"` can be parsed ambiguously by Windows PowerShell at the
boundary between the environment-variable reference and the ACL suffix. This may
leave `icacls` receiving only `(OI)(CI)F` as the grant parameter.

This is recorded for later improvement only. No script or ACL behavior was changed
as part of this documentation update. Any remediation requires a separate approved
implementation and a before/after ACL test.

## Rollback

Disable without modifying AGM or PostgreSQL:

```powershell
Stop-ScheduledTask -TaskName 'AGM Service Monitor'
Disable-ScheduledTask -TaskName 'AGM Service Monitor'
```

Remove only the monitor task:

```powershell
Unregister-ScheduledTask -TaskName 'AGM Service Monitor' -Confirm:$false
```
