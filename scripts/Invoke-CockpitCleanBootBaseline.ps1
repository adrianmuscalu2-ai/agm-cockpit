param([Parameter(Mandatory=$true)][string]$OutputRoot)
$ErrorActionPreference='Stop'
$collector=Join-Path $PSScriptRoot 'Invoke-HostContentionReadOnlyInvestigation.ps1'
$output=[IO.Path]::GetFullPath($OutputRoot);[IO.Directory]::CreateDirectory($output)|Out-Null
$statusPath=Join-Path $output 'status.json'
function Status($state,$details){[ordered]@{contract='agm-cockpit-clean-boot-baseline-status.v1';capturedAt=[DateTimeOffset]::UtcNow.ToString('o');state=$state;details=$details;p9='STOPPED';killSwitch='ACTIVE';officialSoakRestarted=$false;fitnessLaptopTouched=$false;neonTouched=$false}|ConvertTo-Json -Depth 8|Set-Content $statusPath -Encoding UTF8}
try {
  $os=Get-CimInstance Win32_OperatingSystem
  $boot=[DateTimeOffset]$os.LastBootUpTime
  [ordered]@{contract='agm-cockpit-clean-boot-context.v1';collectorStartedAt=[DateTimeOffset]::UtcNow.ToString('o');bootAt=$boot.ToUniversalTime().ToString('o');secondsSinceBoot=[Math]::Round(([DateTimeOffset]::Now-$boot).TotalSeconds,3);machine=$env:COMPUTERNAME;identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name;credentialsRecorded=$false} | ConvertTo-Json | Set-Content (Join-Path $output 'boot-context.json') -Encoding UTF8
  Status 'BASELINE_1_RUNNING' @{windowSeconds=300;trafficGenerated=$false}
  & $collector -Output (Join-Path $output 'baseline-immediate-after-boot.json') -DurationSeconds 300 -SampleIntervalSeconds 5
  Status 'BASELINE_2_RUNNING' @{windowSeconds=300;trafficGenerated=$false}
  & $collector -Output (Join-Path $output 'baseline-after-automatic-services.json') -DurationSeconds 300 -SampleIntervalSeconds 5
  $task=Get-ScheduledTask -TaskName 'AGM Services' -ErrorAction SilentlyContinue
  $listener=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue|Select-Object -First 1
  $health='UNAVAILABLE';try{$health=(Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/health/live' -TimeoutSec 5).data.status}catch{}
  [ordered]@{capturedAt=[DateTimeOffset]::UtcNow.ToString('o');agmServicesState=if($task){[string]$task.State}else{'NOT_FOUND'};agmServicesEnabled=if($task){$task.Settings.Enabled}else{$null};apiPort3000Listening=[bool]$listener;apiPid=if($listener){$listener.OwningProcess}else{$null};apiHealth=$health;containers=@(docker ps --format '{{.Names}}|{{.Status}}' 2>&1);p9='STOPPED';killSwitch='ACTIVE';officialSoakRestarted=$false} | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $output 'final-automatic-services-health.json') -Encoding UTF8
  Status 'COMPLETE' @{baselineWindows=2;windowSecondsEach=300;trafficGenerated=$false}
} catch {
  Status 'FAILED' @{type=$_.Exception.GetType().FullName;message=$_.Exception.Message}
  throw
} finally {
  & schtasks.exe /Delete /TN '\AGM Cockpit Clean Boot Baseline' /F | Out-Null
}
