param(
  [string]$Workspace = (Split-Path -Parent $PSScriptRoot),
  [string]$StatePath = "evidence/governance/copilot-v1.2/p9/soak/soak-state.json"
)

$ErrorActionPreference = 'Stop'
$stateFullPath = Join-Path $Workspace $StatePath
$soakRoot = Split-Path -Parent $stateFullPath
New-Item -ItemType Directory -Path $soakRoot -Force | Out-Null

if (Test-Path -LiteralPath $stateFullPath) {
  $state = Get-Content -Raw -LiteralPath $stateFullPath | ConvertFrom-Json
} else {
  $startedAt = (Get-Date).ToUniversalTime()
  $state = [ordered]@{
    contract = 'agm-copilot-v1.2-p9-soak-state.v1'
    startedAt = $startedAt.ToString('o')
    notBeforeFinalAt = $startedAt.AddDays(7).ToString('o')
    requiredDays = 7
    status = 'ACTIVE'
    checkpoints = @()
    stopReason = $null
  }
}

if ($state.status -eq 'STOP_IMMEDIATE') { exit 2 }

$timestamp = (Get-Date).ToUniversalTime()
$dayKey = $timestamp.ToString('yyyy-MM-dd')
$checkpointDir = Join-Path $soakRoot "checkpoints/$dayKey"
New-Item -ItemType Directory -Path $checkpointDir -Force | Out-Null

function Invoke-Probe([string]$Name, [string]$Command) {
  $started = Get-Date
  $output = & cmd.exe /d /s /c $Command 2>&1 | Out-String
  $exitCode = $LASTEXITCODE
  [ordered]@{
    name = $Name
    pass = ($exitCode -eq 0)
    exitCode = $exitCode
    durationMs = [math]::Round(((Get-Date) - $started).TotalMilliseconds, 2)
    summary = (($output -split "`r?`n") | Where-Object { $_ -match 'PASS|FAIL|availability=|SOAK' } | Select-Object -Last 3) -join ' | '
  }
}

Push-Location $Workspace
try {
  $probes = @(
    (Invoke-Probe 'P9_KILL_SWITCH_RUNTIME' 'pnpm.cmd exec tsx scripts/test-copilot-v1-2-p9-pilot.ts'),
    (Invoke-Probe 'P8_CANONICAL_CHAIN' 'pnpm.cmd exec tsx scripts/test-copilot-v1-2-p8-migration.ts'),
    (Invoke-Probe 'P7_TURN_CUSTODIAN' 'pnpm.cmd exec tsx scripts/test-copilot-v1-2-p7-turn-hardening.ts'),
    (Invoke-Probe 'BASIC_ISOLATION' 'node scripts/test-copilot-v1-2-p0-fault-isolation.mjs')
  )
} finally { Pop-Location }

$basicReportPath = Join-Path $Workspace 'evidence/governance/copilot-v1.2/p0/runtime/basic-isolation-fault-injection-report.json'
$basic = if (Test-Path -LiteralPath $basicReportPath) { Get-Content -Raw -LiteralPath $basicReportPath | ConvertFrom-Json } else { $null }
$materialFailure = ($probes | Where-Object { -not $_.pass }).Count -gt 0
if ($basic -and ($basic.availabilityPercent -lt 100 -or $basic.latencyMs.p95 -gt 1000 -or $basic.latencyMs.max -gt 3000)) { $materialFailure = $true }

$checkpoint = [ordered]@{
  contract = 'agm-copilot-v1.2-p9-daily-checkpoint.v1'
  checkpointAt = $timestamp.ToString('o')
  dayKey = $dayKey
  status = if ($materialFailure) { 'STOP_IMMEDIATE' } else { 'HEALTHY' }
  scope = [ordered]@{ readOnly = $true; lowRisk = $true; singleTenant = $true; internalOnly = $true; externalWrites = 0; productionChanges = 0; newScopes = 0; newSecrets = 0; newPermissions = 0 }
  probes = $probes
  basic = if ($basic) { [ordered]@{ samples = $basic.samples; availabilityPercent = $basic.availabilityPercent; p95Ms = $basic.latencyMs.p95; maxMs = $basic.latencyMs.max; verdict = $basic.verdict } } else { $null }
  killSwitchReady = ($probes[0].pass)
  rollbackReady = ($probes[0].pass -and $probes[1].pass -and $probes[2].pass)
  turnReflection = if ($probes[2].pass) { 'PASS' } else { 'GOVERNANCE_DEFECT' }
  secretExposure = 'ZERO_BY_SANITIZED_CONTRACT'
}

$checkpointPath = Join-Path $checkpointDir 'daily-health.json'
$checkpoint | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $checkpointPath -Encoding utf8
$existing = @($state.checkpoints | Where-Object { $_.dayKey -ne $dayKey })
$state.checkpoints = @($existing + [pscustomobject]@{ dayKey = $dayKey; checkpointAt = $checkpoint.checkpointAt; status = $checkpoint.status; evidence = $checkpointPath.Substring($Workspace.Length + 1).Replace('\','/') })
if ($materialFailure) { $state.status = 'STOP_IMMEDIATE'; $state.stopReason = 'DAILY_CHECKPOINT_MATERIAL_FAILURE' }
$state | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $stateFullPath -Encoding utf8

Write-Output "P9 SOAK CHECKPOINT - $($checkpoint.status) / $dayKey"
if ($materialFailure) { exit 2 }
