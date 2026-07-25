# AGM Windows autostart

The `AGM Services` scheduled task starts after the AGM Windows user logs in. A
two-minute recovery trigger rearms the supervisor if it is terminated later in the
same Windows session. `MultipleInstances=IgnoreNew` prevents duplicate supervisors.
It runs without a terminal window and supervises:

- Docker Desktop;
- the `agm-postgres` PostgreSQL container;
- AGM API on port `3000`.

Cloudflare Tunnel is independent and runs as the automatic Windows service `cloudflared`.

## Install or repair

Open PowerShell as Administrator from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Install-AGM-Autostart.ps1
```

The installer is idempotent and replaces the existing `AGM Services` task.

## Verify

```powershell
Get-ScheduledTask -TaskName 'AGM Services'
Get-ScheduledTaskInfo -TaskName 'AGM Services'
Get-Service cloudflared
Invoke-RestMethod http://127.0.0.1:3000/api/v1/health/ready
Invoke-RestMethod https://api.agmcockpit.com/api/v1/health/ready
```

Expected steady state:

- task state: `Running`;
- task result while active: `267009` / `0x00041301` (`currently running`);
- supervisor log: `AGM API and PostgreSQL are ready`;
- local and public readiness: HTTP 200.

For a finite exit-code check without replacing the persistent supervisor:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-AGM-Services.ps1 -RunOnce
```

Expected exit code: `0`.

Supervisor and API logs are stored under `.tmp/services/` and are excluded from Git.

## Rollback

To disable automatic startup without changing the application or database:

```powershell
Stop-ScheduledTask -TaskName 'AGM Services'
Disable-ScheduledTask -TaskName 'AGM Services'
```

To remove only the task:

```powershell
Unregister-ScheduledTask -TaskName 'AGM Services' -Confirm:$false
```

Task removal does not change the HTTPS or API commits. PostgreSQL data stays in the existing Docker volume.
