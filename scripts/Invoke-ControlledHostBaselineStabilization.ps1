param([Parameter(Mandatory = $true)][string]$OutputRoot)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$collector = Join-Path $PSScriptRoot 'Invoke-HostContentionReadOnlyInvestigation.ps1'
$output = [IO.Path]::GetFullPath($OutputRoot)
[IO.Directory]::CreateDirectory($output) | Out-Null
$taskName = 'AGM Services'
$taskPath = '\'
$actionLog = [ordered]@{ contract='agm-controlled-host-baseline-stabilization.v1'; startedAt=[DateTimeOffset]::UtcNow.ToString('o'); actions=@(); restrictions=[ordered]@{p9='STOPPED';killSwitch='ACTIVE';soakRestarted=$false;basicSloMs=3000;containersStopped=0;windowsCriticalProcessesStopped=0} }

function Add-Action([string]$name,[string]$result,$details) {
  $actionLog.actions += [pscustomobject]@{ at=[DateTimeOffset]::UtcNow.ToString('o'); action=$name; result=$result; details=$details }
  $actionLog | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $output 'stabilization-actions.json') -Encoding UTF8
}

& $collector -Output (Join-Path $output 'inventory-before-action.json') -DurationSeconds 20 -SampleIntervalSeconds 2
$task = Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath
$taskInfo = $task | Get-ScheduledTaskInfo
$initial = [ordered]@{ enabled=$task.Settings.Enabled; state=[string]$task.State; lastRunTime=$taskInfo.LastRunTime.ToUniversalTime().ToString('o'); nextRunTime=$taskInfo.NextRunTime.ToUniversalTime().ToString('o'); actions=@($task.Actions|Select-Object Execute,Arguments,WorkingDirectory) }
$initial | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $output 'task-state-before.json') -Encoding UTF8

$restorationRequired = $false
try {
  Disable-ScheduledTask -TaskName $taskName -TaskPath $taskPath | Out-Null
  $restorationRequired = $true
  Add-Action 'DISABLE_AGM_SERVICES_TASK' 'SUCCESS' @{ reversible=$true; restore='Enable-ScheduledTask' }
  Stop-ScheduledTask -TaskName $taskName -TaskPath $taskPath -ErrorAction SilentlyContinue
  Add-Action 'STOP_AGM_SERVICES_TASK_INSTANCE' 'SUCCESS' @{ reversible=$true; restore='Start-ScheduledTask' }

  Start-Sleep -Seconds 3
  $listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  $stopped = @()
  if ($listener) {
    $targetPid = [int]$listener.OwningProcess
    $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $targetPid"
    if ($cim.Name -ne 'node.exe') { throw "PORT_3000_OWNER_NOT_EXPECTED_NODE_$targetPid" }
    Stop-Process -Id $targetPid -Force
    $stopped += [pscustomobject]@{ pid=$targetPid; parentPid=[int]$cim.ParentProcessId; name=$cim.Name; creationAt=([DateTimeOffset]$cim.CreationDate).ToUniversalTime().ToString('o'); role='AGM_API_PORT_3000_OWNER' }
  }
  Add-Action 'STOP_LOCAL_AGM_API' 'SUCCESS' @{ stopped=$stopped; port3000Released=(-not [bool](Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)); containersPreserved=2 }

  & $collector -Output (Join-Path $output 'baseline-stabilized-1.json') -DurationSeconds 300 -SampleIntervalSeconds 5
  & $collector -Output (Join-Path $output 'baseline-stabilized-2.json') -DurationSeconds 300 -SampleIntervalSeconds 5
} finally {
  if ($restorationRequired) {
    Enable-ScheduledTask -TaskName $taskName -TaskPath $taskPath | Out-Null
    Start-ScheduledTask -TaskName $taskName -TaskPath $taskPath
    Add-Action 'RESTORE_AGM_SERVICES_TASK' 'SUCCESS' @{ enabled=$true; started=$true }
    $deadline=(Get-Date).AddSeconds(120); $health=$false
    while((Get-Date)-lt $deadline -and -not $health){
      try { $response=Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/health/live' -TimeoutSec 3; $health=$response.data.status -eq 'ok' } catch { $health=$false }
      if(-not $health){Start-Sleep -Seconds 3}
    }
    Add-Action 'VERIFY_AGM_SERVICES_RESTORATION' $(if($health){'SUCCESS'}else{'FAILURE'}) @{ health=$health; port3000Listening=[bool](Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue); containers=@(docker ps --format '{{.Names}}:{{.Status}}') }
  }
}

& $collector -Output (Join-Path $output 'inventory-after-restoration.json') -DurationSeconds 20 -SampleIntervalSeconds 2
$taskAfter=Get-ScheduledTask -TaskName $taskName -TaskPath $taskPath; $infoAfter=$taskAfter|Get-ScheduledTaskInfo
[ordered]@{capturedAt=[DateTimeOffset]::UtcNow.ToString('o');enabled=$taskAfter.Settings.Enabled;state=[string]$taskAfter.State;lastRunTime=$infoAfter.LastRunTime.ToUniversalTime().ToString('o');nextRunTime=$infoAfter.NextRunTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'task-state-after.json') -Encoding UTF8
$actionLog.completedAt=[DateTimeOffset]::UtcNow.ToString('o'); $actionLog | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $output 'stabilization-actions.json') -Encoding UTF8
Write-Output "CONTROLLED_HOST_BASELINE_STABILIZATION_CAPTURED $output"
