param([Parameter(Mandatory = $true)][string]$OutputRoot)
$ErrorActionPreference='Stop'
$collector=Join-Path $PSScriptRoot 'Invoke-HostContentionReadOnlyInvestigation.ps1'
$output=[IO.Path]::GetFullPath($OutputRoot); [IO.Directory]::CreateDirectory($output)|Out-Null
$log=[ordered]@{contract='agm-controlled-host-baseline-mutex-isolation.v1';startedAt=[DateTimeOffset]::UtcNow.ToString('o');actions=@();p9='STOPPED';killSwitch='ACTIVE';soakRestarted=$false;containersStopped=0}
function Save-Log { $log|ConvertTo-Json -Depth 12|Set-Content (Join-Path $output 'mutex-isolation-actions.json') -Encoding UTF8 }
function Add-Log($action,$result,$details){$log.actions+=@([pscustomobject]@{at=[DateTimeOffset]::UtcNow.ToString('o');action=$action;result=$result;details=$details});Save-Log}

$mutex=$null; $mutexHeld=$false; $supervisorStopped=$false
try {
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
  $principal=New-Object Security.Principal.WindowsPrincipal($identity)
  $isAdmin=$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  [ordered]@{capturedAt=[DateTimeOffset]::UtcNow.ToString('o');identity=$identity.Name;isElevatedAdministrator=$isAdmin;uacExpected=$true;credentialsRecorded=$false;processId=$PID} | ConvertTo-Json | Set-Content (Join-Path $output 'elevation-evidence.json') -Encoding UTF8
  if(-not $isAdmin){throw 'ELEVATED_ADMINISTRATOR_TOKEN_REQUIRED'}

  $task=Get-ScheduledTask -TaskName 'AGM Services' -TaskPath '\'
  $taskAction=$task.Actions|Select-Object -First 1
  if($taskAction.Execute -ne 'powershell.exe' -or $taskAction.Arguments -notmatch 'Start-AGM-Services\.ps1' -or $taskAction.WorkingDirectory -ne [string](Resolve-Path (Join-Path $PSScriptRoot '..'))){throw 'AGM_TASK_ACTION_IDENTITY_MISMATCH'}
  $all=@(Get-CimInstance Win32_Process); $byPid=@{}; foreach($p in $all){$byPid[[int]$p.ProcessId]=$p}
  $listener=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop|Select-Object -First 1
  $apiPid=[int]$listener.OwningProcess; $chain=@(); $cursor=$apiPid
  while($cursor -and $byPid.ContainsKey($cursor)){$p=$byPid[$cursor];$chain+=@([pscustomobject]@{pid=[int]$p.ProcessId;parentPid=[int]$p.ParentProcessId;name=[string]$p.Name;creationAt=([DateTimeOffset]$p.CreationDate).ToUniversalTime().ToString('o')});if([int]$p.ParentProcessId -eq 1596){break};$cursor=[int]$p.ParentProcessId}
  $supervisor=$chain|Where-Object{$_.name -eq 'powershell.exe' -and $_.parentPid -eq 1596}|Select-Object -First 1
  if(-not $supervisor){throw 'AGM_SUPERVISOR_IDENTITY_NOT_PROVEN_FROM_PORT_3000_LINEAGE'}
  $supervisorCim=$byPid[[int]$supervisor.pid]; $apiCim=$byPid[$apiPid]
  if($supervisorCim.CommandLine -notmatch 'Start-AGM-Services\.ps1'){throw 'AGM_SUPERVISOR_COMMAND_IDENTITY_MISMATCH'}
  if($apiCim.Name -ne 'node.exe' -or -not $apiCim.CommandLine){throw 'AGM_API_COMMAND_IDENTITY_MISMATCH'}
  [ordered]@{capturedAt=[DateTimeOffset]::UtcNow.ToString('o');task=[ordered]@{name=$task.TaskName;path=$task.TaskPath;state=[string]$task.State;enabled=$task.Settings.Enabled;execute=$taskAction.Execute;arguments=$taskAction.Arguments;workingDirectory=$taskAction.WorkingDirectory};port=[ordered]@{number=3000;state='LISTEN';owningPid=$apiPid};supervisor=[ordered]@{pid=$supervisor.pid;parentPid=$supervisor.parentPid;name=$supervisor.name;creationAt=$supervisor.creationAt;commandLine=$supervisorCim.CommandLine};api=[ordered]@{pid=$apiPid;parentPid=[int]$apiCim.ParentProcessId;name=$apiCim.Name;creationAt=([DateTimeOffset]$apiCim.CreationDate).ToUniversalTime().ToString('o');commandLine=$apiCim.CommandLine};lineage=$chain;containers=@(docker ps --no-trunc --format '{{json .}}'|%{$_|ConvertFrom-Json})} | ConvertTo-Json -Depth 12 | Set-Content (Join-Path $output 'validated-targets-before-isolation.json') -Encoding UTF8

  try {
    Stop-Process -Id $supervisor.pid -Force -ErrorAction Stop
  } catch {
    & taskkill.exe /PID $supervisor.pid /F | Out-Null
    if($LASTEXITCODE -ne 0){throw "AGM_SUPERVISOR_TERMINATION_ACCESS_DENIED_$($supervisor.pid)"}
  }
  $supervisorStopped=$true
  Add-Log 'STOP_AGM_SUPERVISOR_INSTANCE' 'SUCCESS' @{pid=$supervisor.pid;creationAt=$supervisor.creationAt;reversible=$true}
  $mutex=New-Object Threading.Mutex($false,'Local\AGM-Service-Supervisor')
  $mutexHeld=$mutex.WaitOne(10000,$false); if(-not $mutexHeld){throw 'AGM_SUPERVISOR_MUTEX_NOT_ACQUIRED'}
  Add-Log 'HOLD_AGM_SUPERVISOR_MUTEX' 'SUCCESS' @{purpose='prevent two-minute trigger from restarting API';reversible=$true}
  foreach($entry in @($chain|Where-Object pid -ne $supervisor.pid)){
    if(Get-Process -Id $entry.pid -ErrorAction SilentlyContinue){Stop-Process -Id $entry.pid -Force -ErrorAction Stop}
  }
  Start-Sleep 2
  if(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue){throw 'PORT_3000_STILL_LISTENING_AFTER_ISOLATION'}
  Add-Log 'STOP_AGM_API_LINEAGE' 'SUCCESS' @{stopped=@($chain|Where-Object pid -ne $supervisor.pid);port3000Released=$true;containersPreserved=2}

  & $collector -Output (Join-Path $output 'baseline-stabilized-1.json') -DurationSeconds 300 -SampleIntervalSeconds 5
  & $collector -Output (Join-Path $output 'baseline-stabilized-2.json') -DurationSeconds 300 -SampleIntervalSeconds 5
} finally {
  if($mutexHeld){$mutex.ReleaseMutex();$mutexHeld=$false;Add-Log 'RELEASE_AGM_SUPERVISOR_MUTEX' 'SUCCESS' @{released=$true}}
  if($mutex){$mutex.Dispose()}
  if($supervisorStopped){
    & schtasks.exe /Run /TN '\AGM Services'|Out-Null
    $runExit=$LASTEXITCODE; Add-Log 'RESTORE_AGM_SERVICES_TASK' $(if($runExit -eq 0){'SUCCESS'}else{'FAILURE'}) @{schtasksExitCode=$runExit}
    $deadline=(Get-Date).AddSeconds(120);$health=$false
    while((Get-Date)-lt $deadline -and -not $health){try{$r=Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/health/live' -TimeoutSec 3;$health=$r.data.status -eq 'ok'}catch{$health=$false};if(-not $health){Start-Sleep 3}}
    Add-Log 'VERIFY_RESTORATION' $(if($health){'SUCCESS'}else{'FAILURE'}) @{health=$health;port3000Listening=[bool](Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue);containers=@(docker ps --format '{{.Names}}:{{.Status}}')}
  }
}
& $collector -Output (Join-Path $output 'inventory-after-restoration.json') -DurationSeconds 20 -SampleIntervalSeconds 2
$log.completedAt=[DateTimeOffset]::UtcNow.ToString('o');Save-Log
Write-Output "CONTROLLED_HOST_BASELINE_MUTEX_ISOLATION_CAPTURED $output"
