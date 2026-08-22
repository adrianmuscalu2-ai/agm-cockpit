$ErrorActionPreference = 'Stop'

$taskName = 'AGM Persistent Runtime Bootstrap'
$taskPath = '\'
$principalUser = "$env:USERDOMAIN\adria"
$entrypoint = (Resolve-Path (Join-Path $PSScriptRoot '..\deploy\runtime\bootstrap.ps1')).Path
$taskFile = Join-Path $env:WINDIR 'System32\Tasks\AGM Persistent Runtime Bootstrap'
$taskCacheRoot = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Schedule\TaskCache'

if ($env:USERNAME -ne 'adria') { throw "INSTALLER_IDENTITY_REQUIRED:adria:$env:USERNAME" }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'INSTALLER_REQUIRES_NATIVE_ADMINISTRATOR' }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -File `"$entrypoint`"" -WorkingDirectory (Split-Path $entrypoint)
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $principalUser
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $principalUser -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::FromMinutes(5))

Register-ScheduledTask -TaskName $taskName -TaskPath $taskPath -Action $action -Trigger $trigger -Principal $taskPrincipal -Settings $settings `
  -Description 'AGM persistent runtime bootstrap; direct transparent PowerShell entrypoint.' -Force | Out-Null

$task = Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction Stop
$info = Get-ScheduledTaskInfo -TaskName $taskName -TaskPath $taskPath -ErrorAction Stop
$xml = Export-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction Stop

if ($task.TaskName -ne $taskName -or $task.TaskPath -ne $taskPath -or -not $task.Settings.Enabled) { throw 'TASK_REGISTRATION_VERIFY_FAILED:identity-or-enabled' }
if ($task.Principal.UserId -ne $principalUser -or $task.Principal.LogonType -ne 'Interactive' -or $task.Principal.RunLevel -ne 'Highest') { throw 'TASK_REGISTRATION_VERIFY_FAILED:principal' }
if ($task.Triggers.Count -ne 1 -or $task.Triggers[0].CimClass.CimClassName -ne 'MSFT_TaskLogonTrigger') { throw 'TASK_REGISTRATION_VERIFY_FAILED:trigger' }
if ($task.Actions.Count -ne 1 -or $task.Actions[0].Execute -notmatch '(^|\\)powershell\.exe$' -or $task.Actions[0].Arguments -notlike "*-NoProfile -File*$entrypoint*") { throw 'TASK_REGISTRATION_VERIFY_FAILED:action' }
if ($task.Actions[0].Arguments -match 'cmd\.exe|ExecutionPolicy\s+Bypass|WindowStyle\s+Hidden|AGM_SECRET_REF_|AGM_SECRET_VALUE' -or $xml -match 'AGM_SECRET_REF_|AGM_SECRET_VALUE') { throw 'TASK_REGISTRATION_VERIFY_FAILED:unsafe-or-secret-material' }
if (-not (Test-Path -LiteralPath $taskFile -PathType Leaf)) { throw 'TASK_REGISTRATION_VERIFY_FAILED:task-file' }
$tree = Get-ChildItem -LiteralPath "$taskCacheRoot\Tree" -Recurse -ErrorAction Stop | Where-Object { $_.PSPath -match [regex]::Escape($taskName) }
if (-not $tree) { throw 'TASK_REGISTRATION_VERIFY_FAILED:taskcache-tree' }

$probe = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-File',$entrypoint,'-IndependentReadOnlyValidation') -Wait -PassThru
if ($probe.ExitCode -ne 0) { throw 'TASK_REGISTRATION_VERIFY_FAILED:independent-process' }

[pscustomobject]@{ TaskName=$task.TaskName; TaskPath=$task.TaskPath; Enabled=$task.Settings.Enabled; Principal=$task.Principal.UserId; Trigger='AtLogOn'; Action=$task.Actions[0].Execute; Arguments=$task.Actions[0].Arguments; LastRunTime=$info.LastRunTime; LastTaskResult=$info.LastTaskResult; TaskFile=$taskFile; TaskCache='PASS'; IndependentProcess='PASS' }
