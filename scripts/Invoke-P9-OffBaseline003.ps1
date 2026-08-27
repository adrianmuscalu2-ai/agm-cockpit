[CmdletBinding()]param()
$ErrorActionPreference='Stop';$root=Split-Path -Parent $PSScriptRoot
$manifestPath=Join-Path $root 'evidence/governance/copilot-v1.2/p9/official-soak-baseline-freeze/p9-baseline-off-20260815-003/frozen-manifest.json'
$config='config/copilot-v1.2/p9-official-soak-baseline-closure-003.json';$thresholds='config/copilot-v1.2/p9-official-soak-readiness-thresholds.json';$output=Join-Path $root 'evidence/governance/copilot-v1.2/p9/official-soak-baseline/p9-baseline-off-20260815-003'
$identity=[Security.Principal.WindowsIdentity]::GetCurrent();$principal=[Security.Principal.WindowsPrincipal]::new($identity)
$high=& whoami.exe /groups /fo csv /nh|ConvertFrom-Csv -Header Name,Type,Sid,Attributes|Where-Object{$_.Sid-eq'S-1-16-12288'}
if(-not$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)-or-not$high){throw 'PRECHECK_SESSION_NOT_ADMINISTRATOR_HIGH_INTEGRITY'}
$manifest=Get-Content -Raw $manifestPath|ConvertFrom-Json
if($manifest.contract-ne'agm-p9-official-soak-baseline-frozen-manifest.v5'-or$manifest.baselineIdentity-ne'p9-baseline-off-20260815-003'-or@($manifest.files).Count-ne12){throw 'MANIFEST_CONTRACT_INVALID'}
foreach($entry in $manifest.files){$path=Join-Path $root $entry.path;if(-not(Test-Path $path)-or(Get-FileHash -Algorithm SHA256 $path).Hash-ne$entry.sha256){throw "MANIFEST_ARTIFACT_INVALID_$($entry.path)"}}
try{Get-CimInstance Win32_Process -ErrorAction Stop|Select-Object -First 1|Out-Null}catch{throw 'CIM_UNAVAILABLE'}
$policy=Get-Content -Raw (Join-Path $root 'config/copilot-v1.2/p9-pilot-policy.json')|ConvertFrom-Json
if($policy.featureFlag.default-ne$false-or$policy.featureFlag.autoStart-ne$false-or$policy.trafficAllowed-ne$false-or$policy.killSwitchDefault-ne'ACTIVE'-or$policy.officialSoakAutoStart-ne$false){throw 'P9_CONTAINMENT_PRECHECK_FAILED'}
if(Test-Path $output){throw 'OUTPUT_EXISTS_NO_RETRY'}
$tsx=Join-Path $root 'node_modules/.bin/tsx.cmd';$bundle=Join-Path $output 'collector-bundle.json';$report=Join-Path $output 'baseline-closure-report.json'
$producer=Start-Process $tsx -WorkingDirectory $root -Wait -PassThru -NoNewWindow -ArgumentList @('scripts/p9-soak-live-bundle-producer.ts',$config,$bundle)
if($null-eq$producer.ExitCode-or$producer.ExitCode-ne0-or-not(Test-Path $bundle)){throw "PRODUCER_FAILED_$($producer.ExitCode)"}
$evaluator=Start-Process $tsx -WorkingDirectory $root -Wait -PassThru -NoNewWindow -ArgumentList @('scripts/p9-soak-baseline-collector.ts',$config,$thresholds,$bundle,$report)
if($null-eq$evaluator.ExitCode-or$evaluator.ExitCode-ne0-or-not(Test-Path $report)){throw "EVALUATOR_FAILED_$($evaluator.ExitCode)"}
$result=Get-Content -Raw $report|ConvertFrom-Json;if($result.evaluation.pass-ne$true){throw 'EXPLICIT_RESULT_FAIL'}
$finalPath=Join-Path $output 'final-manifest.json';$files=@($bundle,$report)|ForEach-Object{[ordered]@{path=$_.Substring($root.Length).TrimStart('\').Replace('\','/');sha256=(Get-FileHash -Algorithm SHA256 $_).Hash}}
$final=[ordered]@{contract='agm-p9-off-baseline-final-manifest.v1';baselineIdentity='p9-baseline-off-20260815-003';files=$files;verified='2/2';result='PASS';p9='STOPPED';trafficAllowed=$false;killSwitch='ACTIVE'}
$tmp="$finalPath.tmp-$PID";$final|ConvertTo-Json -Depth 8|Set-Content $tmp -Encoding utf8;Move-Item $tmp $finalPath;$final|ConvertTo-Json -Depth 8
