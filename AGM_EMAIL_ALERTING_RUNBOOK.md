# AGM email alerting runbook

## Scope

The monitor is independent from AGM Cockpit, Email Assistant, PostgreSQL and the
Cloudflare connector. It checks:

- `http://127.0.0.1:3000/api/v1/health/ready`;
- `https://api.agmcockpit.com/api/v1/health/ready`.

Two consecutive failures are required before an outage alert. Only one alert is sent
for the same outage. A separate recovery message is sent after the next successful
check. State is stored outside Git under:

```text
C:\ProgramData\AGM\monitor\state.json
```

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
