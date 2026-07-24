$ErrorActionPreference = 'Stop'
$taskName = 'AGM Service Monitor'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$monitor = Join-Path $PSScriptRoot 'Monitor-AGM-Services.ps1'
$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$monitor`""

if (-not (Test-Path -LiteralPath "$env:ProgramData\AGM\monitor\config.json")) {
  throw 'Configure the monitor first with scripts\Configure-AGM-Monitor.ps1.'
}

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument $arguments `
  -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 2)
$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive `
  -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Checks AGM local API and public access; sends deduplicated outage and recovery email alerts.' `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
