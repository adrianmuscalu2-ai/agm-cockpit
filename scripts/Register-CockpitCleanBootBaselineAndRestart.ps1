param([Parameter(Mandatory=$true)][string]$OutputRoot)
$ErrorActionPreference='Stop'
$identity=[Security.Principal.WindowsIdentity]::GetCurrent();$principal=New-Object Security.Principal.WindowsPrincipal($identity)
if(-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'ELEVATED_ADMINISTRATOR_TOKEN_REQUIRED'}
$collector=(Resolve-Path (Join-Path $PSScriptRoot 'Invoke-CockpitCleanBootBaseline.ps1')).Path
$output=[IO.Path]::GetFullPath($OutputRoot);[IO.Directory]::CreateDirectory($output)|Out-Null
$taskName='AGM Cockpit Clean Boot Baseline'
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$collector`" -OutputRoot `"$output`"" -WorkingDirectory (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$trigger=New-ScheduledTaskTrigger -AtStartup
$principalSpec=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -MultipleInstances IgnoreNew -RestartCount 0 -StartWhenAvailable
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principalSpec -Settings $settings -Description 'One-shot Cockpit PC clean-boot baseline; self-deletes after capture.' -Force | Out-Null
$registered=Get-ScheduledTask -TaskName $taskName
[ordered]@{contract='agm-cockpit-clean-boot-task-registration.v1';registeredAt=[DateTimeOffset]::UtcNow.ToString('o');identity=$identity.Name;elevatedAdministrator=$true;taskName=$registered.TaskName;taskPath=$registered.TaskPath;state=[string]$registered.State;trigger='AT_STARTUP';runAs='SYSTEM';runLevel='HIGHEST';collector=$collector;outputRoot=$output;oneShotSelfDelete=$true;credentialsRecorded=$false} | ConvertTo-Json | Set-Content (Join-Path $output 'task-registration.json') -Encoding UTF8
shutdown.exe /r /t 30 /d p:0:0 /c 'AGM Cockpit controlled clean-boot baseline restart'
if($LASTEXITCODE -ne 0){throw "CONTROLLED_RESTART_SCHEDULING_FAILED_$LASTEXITCODE"}
[ordered]@{scheduledAt=[DateTimeOffset]::UtcNow.ToString('o');delaySeconds=30;machine=$env:COMPUTERNAME;fitnessLaptopTouched=$false;neonTouched=$false}|ConvertTo-Json|Set-Content (Join-Path $output 'restart-scheduled.json') -Encoding UTF8
