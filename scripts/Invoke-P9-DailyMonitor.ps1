param(
  [ValidateSet('READINESS','SOAK')][string]$Mode='READINESS',
  [string]$EvidenceRoot='',
  [string]$HealthUrl='http://127.0.0.1:3000/api/v1/health',
  [string]$KillSwitchPath='',
  [int]$StaleAfterHours=36,
  [switch]$NoHealthProbe,
  [switch]$SuppressExit,
  [ValidateSet('AUTO','PASS','FAIL')][string]$TestHealth='AUTO',
  [datetime]$NowUtc=[datetime]::MinValue
)
$ErrorActionPreference='Stop';$root=Split-Path -Parent $PSScriptRoot
if(-not $EvidenceRoot){$EvidenceRoot=Join-Path $root 'evidence/governance/copilot-v1.2/p9/daily-monitor'}
if(-not $KillSwitchPath){$KillSwitchPath=Join-Path $root 'evidence/governance/copilot-v1.2/p9/runtime/kill-switch-evidence.json'}
New-Item -ItemType Directory -Path $EvidenceRoot -Force|Out-Null
$at=if($NowUtc -eq [datetime]::MinValue){(Get-Date).ToUniversalTime()}else{$NowUtc.ToUniversalTime()};$day=$at.ToString('yyyy-MM-dd');$latestPath=Join-Path $EvidenceRoot 'latest.json'
$prior=$null;if(Test-Path $latestPath){try{$prior=Get-Content -Raw $latestPath|ConvertFrom-Json}catch{$prior=$null}}
$priorAgeHours=if($prior -and $prior.at){($at-([datetime]$prior.at).ToUniversalTime()).TotalHours}else{$null};$stale=($null-ne$priorAgeHours-and$priorAgeHours-gt$StaleAfterHours)
$kill=Get-Content -Raw $KillSwitchPath|ConvertFrom-Json;$healthStatus=0;$healthMs=0;$healthError=$null;$sw=[Diagnostics.Stopwatch]::StartNew()
if($TestHealth-eq'PASS'){$healthStatus=200}elseif($TestHealth-eq'FAIL'){$healthError='TEST_HEALTH_FAILURE'}elseif(-not$NoHealthProbe){$curlDiscardPath=[System.IO.Path]::GetTempFileName();try{$code=& curl.exe --silent --show-error --output $curlDiscardPath --write-out '%{http_code}' --max-time 3 $HealthUrl 2>$null;if($LASTEXITCODE-eq 0){$healthStatus=[int]$code}else{$healthError="CURL_EXIT_$LASTEXITCODE"}}catch{$healthError=$_.Exception.GetType().Name}finally{Remove-Item -LiteralPath $curlDiscardPath -Force -ErrorAction SilentlyContinue}}
$sw.Stop();$healthMs=$sw.Elapsed.TotalMilliseconds;$killHealthy=($kill.killSwitch-eq'PASS'-and$kill.orphans-eq 0)
$status=if(-not$killHealthy){'FAIL'}elseif($stale){'STALE'}elseif($healthStatus-ne 200){'DEGRADED'}elseif($Mode-eq'SOAK'){'HEALTHY'}else{'PASS'}
$alert=if($status-in@('FAIL','DEGRADED','STALE')){"$status`: DAILY_MONITOR_ATTENTION_REQUIRED"}else{$null}
$record=[ordered]@{contract='agm-p9-daily-readiness-monitor.v2';at=$at.ToString('o');day=$day;mode=$Mode;status=$status;turn=[ordered]@{p9=if($Mode-eq'READINESS'){'STOPPED'}else{'SOAK_ACTIVE'};killSwitch=if($killHealthy){'ACTIVE'}else{'FAIL'};dailyMonitor=$status;alert=$alert;lastObservationAt=$at.ToString('o')};freshness=[ordered]@{staleAfterHours=$StaleAfterHours;priorObservationAgeHours=if($null-ne$priorAgeHours){[math]::Round($priorAgeHours,2)}else{$null};stale=$stale};basicHealth=[ordered]@{url=$HealthUrl;status=$healthStatus;latencyMs=[math]::Round($healthMs,2);error=$healthError};externalWrites=0;secretAccess=0;evidencePreserved=$true;soakRestarted=($Mode-eq'SOAK');alert=$alert}
$history=Join-Path $EvidenceRoot 'history';New-Item -ItemType Directory -Path $history -Force|Out-Null;$stamp=$at.ToString('yyyyMMddTHHmmssfffZ');$record|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $history "$stamp.json") -Encoding utf8;$record|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $EvidenceRoot "$day.json") -Encoding utf8;$record|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $latestPath -Encoding utf8
if($alert){$record|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $EvidenceRoot "ALERT-$stamp.json") -Encoding utf8}
Write-Output "DAILY SOAK MONITOR - $status / P9 $($record.turn.p9)";if(-not$SuppressExit){if($status-eq'FAIL'){exit 2}elseif($status-in@('DEGRADED','STALE')){exit 3}}
