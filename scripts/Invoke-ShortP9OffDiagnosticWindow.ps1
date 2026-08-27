param(
  [int]$Port = 3300,
  [int]$MaxBatches = 10,
  [int]$DiagnosticThresholdMs = 2000,
  [int]$ProcessSampleIntervalSeconds = 10,
  [string]$OutputRoot = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if ($MaxBatches -lt 1 -or $MaxBatches -gt 10) { throw 'SHORT_WINDOW_MAX_BATCHES_MUST_BE_1_TO_10' }
if ($DiagnosticThresholdMs -lt 1000 -or $DiagnosticThresholdMs -ge 3000) { throw 'SHORT_WINDOW_DIAGNOSTIC_THRESHOLD_INVALID' }
if ($ProcessSampleIntervalSeconds -lt 2) { throw 'SHORT_WINDOW_PROCESS_SAMPLE_INTERVAL_TOO_AGGRESSIVE' }

if (-not $OutputRoot) {
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
  $OutputRoot = Join-Path $root "evidence/governance/copilot-v1.2/p9/short-p9-off-diagnostic-window/$stamp"
}
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null

$authorization = [ordered]@{
  contract = 'agm-short-p9-off-diagnostic-window-authorization.v1'
  recordedAt = (Get-Date).ToUniversalTime().ToString('o')
  ownerDecision = 'AUTHORIZED_SINGLE_SHORT_WINDOW'
  singleWindow = $true
  p9 = 'STOPPED'
  killSwitch = 'ACTIVE'
  officialBasicSloMs = 3000
  officialBasicSloUnchanged = $true
  diagnosticThresholdMs = $DiagnosticThresholdMs
  diagnosticThresholdSemantics = 'EVIDENCE_TRIGGER_ONLY_NOT_SLO'
  maxBatches = $MaxBatches
  maxOfficialRequests = $MaxBatches * 180
  hostSamplerIntervalSeconds = 1
  processSamplerIntervalSeconds = $ProcessSampleIntervalSeconds
  stopPolicy = 'STOP_AFTER_COMPLETED_BATCH_CONTAINING_FIRST_DIAGNOSTIC_EVENT_OR_AT_MAX_BATCHES'
  automaticExtension = $false
  faultInjection = $false
  probeProfile = 'NATURAL_P9_OFF'
  syntheticControlProcesses = 0
  functionalChanges = 0
  speculativeOptimizations = 0
  productionChanges = 0
  externalWrites = 0
  officialSoakRestarted = $false
  clockDomain = [ordered]@{
    topology = 'SAME_WINDOWS_HOST_LOOPBACK'
    absoluteTimestamps = 'UTC_DATE_NOW'
    durations = 'MONOTONIC_PERFORMANCE_NOW'
    clientHostServerClockSkew = 'SAME_HOST_NO_REMOTE_CLOCK'
  }
  finalGate = 'STOP_OWNER_REVIEW'
}
$authorization | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputRoot 'short-window-authorization.json') -Encoding utf8

& (Join-Path $PSScriptRoot 'Invoke-RealBasicTimeoutInvestigation.ps1') `
  -Port $Port `
  -MaxBatches $MaxBatches `
  -MinimumBatches 1 `
  -TargetNaturalTimeouts 3 `
  -TargetFailureBatches 3 `
  -DiagnosticThresholdMs $DiagnosticThresholdMs `
  -StopOnFirstDiagnosticEvent `
  -ProcessSampleIntervalSeconds $ProcessSampleIntervalSeconds `
  -ProbeProfile 'NATURAL_P9_OFF' `
  -RunMode 'P9_OFF_SINGLE_SHORT_DIAGNOSTIC_WINDOW' `
  -OutputRoot $OutputRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output "SHORT P9-OFF DIAGNOSTIC WINDOW - STOP / OWNER REVIEW / $OutputRoot"
