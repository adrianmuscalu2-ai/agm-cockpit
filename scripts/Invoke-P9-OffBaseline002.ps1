[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$manifestRelative = 'evidence/governance/copilot-v1.2/p9/official-soak-baseline-freeze/p9-baseline-off-20260815-002/frozen-manifest-self-match-fix.json'
$configurationRelative = 'config/copilot-v1.2/p9-official-soak-baseline-closure-002.json'
$thresholdsRelative = 'config/copilot-v1.2/p9-official-soak-readiness-thresholds.json'
$outputRelative = 'evidence/governance/copilot-v1.2/p9/official-soak-baseline/p9-baseline-off-20260815-002'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$integrity = & whoami.exe /groups /fo csv /nh | ConvertFrom-Csv -Header Name,Type,Sid,Attributes |
  Where-Object { $_.Sid -eq 'S-1-16-12288' }
if (-not $isAdministrator -or -not $integrity) { throw 'PRECHECK_SESSION_NOT_ADMINISTRATOR_HIGH_INTEGRITY' }

$manifestPath = Join-Path $root $manifestRelative
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
if ($manifest.contract -ne 'agm-p9-official-soak-baseline-frozen-manifest.v4' `
  -or $manifest.baselineIdentity -ne 'p9-baseline-off-20260815-002' `
  -or $manifest.liveProducer -ne 'scripts/p9-soak-live-bundle-producer.ts' `
  -or @($manifest.files).Count -ne 11) { throw 'BASELINE_FROZEN_MANIFEST_CONTRACT_INVALID' }
foreach ($entry in @($manifest.files)) {
  $path = Join-Path $root ([string]$entry.path)
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "BASELINE_ARTIFACT_MISSING_$($entry.path)" }
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash -ne [string]$entry.sha256) { throw "BASELINE_ARTIFACT_HASH_MISMATCH_$($entry.path)" }
}

try { Get-CimInstance Win32_Process -ErrorAction Stop | Select-Object -First 1 | Out-Null }
catch { throw 'BASELINE_CIM_PROCESS_INVENTORY_UNAVAILABLE' }

$policy = Get-Content -Raw -LiteralPath (Join-Path $root 'config/copilot-v1.2/p9-pilot-policy.json') | ConvertFrom-Json
if ($policy.featureFlag.default -ne $false -or $policy.featureFlag.autoStart -ne $false `
  -or $policy.trafficAllowed -ne $false -or $policy.killSwitchDefault -ne 'ACTIVE' `
  -or $policy.officialSoakAutoStart -ne $false) { throw 'BASELINE_P9_OFF_CONTAINMENT_PRECHECK_FAILED' }

$output = Join-Path $root $outputRelative
if (Test-Path -LiteralPath $output) { throw 'BASELINE_OUTPUT_ALREADY_EXISTS_NO_RETRY' }
$bundle = Join-Path $output 'collector-bundle.json'
$report = Join-Path $output 'baseline-closure-report.json'
$tsx = Join-Path $root 'node_modules/.bin/tsx.cmd'
if (-not (Test-Path -LiteralPath $tsx -PathType Leaf)) { throw 'BASELINE_TSX_RUNTIME_MISSING' }

$producer = Start-Process -FilePath $tsx -WorkingDirectory $root -Wait -PassThru -NoNewWindow -ArgumentList @(
  'scripts/p9-soak-live-bundle-producer.ts', $configurationRelative, $bundle
)
if ($null -eq $producer.ExitCode -or $producer.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $bundle -PathType Leaf)) {
  throw "BASELINE_LIVE_PRODUCER_FAILED_EXIT_$($producer.ExitCode)"
}
$evaluator = Start-Process -FilePath $tsx -WorkingDirectory $root -Wait -PassThru -NoNewWindow -ArgumentList @(
  'scripts/p9-soak-baseline-collector.ts', $configurationRelative, $thresholdsRelative, $bundle, $report
)
if ($null -eq $evaluator.ExitCode -or $evaluator.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $report -PathType Leaf)) {
  throw "BASELINE_EVALUATOR_FAILED_EXIT_$($evaluator.ExitCode)"
}
$result = Get-Content -Raw -LiteralPath $report | ConvertFrom-Json
if ($result.evaluation.pass -ne $true) { throw 'BASELINE_EXPLICIT_RESULT_CONTRACT_FAIL' }

$finalManifestPath = Join-Path $output 'final-manifest.json'
$files = @($bundle, $report) | ForEach-Object {
  [ordered]@{ path = $_.Substring($root.Length).TrimStart('\').Replace('\','/'); sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash }
}
$finalManifest = [ordered]@{ contract = 'agm-p9-off-baseline-final-manifest.v1'; baselineIdentity = 'p9-baseline-off-20260815-002'; files = $files; verified = '2/2'; result = 'PASS'; p9 = 'STOPPED'; trafficAllowed = $false; killSwitch = 'ACTIVE' }
$temporary = "$finalManifestPath.tmp-$PID"
$finalManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temporary -Encoding utf8
Move-Item -LiteralPath $temporary -Destination $finalManifestPath
$finalManifest | ConvertTo-Json -Depth 8
