param(
  [int]$Port = 3300,
  [int]$MaxBatches = 30,
  [int]$MinimumBatches = 5,
  [int]$TargetNaturalTimeouts = 3,
  [int]$TargetFailureBatches = 3,
  [int]$DiagnosticThresholdMs = 0,
  [switch]$StopOnFirstDiagnosticEvent,
  [int]$ProcessSampleIntervalSeconds = 2,
  [ValidateSet('P0_COMPAT_THREE_PHASE', 'NATURAL_P9_OFF')]
  [string]$ProbeProfile = 'P0_COMPAT_THREE_PHASE',
  [string]$RunMode = 'P9_OFF_REAL_TIMEOUT_REPRODUCTION',
  [string]$OutputRoot = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runnerProcess = Get-Process -Id $PID -ErrorAction Stop
$runnerStartTimeUtc = $runnerProcess.StartTime.ToUniversalTime().ToString('o')

if ($MaxBatches -lt 1) { throw 'MAX_BATCHES_MUST_BE_POSITIVE' }
if ($MinimumBatches -lt 1 -or $MinimumBatches -gt $MaxBatches) { throw 'INVALID_MINIMUM_BATCHES' }
if ($TargetNaturalTimeouts -lt 1 -or $TargetFailureBatches -lt 1) { throw 'INVALID_REPRODUCTION_TARGET' }
if ($DiagnosticThresholdMs -lt 0 -or $DiagnosticThresholdMs -ge 3000) { throw 'DIAGNOSTIC_THRESHOLD_MUST_BE_BELOW_OFFICIAL_SLO' }
if ($StopOnFirstDiagnosticEvent -and $DiagnosticThresholdMs -le 0) { throw 'STOP_ON_DIAGNOSTIC_EVENT_REQUIRES_THRESHOLD' }
if ($ProcessSampleIntervalSeconds -lt 1 -or $ProcessSampleIntervalSeconds -gt 300) { throw 'PROCESS_SAMPLE_INTERVAL_MUST_BE_1_TO_300_SECONDS' }

if (-not $OutputRoot) {
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
  $OutputRoot = Join-Path $root "evidence/governance/copilot-v1.2/p9/real-timeout-investigation/$stamp"
}
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null

function Write-JsonEvidence {
  param([Parameter(Mandatory = $true)]$Value, [Parameter(Mandatory = $true)][string]$Path, [int]$Depth = 10)
  $Value | ConvertTo-Json -Depth $Depth | Set-Content -LiteralPath $Path -Encoding utf8
}

function Publish-JsonEvidenceAtomic {
  param([Parameter(Mandatory = $true)]$Value, [Parameter(Mandatory = $true)][string]$Path, [int]$Depth = 10)
  if ([IO.File]::Exists($Path)) { throw "ATOMIC_PUBLICATION_TARGET_EXISTS_$Path" }
  $directory = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))
  if ($directory) { [IO.Directory]::CreateDirectory($directory) | Out-Null }
  $temporaryPath = "$Path.publish-$PID-$([Guid]::NewGuid().ToString('N')).tmp"
  try {
    $json = $Value | ConvertTo-Json -Depth $Depth
    [IO.File]::WriteAllText($temporaryPath, "$json$([Environment]::NewLine)", [Text.UTF8Encoding]::new($false))
    [IO.File]::Move($temporaryPath, $Path)
  } finally {
    if ([IO.File]::Exists($temporaryPath)) { [IO.File]::Delete($temporaryPath) }
  }
}

function Get-ListeningPid {
  param([Parameter(Mandatory = $true)][int]$LocalPort)
  $lines = @(netstat.exe -ano -p tcp | Select-String ":$LocalPort\s+.*LISTENING")
  foreach ($line in $lines) {
    if ($line.ToString() -match '\s+(\d+)\s*$') { return [int]$Matches[1] }
  }
  return $null
}

function Get-P9RuntimeProcesses {
  $matches = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match '(?i)(p9-controlled-active-runtime|p9-controlled-load|Invoke-P9-SoakCheckpoint)' })
  return @($matches | ForEach-Object {
    [ordered]@{ pid = $_.ProcessId; name = $_.Name; reason = 'P9_RUNTIME_COMMAND_MATCH' }
  })
}

function Get-RunSamplerProcesses {
  param(
    [Parameter(Mandatory = $true)][string]$RunOutputRoot,
    [int[]]$KnownSamplerPids = @()
  )

  $processes = @(Get-CimInstance Win32_Process -ErrorAction Stop)
  return @($processes | Where-Object {
    $commandLine = [string]$_.CommandLine
    $isRunSampler = $commandLine `
      -and $commandLine.IndexOf($RunOutputRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0 `
      -and $commandLine -match '(?i)Sample-RealBasic(?:Host|Processes)\.ps1'
    $isKnownSamplerChild = $_.Name -ieq 'conhost.exe' -and [int]$_.ParentProcessId -in $KnownSamplerPids
    $isRunSampler -or $isKnownSamplerChild
  } | ForEach-Object {
    [ordered]@{
      pid = [int]$_.ProcessId
      parentPid = [int]$_.ParentProcessId
      name = [string]$_.Name
      reason = 'REAL_BASIC_SAMPLER_OR_DESCENDANT_MATCH'
    }
  })
}

function Restore-EnvironmentValue {
  param([Parameter(Mandatory = $true)][string]$Name, $Value)
  if ($null -eq $Value) { Remove-Item "Env:$Name" -ErrorAction SilentlyContinue }
  else { Set-Item "Env:$Name" $Value }
}

function Test-ProcessHandleRunning {
  param($Process)
  if ($null -eq $Process) { return $false }
  try {
    $Process.Refresh()
    return -not $Process.HasExited
  } catch {
    return $false
  }
}

function Get-WorkspaceRelativePath {
  param([Parameter(Mandatory = $true)][string]$Path)
  $rootPath = [IO.Path]::GetFullPath($root).TrimEnd('\')
  $fullPath = [IO.Path]::GetFullPath($Path)
  if (-not $fullPath.StartsWith("$rootPath\", [StringComparison]::OrdinalIgnoreCase)) {
    throw "PATH_OUTSIDE_WORKSPACE_$fullPath"
  }
  return $fullPath.Substring($rootPath.Length + 1).Replace('\', '/')
}

$killSwitchPath = Join-Path $root 'evidence/governance/copilot-v1.2/p9/runtime/kill-switch-evidence.json'
$dailyMonitorPath = Join-Path $root 'evidence/governance/copilot-v1.2/p9/daily-monitor/latest.json'
$soakStatePath = Join-Path $root 'evidence/governance/copilot-v1.2/p9/soak/soak-state.json'
$orphanKillSwitchPath = Join-Path $root 'evidence/governance/copilot-v1.2/p9/real-timeout-investigation/P9_ORPHAN_RUNTIME_KILL_SWITCH_20260814.json'
foreach ($requiredPath in @($killSwitchPath, $dailyMonitorPath, $soakStatePath, $orphanKillSwitchPath)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) { throw "OPERATIONAL_GATE_EVIDENCE_MISSING_$requiredPath" }
}

$killSwitch = Get-Content -Raw -LiteralPath $killSwitchPath | ConvertFrom-Json
$dailyMonitor = Get-Content -Raw -LiteralPath $dailyMonitorPath | ConvertFrom-Json
$soakState = Get-Content -Raw -LiteralPath $soakStatePath | ConvertFrom-Json
$activeP9Before = @(Get-P9RuntimeProcesses)

if ($killSwitch.killSwitch -ne 'PASS' -or [int]$killSwitch.orphans -ne 0) { throw 'KILL_SWITCH_NOT_CERTIFIED' }
if ($dailyMonitor.turn.p9 -ne 'STOPPED' -or $dailyMonitor.turn.killSwitch -ne 'ACTIVE') { throw 'DAILY_MONITOR_OPERATIONAL_GATE_NOT_STOPPED' }
if ($soakState.status -notin @('STOP_IMMEDIATE', 'STOPPED')) { throw 'SOAK_STATE_NOT_STOPPED' }
if ($activeP9Before.Count -ne 0) { throw 'P9_RUNTIME_PROCESS_DETECTED' }
if (Get-ListeningPid -LocalPort $Port) { throw "DIAGNOSTIC_PORT_$Port`_IN_USE" }

$effectiveDatabaseUrl = $env:DATABASE_URL
if (-not $effectiveDatabaseUrl) {
  $databaseLine = (Select-String -Path (Join-Path $root '.env') -Pattern '^DATABASE_URL=' | Select-Object -First 1).Line
  if ($databaseLine) { $effectiveDatabaseUrl = $databaseLine.Substring($databaseLine.IndexOf('=') + 1).Trim('"') }
}
if (-not $effectiveDatabaseUrl) { throw 'DIAGNOSTIC_DATABASE_TARGET_MISSING' }
$databaseUri = [uri]$effectiveDatabaseUrl
$databaseLoopback = $databaseUri.Host -in @('localhost', '127.0.0.1', '::1')
if (-not $databaseLoopback) { throw 'DIAGNOSTIC_DATABASE_TARGET_NOT_LOOPBACK' }
Write-JsonEvidence -Path (Join-Path $OutputRoot 'database-target.json') -Value ([ordered]@{
  contract = 'agm-real-basic-database-target.v1'
  host = $databaseUri.Host
  port = $databaseUri.Port
  database = $databaseUri.AbsolutePath.TrimStart('/')
  loopback = $true
  credentialsRecorded = $false
})

$telemetryPath = Join-Path $OutputRoot 'server-correlated-telemetry.jsonl'
$hostTelemetryPath = Join-Path $OutputRoot 'host-telemetry.jsonl'
$processTelemetryPath = Join-Path $OutputRoot 'process-telemetry.jsonl'
$hostStopSignal = Join-Path $OutputRoot 'host-sampler.stop'
$samplerReleaseSignal = Join-Path $OutputRoot 'sampler-release.json'
$samplerStartSignal = Join-Path $OutputRoot 'sampler-window-start.json'
$hostBoundaryReadyPath = Join-Path $OutputRoot 'host-boundary-ready.json'
$processBoundaryReadyPath = Join-Path $OutputRoot 'process-boundary-ready.json'
$hostLifecyclePath = Join-Path $OutputRoot 'host-sampler-lifecycle.json'
$processLifecyclePath = Join-Path $OutputRoot 'process-sampler-lifecycle.json'
$hostSamplerStdoutPath = Join-Path $OutputRoot 'host-sampler.stdout.log'
$hostSamplerStderrPath = Join-Path $OutputRoot 'host-sampler.stderr.log'
$processSamplerStdoutPath = Join-Path $OutputRoot 'process-sampler.stdout.log'
$processSamplerStderrPath = Join-Path $OutputRoot 'process-sampler.stderr.log'
$samplerMaxRuntimeMinutes = 120
$runnerEventsPath = Join-Path $OutputRoot 'runner-events.jsonl'
$hostSamplerSessionPath = Join-Path $OutputRoot 'host-sampler-session.json'
$runId = Split-Path -Leaf $OutputRoot
$preload = Join-Path $root 'scripts/server-correlated-diagnostic-preload.cjs'
$probe = Join-Path $root 'scripts/real-basic-timeout-correlated-probe.mjs'
$analyzer = Join-Path $root 'scripts/analyze-real-basic-timeouts.mjs'
$hostSamplerScript = Join-Path $root 'scripts/Sample-RealBasicHost.ps1'
$processSamplerScript = Join-Path $root 'scripts/Sample-RealBasicProcesses.ps1'
$shortWindowRunner = Join-Path $root 'scripts/Invoke-ShortP9OffDiagnosticWindow.ps1'
foreach ($requiredScript in @($preload, $probe, $analyzer, $hostSamplerScript, $processSamplerScript)) {
  if (-not (Test-Path -LiteralPath $requiredScript)) { throw "DIAGNOSTIC_SCRIPT_MISSING_$requiredScript" }
}

$samplerFreshPaths = @(
  $hostTelemetryPath,
  $processTelemetryPath,
  $hostStopSignal,
  $samplerReleaseSignal,
  $samplerStartSignal,
  $hostBoundaryReadyPath,
  $processBoundaryReadyPath,
  $hostLifecyclePath,
  $processLifecyclePath,
  $hostSamplerStdoutPath,
  $hostSamplerStderrPath,
  $processSamplerStdoutPath,
  $processSamplerStderrPath,
  $runnerEventsPath,
  $hostSamplerSessionPath
)
foreach ($freshPath in $samplerFreshPaths) {
  if ([System.IO.File]::Exists($freshPath)) { throw "STALE_SAMPLER_EVIDENCE_REJECTED_$freshPath" }
}

$tsNode = Get-ChildItem (Join-Path $root 'node_modules/.pnpm') -Directory -Filter 'ts-node@*' |
  ForEach-Object { Join-Path $_.FullName 'node_modules/ts-node/dist/bin.js' } |
  Where-Object { Test-Path -LiteralPath $_ } |
  Select-Object -First 1
if (-not $tsNode) { throw 'TS_NODE_EXISTING_DEPENDENCY_NOT_FOUND' }

$signatureFiles = @(
  $PSCommandPath,
  $preload,
  $probe,
  $analyzer,
  $hostSamplerScript,
  $processSamplerScript,
  (Join-Path $root 'apps/api/src/main.ts'),
  (Join-Path $root 'apps/api/src/http-application.ts'),
  (Join-Path $root 'apps/api/src/prisma/prisma.service.ts')
)
if (Test-Path -LiteralPath $shortWindowRunner) { $signatureFiles += $shortWindowRunner }
$signatures = @($signatureFiles | ForEach-Object {
  $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $_
  [ordered]@{
    file = Get-WorkspaceRelativePath $_
    sha256 = $hash.Hash.ToLowerInvariant()
  }
})
Write-JsonEvidence -Path (Join-Path $OutputRoot 'source-signatures.json') -Value ([ordered]@{
  contract = 'agm-real-basic-source-signatures.v1'
  capturedAt = (Get-Date).ToUniversalTime().ToString('o')
  nodeVersion = (& node.exe --version)
  files = $signatures
})

$environmentNames = @('NODE_OPTIONS', 'AGM_CORRELATED_TELEMETRY_PATH', 'AGM_CORRELATED_RUN_ID', 'AGM_DIAGNOSTIC_FAULTS', 'PORT', 'API_HOST', 'NODE_ENV')
$priorEnvironment = @{}
foreach ($name in $environmentNames) {
  $environmentItem = Get-Item "Env:$name" -ErrorAction SilentlyContinue
  $priorEnvironment[$name] = if ($null -ne $environmentItem) { $environmentItem.Value } else { $null }
}

$custody = [ordered]@{
  contract = 'agm-real-basic-timeout-investigation-custody.v1'
  runId = $runId
  startedAt = (Get-Date).ToUniversalTime().ToString('o')
  mode = $RunMode
  apiHost = '127.0.0.1'
  port = $Port
  nodeEnv = 'test'
  databaseLoopback = $true
  production = $false
  p9 = 'STOPPED'
  p9RuntimeProcessesBefore = $activeP9Before
  killSwitch = 'ACTIVE'
  soakRestarted = $false
  officialBasicSloMs = 3000
  officialBasicSloUnchanged = $true
  basicFunctionalChanges = 0
  productionChanges = 0
  diagnosticFaultHeaders = 0
  diagnosticFaultInjectionAuthorized = $false
  externalWrites = 0
  newPermissions = 0
  newSecrets = 0
  instrumentationLifecycle = [ordered]@{
    parentPid = $PID
    parentStartTimeUtc = $runnerStartTimeUtc
    stopSignal = 'host-sampler.stop'
    hostLifecycle = 'host-sampler-lifecycle.json'
    processLifecycle = 'process-sampler-lifecycle.json'
    maxRuntimeMinutes = $samplerMaxRuntimeMinutes
    forcedStopAcceptedAsGraceful = $false
  }
  batchPolicy = [ordered]@{
    maxBatches = $MaxBatches
    minimumBatches = $MinimumBatches
    officialRequestsPerBatch = 180
    targetNaturalTimeouts = $TargetNaturalTimeouts
    targetFailureBatches = $TargetFailureBatches
    diagnosticThresholdMs = if ($DiagnosticThresholdMs -gt 0) { $DiagnosticThresholdMs } else { $null }
    stopOnFirstDiagnosticEvent = [bool]$StopOnFirstDiagnosticEvent
    automaticExtension = $false
    probeProfile = $ProbeProfile
  }
  gateEvidence = [ordered]@{
    killSwitch = [ordered]@{ path = Get-WorkspaceRelativePath $killSwitchPath; sha256 = (Get-FileHash $killSwitchPath -Algorithm SHA256).Hash.ToLowerInvariant() }
    dailyMonitor = [ordered]@{ path = Get-WorkspaceRelativePath $dailyMonitorPath; at = $dailyMonitor.at; status = $dailyMonitor.status; sha256 = (Get-FileHash $dailyMonitorPath -Algorithm SHA256).Hash.ToLowerInvariant() }
    soakState = [ordered]@{ path = Get-WorkspaceRelativePath $soakStatePath; status = $soakState.status; sha256 = (Get-FileHash $soakStatePath -Algorithm SHA256).Hash.ToLowerInvariant() }
    orphanRuntimeKillSwitch = [ordered]@{ path = Get-WorkspaceRelativePath $orphanKillSwitchPath; result = 'P9_CONTROLLED_PROCESSES_REMOVED'; sha256 = (Get-FileHash $orphanKillSwitchPath -Algorithm SHA256).Hash.ToLowerInvariant() }
  }
}
$shortWindowAuthorizationPath = Join-Path $OutputRoot 'short-window-authorization.json'
if (Test-Path -LiteralPath $shortWindowAuthorizationPath) {
  $shortWindowAuthorization = Get-Content -Raw -LiteralPath $shortWindowAuthorizationPath | ConvertFrom-Json
  if ($shortWindowAuthorization.p9 -ne 'STOPPED' `
    -or $shortWindowAuthorization.killSwitch -ne 'ACTIVE' `
    -or $shortWindowAuthorization.singleWindow -ne $true `
    -or $shortWindowAuthorization.officialSoakRestarted -ne $false `
    -or $shortWindowAuthorization.officialBasicSloUnchanged -ne $true `
    -or [int]$shortWindowAuthorization.officialBasicSloMs -ne 3000 `
    -or [int]$shortWindowAuthorization.diagnosticThresholdMs -ne $DiagnosticThresholdMs `
    -or [int]$shortWindowAuthorization.maxBatches -ne $MaxBatches `
    -or [int]$shortWindowAuthorization.maxOfficialRequests -ne ($MaxBatches * 180) `
    -or $shortWindowAuthorization.automaticExtension -ne $false `
    -or $shortWindowAuthorization.faultInjection -ne $false `
    -or $shortWindowAuthorization.probeProfile -ne $ProbeProfile `
    -or $ProbeProfile -ne 'NATURAL_P9_OFF' `
    -or -not $StopOnFirstDiagnosticEvent) {
    throw 'SHORT_WINDOW_AUTHORIZATION_CONTRACT_INVALID'
  }
  $custody.gateEvidence['shortWindowAuthorization'] = [ordered]@{
    path = 'short-window-authorization.json'
    sha256 = (Get-FileHash $shortWindowAuthorizationPath -Algorithm SHA256).Hash.ToLowerInvariant()
  }
}
Write-JsonEvidence -Path (Join-Path $OutputRoot 'custody.json') -Value $custody

$api = $null
$hostSampler = $null
$processSampler = $null
$apiPid = $null
$apiStartTimeUtc = $null
$runnerFailure = $null
$flushResult = 'NOT_ATTEMPTED'
$hostSamplerStopResult = 'NOT_STARTED'
$processSamplerStopResult = 'NOT_STARTED'
$hostSamplerExitCode = $null
$processSamplerExitCode = $null
$hostSamplerForced = $false
$processSamplerForced = $false
$samplerStopSignaledAt = $null
$samplerReleaseSignaledAt = $null
$samplerCleanupErrors = [System.Collections.Generic.List[string]]::new()
$batchRecords = @()
$naturalTimeouts = 0
$failureBatches = 0
$diagnosticEvents = 0
$diagnosticEventBatches = 0
$stopReason = 'MAX_BATCHES_REACHED'

try {
  # The preload is attached only to this direct API process. Fault authorization is deliberately absent.
  Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
  Remove-Item Env:AGM_DIAGNOSTIC_FAULTS -ErrorAction SilentlyContinue
  $env:PORT = "$Port"
  $env:API_HOST = '127.0.0.1'
  $env:NODE_ENV = 'test'
  $env:AGM_CORRELATED_TELEMETRY_PATH = $telemetryPath
  $env:AGM_CORRELATED_RUN_ID = $runId

  $api = Start-Process node.exe -ArgumentList @('--require', $preload, '--expose-gc', $tsNode, 'src/main.ts') `
    -WorkingDirectory (Join-Path $root 'apps/api') `
    -RedirectStandardOutput (Join-Path $OutputRoot 'api.stdout.log') `
    -RedirectStandardError (Join-Path $OutputRoot 'api.stderr.log') `
    -WindowStyle Hidden -PassThru
  $apiPid = $api.Id
  $apiStartTimeUtc = $api.StartTime.ToUniversalTime().ToString('o')

  # Do not let client or workload child processes inherit server telemetry settings.
  foreach ($name in @('AGM_CORRELATED_TELEMETRY_PATH', 'AGM_CORRELATED_RUN_ID', 'AGM_DIAGNOSTIC_FAULTS', 'PORT', 'API_HOST', 'NODE_ENV')) {
    Restore-EnvironmentValue -Name $name -Value $priorEnvironment[$name]
  }
  Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue

  $listenerPid = $null
  for ($index = 0; $index -lt 360; $index += 1) {
    Start-Sleep -Milliseconds 500
    if ($api.HasExited) { throw "DIAGNOSTIC_API_EXITED_BEFORE_LISTEN_$($api.ExitCode)" }
    $listenerPid = Get-ListeningPid -LocalPort $Port
    if ($listenerPid) { break }
  }
  if (-not $listenerPid) { throw 'REAL_TIMEOUT_DIAGNOSTIC_API_START_TIMEOUT' }
  if ([int]$listenerPid -ne [int]$apiPid) { throw "DIAGNOSTIC_API_PID_MISMATCH_$listenerPid`_$apiPid" }

  $custody.apiPid = $apiPid
  $custody.listenerPid = $listenerPid
  $custody.apiStartedAt = (Get-Date).ToUniversalTime().ToString('o')
  Write-JsonEvidence -Path (Join-Path $OutputRoot 'custody.json') -Value $custody

  $hostSampler = Start-Process powershell.exe -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $hostSamplerScript,
    '-ApiPid', "$apiPid", '-ApiStartTimeUtc', $apiStartTimeUtc,
    '-ParentPid', "$PID", '-ParentStartTimeUtc', $runnerStartTimeUtc,
    '-Output', $hostTelemetryPath, '-StopSignal', $hostStopSignal,
    '-ReleaseSignal', $samplerReleaseSignal, '-BoundaryReadyOutput', $hostBoundaryReadyPath,
    '-LifecycleOutput', $hostLifecyclePath, '-RunId', $runId,
    '-SampleIntervalSeconds', '5', '-MaxRuntimeMinutes', "$samplerMaxRuntimeMinutes"
  ) -WorkingDirectory $root `
    -RedirectStandardOutput $hostSamplerStdoutPath `
    -RedirectStandardError $hostSamplerStderrPath `
    -WindowStyle Hidden -PassThru
  try { $hostSampler.PriorityClass = 'Normal' } catch {}

  $processSampler = Start-Process powershell.exe -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $processSamplerScript,
    '-ApiPid', "$apiPid", '-ApiStartTimeUtc', $apiStartTimeUtc,
    '-ParentPid', "$PID", '-ParentStartTimeUtc', $runnerStartTimeUtc,
    '-Output', $processTelemetryPath, '-StopSignal', $hostStopSignal,
    '-ReleaseSignal', $samplerReleaseSignal, '-BoundaryReadyOutput', $processBoundaryReadyPath,
    '-LifecycleOutput', $processLifecyclePath, '-RunId', $runId,
    '-StartSignal', $samplerStartSignal,
    '-SampleIntervalSeconds', "$ProcessSampleIntervalSeconds", '-MaxRuntimeMinutes', "$samplerMaxRuntimeMinutes"
  ) -WorkingDirectory $root `
    -RedirectStandardOutput $processSamplerStdoutPath `
    -RedirectStandardError $processSamplerStderrPath `
    -WindowStyle Hidden -PassThru
  try { $processSampler.PriorityClass = 'Normal' } catch {}

  $hostSamplingReady = $false
  $processSamplingReady = $false
  for ($index = 0; $index -lt 120; $index += 1) {
    Start-Sleep -Milliseconds 500
    if ($hostSampler.HasExited) { throw "HOST_SAMPLER_EXITED_$($hostSampler.ExitCode)" }
    if ($processSampler.HasExited) { throw "PROCESS_SAMPLER_EXITED_$($processSampler.ExitCode)" }
    if ((Test-Path -LiteralPath $hostTelemetryPath) -and (Get-Item -LiteralPath $hostTelemetryPath).Length -gt 0) {
      try {
        $tail = @(Get-Content -LiteralPath $hostTelemetryPath -Tail 2 | ForEach-Object { $_ | ConvertFrom-Json })
        if ($tail.Count -eq 2 `
          -and @($tail | Where-Object { $_.runId -eq $runId -and [int]$_.samplerPid -eq [int]$hostSampler.Id -and $_.sampleKind -eq 'PERIODIC' }).Count -eq 2) {
          $scheduledGapSeconds = ([DateTimeOffset]::Parse([string]$tail[1].scheduledAt) - [DateTimeOffset]::Parse([string]$tail[0].scheduledAt)).TotalSeconds
          $captureStartGapSeconds = ([DateTimeOffset]::Parse([string]$tail[1].captureStartedAt) - [DateTimeOffset]::Parse([string]$tail[0].captureStartedAt)).TotalSeconds
          $expectedScheduledGapSeconds = 5 * (1 + [int]$tail[1].missedSlots)
          if ($expectedScheduledGapSeconds -ge 5 -and $expectedScheduledGapSeconds -le 15 `
            -and [Math]::Abs($scheduledGapSeconds - $expectedScheduledGapSeconds) -le 0.001 `
            -and $captureStartGapSeconds -gt 0 -and [int]$tail[1].missedSlots -ge 0) { $hostSamplingReady = $true }
        }
      } catch {
        # A read can overlap the writer flush; retry within the bounded readiness window.
      }
    }
    if ((Test-Path -LiteralPath $processTelemetryPath) -and (Get-Item -LiteralPath $processTelemetryPath).Length -gt 0) {
      try {
        $processTail = Get-Content -LiteralPath $processTelemetryPath -Tail 1 | ConvertFrom-Json
        if ($processTail.runId -eq $runId `
          -and [int]$processTail.samplerPid -eq [int]$processSampler.Id `
          -and $processTail.sampleKind -eq 'READINESS_BASELINE') {
          $processSamplingReady = $true
        }
      } catch {
        # A read can overlap the writer flush; retry within the bounded readiness window.
      }
    }
    if ($hostSamplingReady -and $processSamplingReady) { break }
  }
  if (-not $hostSamplingReady) { throw 'HOST_SAMPLER_START_TIMEOUT' }
  if (-not $processSamplingReady) { throw 'PROCESS_SAMPLER_START_TIMEOUT' }

  $samplerScheduledStart = [DateTimeOffset]::UtcNow.AddSeconds(1)
  Publish-JsonEvidenceAtomic -Path $samplerStartSignal -Value ([ordered]@{
    contract = 'agm-instrumentation-lifecycle-window-start.v1'
    runId = $runId
    windowId = $runId
    startAtEpochMs = $samplerScheduledStart.ToUnixTimeMilliseconds()
    startAt = $samplerScheduledStart.ToString('o')
    durationSeconds = $ProcessSampleIntervalSeconds
    semantics = 'GENERIC_DIAGNOSTIC_EXPECTED_MINIMUM_CADENCE_ONLY'
  })
  while ([DateTimeOffset]::UtcNow -lt $samplerScheduledStart) { Start-Sleep -Milliseconds 50 }

  Write-JsonEvidence -Path $hostSamplerSessionPath -Value ([ordered]@{
    contract = 'agm-real-basic-host-sampler-session.v1'
    startedAt = $hostSampler.StartTime.ToUniversalTime().ToString('o')
    readyAt = (Get-Date).ToUniversalTime().ToString('o')
    runId = $runId
    parentPid = $PID
    parentStartTimeUtc = $runnerStartTimeUtc
    samplerPid = $hostSampler.Id
    samplerStartTimeUtc = $hostSampler.StartTime.ToUniversalTime().ToString('o')
    processSamplerPid = $processSampler.Id
    processSamplerStartTimeUtc = $processSampler.StartTime.ToUniversalTime().ToString('o')
    apiPid = $apiPid
    apiStartTimeUtc = $apiStartTimeUtc
    sampleIntervalSeconds = 5
    maxRuntimeMinutes = $samplerMaxRuntimeMinutes
    stopSignal = 'host-sampler.stop'
    releaseSignal = 'sampler-release.json'
    startSignal = 'sampler-window-start.json'
    boundaryReadyEvidence = @('host-boundary-ready.json', 'process-boundary-ready.json')
    hostLifecycleEvidence = 'host-sampler-lifecycle.json'
    processLifecycleEvidence = 'process-sampler-lifecycle.json'
    timestampTimezone = 'UTC'
    hostSamplerPriority = $hostSampler.PriorityClass.ToString()
    processSamplerPriority = $processSampler.PriorityClass.ToString()
    processSampleIntervalSeconds = $ProcessSampleIntervalSeconds
    counters = @('CPU_TOTAL', 'PROCESSOR_QUEUE', 'CONTEXT_SWITCHES', 'AVAILABLE_MEMORY', 'PAGING', 'DISK_QUEUE', 'DISK_BYTES', 'NETWORK_BYTES', 'API_PROCESS')
    concurrentProcessEvidence = 'process-telemetry.jsonl'
  })

  $baseUrl = "http://127.0.0.1:$Port/api/v1"
  for ($batch = 1; $batch -le $MaxBatches; $batch += 1) {
    if ($api.HasExited) { throw "DIAGNOSTIC_API_EXITED_BEFORE_BATCH_$batch" }
    if ($hostSampler.HasExited) { throw "HOST_SAMPLER_EXITED_BEFORE_BATCH_$batch`_$($hostSampler.ExitCode)" }
    if ($processSampler.HasExited) { throw "PROCESS_SAMPLER_EXITED_BEFORE_BATCH_$batch`_$($processSampler.ExitCode)" }
    $batchStartedAt = (Get-Date).ToUniversalTime().ToString('o')
    $batchFile = Join-Path $OutputRoot ("batch-{0:d3}.json" -f $batch)
    Add-Content -LiteralPath $runnerEventsPath -Value (([ordered]@{ at = $batchStartedAt; type = 'batch.start'; batch = $batch }) | ConvertTo-Json -Compress) -Encoding utf8

    & node.exe $probe $baseUrl "$batch" $batchFile $runId $ProbeProfile
    if ($LASTEXITCODE -ne 0) { throw "REAL_BASIC_PROBE_FAILED_BATCH_$batch" }
    if ($api.HasExited) { throw "DIAGNOSTIC_API_EXITED_AFTER_BATCH_$batch" }
    if ($hostSampler.HasExited) { throw "HOST_SAMPLER_EXITED_AFTER_BATCH_$batch`_$($hostSampler.ExitCode)" }
    if ($processSampler.HasExited) { throw "PROCESS_SAMPLER_EXITED_AFTER_BATCH_$batch`_$($processSampler.ExitCode)" }

    $report = Get-Content -Raw -LiteralPath $batchFile | ConvertFrom-Json
    $officialSummary = $report.summary.official
    $batchTimeouts = [int]$officialSummary.timeouts
    $batchDiagnosticEvents = @()
    if ($DiagnosticThresholdMs -gt 0) {
      $batchDiagnosticEvents = @($report.samples | Where-Object {
        $_.officialSloIncluded -eq $true -and [double]$_.durationMs -ge $DiagnosticThresholdMs
      })
    }
    $naturalTimeouts += $batchTimeouts
    if ($batchTimeouts -gt 0) { $failureBatches += 1 }
    $diagnosticEvents += $batchDiagnosticEvents.Count
    if ($batchDiagnosticEvents.Count -gt 0) { $diagnosticEventBatches += 1 }
    $batchRecord = [ordered]@{
      batch = $batch
      startedAt = $batchStartedAt
      completedAt = (Get-Date).ToUniversalTime().ToString('o')
      officialRequests = [int]$officialSummary.requests
      naturalTimeouts = $batchTimeouts
      diagnosticEvents = $batchDiagnosticEvents.Count
      diagnosticEventTraceIds = @($batchDiagnosticEvents | ForEach-Object { $_.traceId })
      sloFailures = [int]$officialSummary.failures
      p95Ms = $officialSummary.p95Ms
      p99Ms = $officialSummary.p99Ms
      maxMs = $officialSummary.maxMs
    }
    $batchRecords += [pscustomobject]$batchRecord
    Add-Content -LiteralPath $runnerEventsPath -Value (([ordered]@{
      at = $batchRecord.completedAt
      type = 'batch.complete'
      batch = $batchRecord.batch
      officialRequests = $batchRecord.officialRequests
      naturalTimeouts = $batchRecord.naturalTimeouts
      diagnosticEvents = $batchRecord.diagnosticEvents
      sloFailures = $batchRecord.sloFailures
      p95Ms = $batchRecord.p95Ms
      p99Ms = $batchRecord.p99Ms
      maxMs = $batchRecord.maxMs
    }) | ConvertTo-Json -Compress) -Encoding utf8

    if ($StopOnFirstDiagnosticEvent -and $batchDiagnosticEvents.Count -gt 0) {
      $stopReason = 'DIAGNOSTIC_EVENT_CAPTURED'
      break
    }
    if ($batch -ge $MinimumBatches -and $naturalTimeouts -ge $TargetNaturalTimeouts -and $failureBatches -ge $TargetFailureBatches) {
      $stopReason = 'REPEATABILITY_TARGET_CAPTURED'
      break
    }
  }
  $clientBoundaryAt = [DateTimeOffset]::UtcNow
  Publish-JsonEvidenceAtomic -Path $hostStopSignal -Value ([ordered]@{
    contract = 'agm-instrumentation-lifecycle-sampler-boundary.v1'
    runId = $runId
    requestedAt = $clientBoundaryAt.ToString('o')
    clientCompletedAt = $clientBoundaryAt.ToString('o')
    reason = 'GENERIC_DIAGNOSTIC_CLIENT_BATCHES_COMPLETED'
  })
  $samplerStopSignaledAt = $clientBoundaryAt.ToString('o')
  # The preload emits the final request/runtime association on a 500 ms delayed timer.
  Start-Sleep -Milliseconds 1500
} catch {
  $runnerFailure = [ordered]@{
    contract = 'agm-real-basic-runner-error.v1'
    at = (Get-Date).ToUniversalTime().ToString('o')
    errorType = $_.Exception.GetType().FullName
    message = $_.Exception.Message
  }
  Write-JsonEvidence -Path (Join-Path $OutputRoot 'runner-error.json') -Value $runnerFailure
} finally {
  # Signal both samplers while the API is still alive. A single bounded wait
  # prevents sequential cleanup from doubling the shutdown window.
  $hostWasRunningAtCleanup = Test-ProcessHandleRunning $hostSampler
  $processWasRunningAtCleanup = Test-ProcessHandleRunning $processSampler
  if ($hostWasRunningAtCleanup -or $processWasRunningAtCleanup) {
    try {
      if (-not (Test-Path -LiteralPath $hostStopSignal)) {
        $samplerStopSignaledAt = [DateTimeOffset]::UtcNow.ToString('o')
        Publish-JsonEvidenceAtomic -Path $hostStopSignal -Value ([ordered]@{
          contract = 'agm-instrumentation-lifecycle-sampler-boundary.v1'
          runId = $runId
          requestedAt = $samplerStopSignaledAt
          clientCompletedAt = $samplerStopSignaledAt
          reason = 'GENERIC_DIAGNOSTIC_ABORT_CLEANUP'
        })
      }
    } catch {
      [void]$samplerCleanupErrors.Add("BOUNDARY_SIGNAL_WRITE_$($_.Exception.GetType().Name)")
    }

    $boundaryAckDeadline = [DateTimeOffset]::UtcNow.AddSeconds(30)
    while ((-not (Test-Path -LiteralPath $hostBoundaryReadyPath) -or -not (Test-Path -LiteralPath $processBoundaryReadyPath)) `
      -and [DateTimeOffset]::UtcNow -lt $boundaryAckDeadline `
      -and ((Test-ProcessHandleRunning $hostSampler) -or (Test-ProcessHandleRunning $processSampler))) {
      Start-Sleep -Milliseconds 250
    }
    if (-not (Test-Path -LiteralPath $hostBoundaryReadyPath)) { [void]$samplerCleanupErrors.Add('HOST_BOUNDARY_ACK_MISSING') }
    if (-not (Test-Path -LiteralPath $processBoundaryReadyPath)) { [void]$samplerCleanupErrors.Add('PROCESS_BOUNDARY_ACK_MISSING') }
    if ((Test-Path -LiteralPath $hostBoundaryReadyPath) -and (Test-Path -LiteralPath $processBoundaryReadyPath)) {
      try {
        $genericBoundary = Get-Content -Raw -LiteralPath $hostStopSignal | ConvertFrom-Json
        $genericHostAck = Get-Content -Raw -LiteralPath $hostBoundaryReadyPath | ConvertFrom-Json
        $genericProcessAck = Get-Content -Raw -LiteralPath $processBoundaryReadyPath | ConvertFrom-Json
        $genericProcessCadenceSeconds = ([DateTimeOffset]::Parse([string]$genericProcessAck.measurement.final.captureStartedAt) - [DateTimeOffset]::Parse([string]$genericProcessAck.measurement.baseline.captureStartedAt)).TotalSeconds
        $genericExpectedDurationSeconds = [double]$genericProcessAck.measurement.expectedDurationSeconds
        $genericDeclaredCadenceSeconds = [double]$genericProcessAck.measurement.cadenceSeconds
        $genericDeclaredDeviationSeconds = [double]$genericProcessAck.measurement.cadenceDeviationSeconds
        if ($genericBoundary.contract -ne 'agm-instrumentation-lifecycle-sampler-boundary.v1' -or $genericBoundary.runId -ne $runId `
          -or $genericHostAck.contract -ne 'agm-real-basic-sampler-boundary-ready.v1' -or $genericHostAck.role -ne 'HOST' -or $genericHostAck.runId -ne $runId `
          -or [int]$genericHostAck.samplerPid -ne [int]$hostSampler.Id -or $genericHostAck.samplerStartTimeUtc -ne $hostSampler.StartTime.ToUniversalTime().ToString('o') `
          -or $genericHostAck.finalSample.sampleKind -ne 'BOUNDARY_FINAL' `
          -or $genericProcessAck.contract -ne 'agm-real-basic-sampler-boundary-ready.v1' -or $genericProcessAck.role -ne 'PROCESS' -or $genericProcessAck.runId -ne $runId `
          -or [int]$genericProcessAck.samplerPid -ne [int]$processSampler.Id -or $genericProcessAck.samplerStartTimeUtc -ne $processSampler.StartTime.ToUniversalTime().ToString('o') `
          -or $genericProcessAck.measurement.baseline.sampleKind -ne 'FORMAL_BASELINE' `
          -or $genericProcessAck.measurement.final.sampleKind -ne 'MEASUREMENT_FINAL' `
          -or [int]$genericProcessAck.measurement.expectedDurationSeconds -ne $ProcessSampleIntervalSeconds `
          -or $genericProcessAck.measurement.snapshotSemantics -ne 'NON_ATOMIC_PROCESS_ENUMERATION_START_TO_START_DENOMINATOR' `
          -or [DateTimeOffset]::Parse([string]$genericProcessAck.measurement.baseline.scheduledAt).ToUnixTimeMilliseconds() -ne $samplerScheduledStart.ToUnixTimeMilliseconds() `
          -or [DateTimeOffset]::Parse([string]$genericHostAck.finalSample.scheduledAt) -ne [DateTimeOffset]::Parse([string]$genericBoundary.clientCompletedAt) `
          -or [DateTimeOffset]::Parse([string]$genericProcessAck.measurement.final.scheduledAt) -ne [DateTimeOffset]::Parse([string]$genericBoundary.clientCompletedAt) `
          -or [Math]::Abs($genericDeclaredCadenceSeconds - $genericProcessCadenceSeconds) -gt 0.001 `
          -or [Math]::Abs($genericDeclaredDeviationSeconds - ($genericProcessCadenceSeconds - $genericExpectedDurationSeconds)) -gt 0.001 `
          -or $genericHostAck.boundary.requestedAt -ne $genericBoundary.requestedAt -or $genericProcessAck.boundary.requestedAt -ne $genericBoundary.requestedAt `
          -or $genericHostAck.boundary.clientCompletedAt -ne $genericBoundary.clientCompletedAt -or $genericProcessAck.boundary.clientCompletedAt -ne $genericBoundary.clientCompletedAt `
          -or [DateTimeOffset]::Parse([string]$genericHostAck.boundary.observedAt) -lt [DateTimeOffset]::Parse([string]$genericBoundary.requestedAt) `
          -or [DateTimeOffset]::Parse([string]$genericHostAck.readyAt) -lt [DateTimeOffset]::Parse([string]$genericHostAck.boundary.observedAt) `
          -or [DateTimeOffset]::Parse([string]$genericProcessAck.boundary.observedAt) -lt [DateTimeOffset]::Parse([string]$genericBoundary.requestedAt) `
          -or [DateTimeOffset]::Parse([string]$genericProcessAck.readyAt) -lt [DateTimeOffset]::Parse([string]$genericProcessAck.boundary.observedAt)) {
          throw 'GENERIC_SAMPLER_BOUNDARY_ACK_INVALID'
        }
      } catch {
        [void]$samplerCleanupErrors.Add("BOUNDARY_ACK_VALIDATION_$($_.Exception.GetType().Name)")
      }
    }
    try {
      if (-not (Test-Path -LiteralPath $samplerReleaseSignal)) {
        $samplerReleaseSignaledAt = [DateTimeOffset]::UtcNow.ToString('o')
        Publish-JsonEvidenceAtomic -Path $samplerReleaseSignal -Value ([ordered]@{
          contract = 'agm-instrumentation-lifecycle-sampler-release.v1'
          runId = $runId
          requestedAt = $samplerReleaseSignaledAt
          reason = 'GENERIC_DIAGNOSTIC_BOUNDARY_ACK_PHASE_COMPLETE'
        })
      }
    } catch {
      [void]$samplerCleanupErrors.Add("RELEASE_SIGNAL_WRITE_$($_.Exception.GetType().Name)")
    }
  }

  $samplerGraceDeadline = [DateTimeOffset]::UtcNow.AddSeconds(30)
  while ([DateTimeOffset]::UtcNow -lt $samplerGraceDeadline) {
    $hostStillRunning = Test-ProcessHandleRunning $hostSampler
    $processStillRunning = Test-ProcessHandleRunning $processSampler
    if (-not $hostStillRunning -and -not $processStillRunning) { break }
    Start-Sleep -Milliseconds 250
  }

  if (Test-ProcessHandleRunning $hostSampler) {
    $hostSamplerForced = $true
    try {
      Stop-Process -InputObject $hostSampler -Force -ErrorAction Stop
      $hostSampler.WaitForExit(10000) | Out-Null
    } catch {
      [void]$samplerCleanupErrors.Add("HOST_FORCE_STOP_$($_.Exception.GetType().Name)")
    }
  }
  if (Test-ProcessHandleRunning $processSampler) {
    $processSamplerForced = $true
    try {
      Stop-Process -InputObject $processSampler -Force -ErrorAction Stop
      $processSampler.WaitForExit(10000) | Out-Null
    } catch {
      [void]$samplerCleanupErrors.Add("PROCESS_FORCE_STOP_$($_.Exception.GetType().Name)")
    }
  }

  if ($hostSampler) {
    if (Test-ProcessHandleRunning $hostSampler) {
      $hostSamplerStopResult = 'STILL_RUNNING_AFTER_FORCE_FALLBACK'
      [void]$samplerCleanupErrors.Add('HOST_STILL_RUNNING_AFTER_FORCE_FALLBACK')
    } else {
      try { $hostSamplerExitCode = $hostSampler.ExitCode } catch { [void]$samplerCleanupErrors.Add("HOST_EXIT_CODE_$($_.Exception.GetType().Name)") }
      $hostSamplerStopResult = if ($hostSamplerForced) { 'FORCED_AFTER_STOP_SIGNAL_TIMEOUT' } `
        elseif ($hostWasRunningAtCleanup -and $samplerStopSignaledAt) { 'GRACEFUL_STOP_SIGNAL' } `
        else { 'EXITED_BEFORE_STOP_SIGNAL' }
    }
  }
  if ($processSampler) {
    if (Test-ProcessHandleRunning $processSampler) {
      $processSamplerStopResult = 'STILL_RUNNING_AFTER_FORCE_FALLBACK'
      [void]$samplerCleanupErrors.Add('PROCESS_STILL_RUNNING_AFTER_FORCE_FALLBACK')
    } else {
      try { $processSamplerExitCode = $processSampler.ExitCode } catch { [void]$samplerCleanupErrors.Add("PROCESS_EXIT_CODE_$($_.Exception.GetType().Name)") }
      $processSamplerStopResult = if ($processSamplerForced) { 'FORCED_AFTER_STOP_SIGNAL_TIMEOUT' } `
        elseif ($processWasRunningAtCleanup -and $samplerStopSignaledAt) { 'GRACEFUL_STOP_SIGNAL' } `
        else { 'EXITED_BEFORE_STOP_SIGNAL' }
    }
  }

  if ($api -and (Test-ProcessHandleRunning $api) -and $apiPid) {
    $curlDiscardPath = [System.IO.Path]::GetTempFileName()
    try {
      $flushStatus = & curl.exe --silent --show-error --output $curlDiscardPath --write-out '%{http_code}' --max-time 15 `
        -H "x-agm-diagnostic-control: $runId" "http://127.0.0.1:$Port/__agm_diagnostic/flush-and-stop"
      if ($LASTEXITCODE -eq 0 -and $flushStatus -eq '200') {
        $flushResult = 'HTTP_200'
        if (-not $api.WaitForExit(30000)) { $flushResult = 'HTTP_200_EXIT_TIMEOUT' }
      } else { $flushResult = "FAILED_HTTP_$flushStatus`_EXIT_$LASTEXITCODE" }
    } catch { $flushResult = "EXCEPTION_$($_.Exception.GetType().Name)" }
    finally { Remove-Item -LiteralPath $curlDiscardPath -Force -ErrorAction SilentlyContinue }
  }

  if ($api -and (Test-ProcessHandleRunning $api)) {
    try {
      Stop-Process -InputObject $api -Force -ErrorAction Stop
      $api.WaitForExit(10000) | Out-Null
    } catch {
      [void]$samplerCleanupErrors.Add("API_FORCE_STOP_$($_.Exception.GetType().Name)")
    }
  }
  foreach ($name in $environmentNames) {
    try { Restore-EnvironmentValue -Name $name -Value $priorEnvironment[$name] }
    catch { [void]$samplerCleanupErrors.Add("ENVIRONMENT_RESTORE_$name`_$($_.Exception.GetType().Name)") }
  }
}

$hostLifecycle = $null
$processLifecycle = $null
try {
  if (-not [System.IO.File]::Exists($hostLifecyclePath)) { throw 'HOST_LIFECYCLE_EVIDENCE_MISSING' }
  $hostLifecycle = Get-Content -Raw -LiteralPath $hostLifecyclePath | ConvertFrom-Json
  if ($hostLifecycle.contract -ne 'agm-real-basic-sampler-lifecycle.v1' `
    -or $hostLifecycle.role -ne 'HOST' `
    -or $hostLifecycle.runId -ne $runId `
    -or [int]$hostLifecycle.samplerPid -ne [int]$hostSampler.Id `
    -or $hostLifecycle.samplerStartTimeUtc -ne $hostSampler.StartTime.ToUniversalTime().ToString('o') `
    -or [int]$hostLifecycle.parentPid -ne [int]$PID `
    -or $hostLifecycle.parentStartTimeUtc -ne $runnerStartTimeUtc `
    -or [int]$hostLifecycle.apiPid -ne [int]$apiPid `
    -or $hostLifecycle.apiStartTimeUtc -ne $apiStartTimeUtc `
    -or $hostLifecycle.stopReason -ne 'STOP_SIGNAL' `
    -or $hostLifecycle.boundarySignalRequired -ne $true `
    -or $hostLifecycle.releaseSignalRequired -ne $true `
    -or -not $hostLifecycle.boundaryReadyAt `
    -or -not $hostLifecycle.releaseObservedAt `
    -or $hostLifecycle.graceful -ne $true `
    -or [int]$hostLifecycle.exitCode -ne 0) {
    throw 'HOST_LIFECYCLE_EVIDENCE_INVALID'
  }
} catch {
  [void]$samplerCleanupErrors.Add($_.Exception.Message)
}
try {
  if (-not [System.IO.File]::Exists($processLifecyclePath)) { throw 'PROCESS_LIFECYCLE_EVIDENCE_MISSING' }
  $processLifecycle = Get-Content -Raw -LiteralPath $processLifecyclePath | ConvertFrom-Json
  if ($processLifecycle.contract -ne 'agm-real-basic-sampler-lifecycle.v1' `
    -or $processLifecycle.role -ne 'PROCESS' `
    -or $processLifecycle.runId -ne $runId `
    -or [int]$processLifecycle.samplerPid -ne [int]$processSampler.Id `
    -or $processLifecycle.samplerStartTimeUtc -ne $processSampler.StartTime.ToUniversalTime().ToString('o') `
    -or [int]$processLifecycle.parentPid -ne [int]$PID `
    -or $processLifecycle.parentStartTimeUtc -ne $runnerStartTimeUtc `
    -or [int]$processLifecycle.apiPid -ne [int]$apiPid `
    -or $processLifecycle.apiStartTimeUtc -ne $apiStartTimeUtc `
    -or $processLifecycle.stopReason -ne 'STOP_SIGNAL' `
    -or $processLifecycle.boundarySignalRequired -ne $true `
    -or $processLifecycle.releaseSignalRequired -ne $true `
    -or -not $processLifecycle.boundaryReadyAt `
    -or -not $processLifecycle.releaseObservedAt `
    -or $processLifecycle.graceful -ne $true `
    -or [int]$processLifecycle.exitCode -ne 0) {
    throw 'PROCESS_LIFECYCLE_EVIDENCE_INVALID'
  }
} catch {
  [void]$samplerCleanupErrors.Add($_.Exception.Message)
}

foreach ($stderrPath in @($hostSamplerStderrPath, $processSamplerStderrPath)) {
  if ([System.IO.File]::Exists($stderrPath) -and (Get-Item -LiteralPath $stderrPath).Length -gt 0) {
    [void]$samplerCleanupErrors.Add("SAMPLER_STDERR_NOT_EMPTY_$stderrPath")
  }
}

$knownSamplerPids = @()
if ($hostSampler) { $knownSamplerPids += [int]$hostSampler.Id }
if ($processSampler) { $knownSamplerPids += [int]$processSampler.Id }
$samplerOrphansAfter = @()
$samplerOrphanScanCompleted = $false
try {
  $samplerOrphansAfter = @(Get-RunSamplerProcesses -RunOutputRoot $OutputRoot -KnownSamplerPids $knownSamplerPids)
  $samplerOrphanScanCompleted = $true
  if ($samplerOrphansAfter.Count -ne 0) { [void]$samplerCleanupErrors.Add("SAMPLER_ORPHANS_DETECTED_$($samplerOrphansAfter.Count)") }
} catch {
  [void]$samplerCleanupErrors.Add("SAMPLER_ORPHAN_SCAN_$($_.Exception.GetType().Name)")
}

$apiListenerAfterCleanup = Get-ListeningPid -LocalPort $Port
if ($apiListenerAfterCleanup) { [void]$samplerCleanupErrors.Add("DIAGNOSTIC_API_LISTENER_REMAINED_$apiListenerAfterCleanup") }
if ($hostSamplerForced) { [void]$samplerCleanupErrors.Add('HOST_SAMPLER_REQUIRED_FORCE_FALLBACK') }
if ($processSamplerForced) { [void]$samplerCleanupErrors.Add('PROCESS_SAMPLER_REQUIRED_FORCE_FALLBACK') }
if ($hostSampler -and (Test-ProcessHandleRunning $hostSampler)) { [void]$samplerCleanupErrors.Add('HOST_SAMPLER_HANDLE_STILL_RUNNING') }
if ($processSampler -and (Test-ProcessHandleRunning $processSampler)) { [void]$samplerCleanupErrors.Add('PROCESS_SAMPLER_HANDLE_STILL_RUNNING') }

if ($samplerCleanupErrors.Count -gt 0) {
  if ($runnerFailure) {
    $runnerFailure['samplerCleanupErrors'] = @($samplerCleanupErrors)
  } else {
    $runnerFailure = [ordered]@{
      contract = 'agm-real-basic-runner-error.v1'
      at = (Get-Date).ToUniversalTime().ToString('o')
      errorType = 'SAMPLER_LIFECYCLE_CLEANUP'
      message = 'SAMPLER_LIFECYCLE_CLEANUP_NOT_GRACEFUL'
      samplerCleanupErrors = @($samplerCleanupErrors)
    }
  }
  Write-JsonEvidence -Path (Join-Path $OutputRoot 'runner-error.json') -Value $runnerFailure
}

$activeP9After = @(Get-P9RuntimeProcesses)
$custody.completedAt = (Get-Date).ToUniversalTime().ToString('o')
$custody.apiPid = $apiPid
$custody.flushResult = $flushResult
$custody.hostSamplerStopped = if ($hostSampler) { -not (Test-ProcessHandleRunning $hostSampler) } else { $false }
$custody.hostSamplerStopResult = $hostSamplerStopResult
$custody.hostSamplerExitCode = $hostSamplerExitCode
$custody.hostSamplerForced = $hostSamplerForced
$custody.hostSamplerLifecycle = $hostLifecycle
$custody.processSamplerStopped = if ($processSampler) { -not (Test-ProcessHandleRunning $processSampler) } else { $false }
$custody.processSamplerStopResult = $processSamplerStopResult
$custody.processSamplerExitCode = $processSamplerExitCode
$custody.processSamplerForced = $processSamplerForced
$custody.processSamplerLifecycle = $processLifecycle
$custody.samplerStopSignaledAt = $samplerStopSignaledAt
$custody.samplerReleaseSignaledAt = $samplerReleaseSignaledAt
$custody.hostBoundaryReadyCaptured = Test-Path -LiteralPath $hostBoundaryReadyPath
$custody.processBoundaryReadyCaptured = Test-Path -LiteralPath $processBoundaryReadyPath
$custody.samplerCleanupErrors = @($samplerCleanupErrors)
$custody.samplerOrphanScanCompleted = $samplerOrphanScanCompleted
$custody.samplerOrphansAfter = $samplerOrphansAfter
$custody.apiListenerAfterCleanup = $apiListenerAfterCleanup
$custody.batchesCompleted = $batchRecords.Count
$custody.naturalTimeoutsCaptured = $naturalTimeouts
$custody.failureBatches = $failureBatches
$custody.diagnosticEventsCaptured = $diagnosticEvents
$custody.diagnosticEventBatches = $diagnosticEventBatches
$custody.stopReason = $stopReason
$custody.p9RuntimeProcessesAfter = $activeP9After
$custody.p9StillStopped = ($activeP9After.Count -eq 0)
$custody.runnerCompleted = ($null -eq $runnerFailure)
Write-JsonEvidence -Path (Join-Path $OutputRoot 'custody.json') -Value $custody
Write-JsonEvidence -Path (Join-Path $OutputRoot 'batch-index.json') -Value ([ordered]@{
  contract = 'agm-real-basic-batch-index.v1'
  batches = $batchRecords
  totals = [ordered]@{
    batches = $batchRecords.Count
    officialRequests = (@($batchRecords | Measure-Object officialRequests -Sum).Sum)
    naturalTimeouts = $naturalTimeouts
    failureBatches = $failureBatches
    diagnosticEvents = $diagnosticEvents
    diagnosticEventBatches = $diagnosticEventBatches
  }
  stopReason = $stopReason
})

if ($runnerFailure) { throw "REAL_TIMEOUT_INVESTIGATION_RUNNER_FAILED_$($runnerFailure.message)" }
if ($flushResult -ne 'HTTP_200') { throw "REAL_TIMEOUT_TELEMETRY_NOT_GRACEFULLY_FROZEN_$flushResult" }
if ($activeP9After.Count -ne 0) { throw 'P9_RUNTIME_PROCESS_DETECTED_AFTER_INVESTIGATION' }

& node.exe $analyzer $OutputRoot
if ($LASTEXITCODE -ne 0) { throw 'REAL_TIMEOUT_ANALYSIS_FAILED' }

& pnpm.cmd exec tsx scripts/test-copilot-v1-2-p9-pilot.ts 2>&1 | Set-Content -LiteralPath (Join-Path $OutputRoot 'kill-switch-recertification.log') -Encoding utf8
$killSwitchExit = $LASTEXITCODE
$killSwitchAfter = Get-Content -Raw -LiteralPath $killSwitchPath | ConvertFrom-Json
Write-JsonEvidence -Path (Join-Path $OutputRoot 'operational-state.json') -Value ([ordered]@{
  contract = 'agm-real-basic-final-operational-state.v1'
  capturedAt = (Get-Date).ToUniversalTime().ToString('o')
  p9 = if ((Get-P9RuntimeProcesses).Count -eq 0) { 'STOPPED' } else { 'UNSAFE_PROCESS_DETECTED' }
  killSwitch = if ($killSwitchExit -eq 0 -and $killSwitchAfter.killSwitch -eq 'PASS' -and [int]$killSwitchAfter.orphans -eq 0) { 'ACTIVE' } else { 'FAIL' }
  killSwitchTestExitCode = $killSwitchExit
  basicSloMs = 3000
  basicSloUnchanged = $true
  officialSoakRestarted = $false
  productionChanges = 0
  basicFunctionalChanges = 0
})
if ($killSwitchExit -ne 0) { throw 'P9_FINAL_KILL_SWITCH_RECERTIFICATION_FAILED' }

& node.exe scripts/hash-server-correlated-evidence.mjs $OutputRoot
if ($LASTEXITCODE -ne 0) { throw 'REAL_TIMEOUT_EVIDENCE_HASH_FAILED' }

Write-Output "REAL BASIC TIMEOUT INVESTIGATION - COMPLETE / $OutputRoot"
