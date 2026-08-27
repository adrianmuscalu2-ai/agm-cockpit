param([string]$TaskName='AGM P9 Daily Readiness Monitor',[string]$At='06:00')
$ErrorActionPreference='Stop';$runner=Join-Path $PSScriptRoot 'Invoke-P9-DailyMonitor.ps1'
if(-not(Test-Path $runner)){throw'DAILY_MONITOR_RUNNER_MISSING'}
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`" -Mode READINESS"
$trigger=New-ScheduledTaskTrigger -Daily -At $At;$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'AGM daily readiness/governance monitor. P9 remains STOPPED; this task does not run soak.' -Force|Out-Null
$task=Get-ScheduledTask -TaskName $TaskName;$actual=$task.Actions[0];if($actual.Arguments-notmatch'-Mode READINESS'){throw'DAILY_MONITOR_TASK_MODE_INVALID'}
Write-Output 'DAILY SOAK MONITOR - INSTALLED / READINESS ONLY'
