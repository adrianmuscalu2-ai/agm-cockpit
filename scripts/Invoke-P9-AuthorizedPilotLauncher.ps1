[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('ContractSimulation','AuthorizedPilot')][string]$Mode,
  [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$ConfigurationPath,
  [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$FrozenManifestPath,
  [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$OutputRoot
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $PSScriptRoot 'p9-pilot-exit-code-contract.psm1') -Force

function Write-JsonAtomic([string]$Path, [object]$Value) {
  $temporary = "$Path.tmp"; $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $temporary -Encoding UTF8
  Move-Item -LiteralPath $temporary -Destination $Path -Force
}
function Get-Inventory([string]$Phase, [int]$LauncherPid) {
  try { $all = @(Get-CimInstance Win32_Process -ErrorAction Stop) } catch { throw 'P9_CIM_INVENTORY_UNAVAILABLE' }
  $tokens = @('p9-authorized-pilot-runner','Invoke-P9-AuthorizedPilotLauncher')
  $processes = @($all | Where-Object { $process = $_; $process.CommandLine -and @($tokens | Where-Object { $process.CommandLine -like "*$_*" }).Count -gt 0 } | ForEach-Object {
    [ordered]@{ pid=[int]$_.ProcessId; parentPid=[int]$_.ParentProcessId; name=[string]$_.Name; identity=if ($_.ProcessId -eq $LauncherPid) {'P9_INTERNAL_PILOT_LAUNCHER'} elseif ($_.CommandLine -like '*p9-authorized-pilot-runner.ts*') {'P9_INTERNAL_PILOT_RUNNER'} else {'P9_INTERNAL_PILOT_CONTROL_HOST'} }
  })
  [ordered]@{ contract='agm-p9-internal-process-inventory.v2'; phase=$Phase; capturedAt=(Get-Date).ToUniversalTime().ToString('o'); processes=$processes; count=$processes.Count }
}
function Assert-FrozenManifest([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'P9_FROZEN_MANIFEST_MISSING' }
  $manifest = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  if ($manifest.contract -ne 'agm-p9-internal-pilot-frozen-manifest.v2') { throw 'P9_FROZEN_MANIFEST_CONTRACT_INVALID' }
  foreach ($entry in $manifest.files) {
    $absolute = Join-Path $root $entry.path
    if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) { throw 'P9_FROZEN_ARTIFACT_MISSING' }
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $absolute).Hash -ne $entry.sha256) { throw 'P9_FROZEN_ARTIFACT_HASH_MISMATCH' }
  }
  return $manifest
}

$configuration = Get-Content -Raw -LiteralPath $ConfigurationPath | ConvertFrom-Json
foreach ($name in @('executionId','workload','operationCount','cadenceMs','timeoutMs','maximumWindowMs')) { if ($null -eq $configuration.$name) { throw "P9_REQUIRED_PARAMETER_MISSING_$name" } }
if ($configuration.workload -ne 'READ_ONLY_LEASE_COMMIT') { throw 'P9_WORKLOAD_NOT_AUTHORIZED' }
if ($Mode -eq 'ContractSimulation' -and $env:AGM_P9_ENABLED -eq 'true') { throw 'P9_SIMULATION_REQUIRES_FLAG_OFF' }
if ($Mode -eq 'AuthorizedPilot' -and $env:AGM_P9_INTERNAL_PILOT_AUTHORIZATION -ne 'OWNER_SINGLE_WINDOW') { throw 'P9_INTERNAL_PILOT_AUTHORIZATION_MISSING' }
$frozen = Assert-FrozenManifest $FrozenManifestPath
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
$before = Get-Inventory 'BEFORE' $PID
if (@($before.processes | Where-Object { $_.identity -eq 'P9_INTERNAL_PILOT_RUNNER' }).Count -ne 0) { throw 'P9_RUNNER_ALREADY_ACTIVE' }
Write-JsonAtomic (Join-Path $OutputRoot 'process-inventory-before.json') $before
$resultPath = Join-Path $OutputRoot 'runner-result.json'; $stdout = Join-Path $OutputRoot 'runner.stdout.log'; $stderr = Join-Path $OutputRoot 'runner.stderr.log'
$runner = $null; $failure = $null
try {
  $runner = Start-Process pnpm.cmd -ArgumentList @('exec','tsx','scripts/p9-authorized-pilot-runner.ts',$Mode,$ConfigurationPath,$resultPath) -WorkingDirectory $root -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
  if (-not $runner.WaitForExit([int]$configuration.maximumWindowMs + 30000)) { throw 'P9_INTERNAL_RUNNER_WINDOW_TIMEOUT' }
  $resultValid = Test-P9RunnerResultArtifact -Path $resultPath
  $exitOutcome = Resolve-P9RunnerExitOutcome -ProcessCompleted $runner.HasExited -ExitCode $runner.ExitCode -ResultArtifactValid $resultValid
  if (-not $exitOutcome.pass) { throw $exitOutcome.code }
  if (-not $resultValid) { throw 'P9_INTERNAL_RUNNER_EVIDENCE_MISSING' }
} catch { $failure = $_.Exception.Message } finally {
  if ($runner -and -not $runner.HasExited) { & taskkill.exe /PID $runner.Id /T /F 2>$null | Out-Null; [void]$runner.WaitForExit(10000) }
}
$after = Get-Inventory 'AFTER_RUNNER_EXIT' $PID
$remaining = @($after.processes | Where-Object { $_.identity -eq 'P9_INTERNAL_PILOT_RUNNER' })
$after['runnerRemaining'] = $remaining.Count
Write-JsonAtomic (Join-Path $OutputRoot 'process-inventory-after.json') $after
$verdict = if (-not $failure -and $remaining.Count -eq 0) {'PASS'} else {'FAIL'}
$summary = [ordered]@{ contract='agm-p9-internal-pilot-launcher-summary.v2'; mode=$Mode; executionId=$configuration.executionId; launcherPid=$PID; runnerPid=if($runner){$runner.Id}else{0}; failure=$failure; runnerRemaining=$remaining.Count; p9Final='OFF'; trafficFinal=0; autostart=$false; persistentKillSwitch=[ordered]@{ state='ACTIVE'; source='config/copilot-v1.2/p9-pilot-policy.json' }; officialSoakRestarted=$false; resultContract=[ordered]@{ source='LAUNCHER_SUMMARY'; rawLastExitCodeIgnored=$true; outcome=$verdict }; verdict=$verdict }
Write-JsonAtomic (Join-Path $OutputRoot 'launcher-summary.json') $summary
$sources = @($frozen.files | ForEach-Object { [ordered]@{ path=$_.path; sha256=$_.sha256; category='FROZEN_SOURCE' } })
$evidence = @(Get-ChildItem -LiteralPath $OutputRoot -File | Where-Object Name -ne 'SHA256SUMS.json' | Sort-Object Name | ForEach-Object { [ordered]@{ path=$_.Name; sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash; category='EVIDENCE' } })
Write-JsonAtomic (Join-Path $OutputRoot 'SHA256SUMS.json') ([ordered]@{ contract='agm-p9-internal-pilot-manifest.v2'; frozenManifestSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $FrozenManifestPath).Hash; files=@($sources+$evidence); verdict=$verdict })
$summary | ConvertTo-Json -Depth 8
if ($verdict -ne 'PASS') { exit 1 }
