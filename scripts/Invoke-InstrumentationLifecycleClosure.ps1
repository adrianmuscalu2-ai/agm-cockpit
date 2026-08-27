param(
  [Parameter(Mandatory = $true)][string]$OutputRoot,
  [string]$PreflightInventoryPath,
  [int]$Port = 3400,
  [ValidateRange(150, 150)][int]$DurationSeconds = 150,
  [ValidateRange(5, 5)][int]$HostSampleIntervalSeconds = 5,
  [ValidateRange(150, 150)][int]$ProcessSampleIntervalSeconds = 150,
  [ValidateRange(3, 120)][int]$SamplerMaxRuntimeMinutes = 10,
  [switch]$HandoffIntegrationProducer
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runId = Split-Path -Leaf $OutputRoot
$runnerStartedAt = [DateTimeOffset]::UtcNow
$runnerProcess = Get-Process -Id $PID -ErrorAction Stop
$runnerStartTimeUtc = $runnerProcess.StartTime.ToUniversalTime().ToString('o')
$logicalCpuCount = [Environment]::ProcessorCount
$ownerReviewGate = 'INSTRUMENTATION LIFECYCLE CLOSURE ' + [char]0x2014 + ' OWNER REVIEW'

function Write-JsonEvidence {
  param([Parameter(Mandatory = $true)]$Value, [Parameter(Mandatory = $true)][string]$Path, [int]$Depth = 12)
  $directory = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Path))
  if ($directory) { [IO.Directory]::CreateDirectory($directory) | Out-Null }
  $json = $Value | ConvertTo-Json -Depth $Depth
  [IO.File]::WriteAllText($Path, "$json$([Environment]::NewLine)", [Text.UTF8Encoding]::new($false))
}

function Publish-JsonEvidenceAtomic {
  param([Parameter(Mandatory = $true)]$Value, [Parameter(Mandatory = $true)][string]$Path, [int]$Depth = 12)
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

function Get-WorkspaceRelativePath {
  param([Parameter(Mandatory = $true)][string]$Path)
  $workspace = [IO.Path]::GetFullPath($root).TrimEnd('\')
  $fullPath = [IO.Path]::GetFullPath($Path)
  if (-not $fullPath.StartsWith("$workspace\", [StringComparison]::OrdinalIgnoreCase)) {
    throw "PATH_OUTSIDE_WORKSPACE_$fullPath"
  }
  return $fullPath.Substring($workspace.Length + 1).Replace('\', '/')
}

function Get-FileSignature {
  param([Parameter(Mandatory = $true)][string]$Path)
  $item = Get-Item -LiteralPath $Path -ErrorAction Stop
  $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $Path
  return [ordered]@{
    path = Get-WorkspaceRelativePath $Path
    bytes = $item.Length
    sha256 = $hash.Hash.ToLowerInvariant()
    lastWriteAt = $item.LastWriteTimeUtc.ToString('o')
  }
}

function Get-OutputFileSignature {
  param([Parameter(Mandatory = $true)][string]$Path)
  $item = Get-Item -LiteralPath $Path -ErrorAction Stop
  return [ordered]@{
    path = $item.Name
    bytes = $item.Length
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
  }
}

function Get-TextSha256 {
  param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    return -join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
  } finally {
    $sha.Dispose()
  }
}

function Get-ManagedProcessIdentity {
  param(
    [Parameter(Mandatory = $true)]$Process,
    [Parameter(Mandatory = $true)][string]$Role,
    [Parameter(Mandatory = $true)][string]$ExpectedStartTimeUtc
  )

  if (-not (Test-ProcessHandleAlive $Process)) { throw "MANAGED_ROOT_NOT_ALIVE_$Role" }
  $Process.Refresh()
  $processId = [int]$Process.Id
  $rows = @(Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $processId" -ErrorAction Stop)
  if ($rows.Count -ne 1) { throw "MANAGED_ROOT_QUERY_CARDINALITY_${Role}_$($rows.Count)" }
  $row = $rows[0]
  if (-not $row.CreationDate) { throw "MANAGED_ROOT_CREATION_DATE_UNAVAILABLE_$Role" }
  if ([string]::IsNullOrWhiteSpace([string]$row.Name)) { throw "MANAGED_ROOT_IMAGE_UNAVAILABLE_$Role" }

  $creation = if ($row.CreationDate -is [DateTime]) {
    [DateTimeOffset]::new(([DateTime]$row.CreationDate).ToUniversalTime())
  } else {
    [DateTimeOffset]::new(([Management.ManagementDateTimeConverter]::ToDateTime([string]$row.CreationDate)).ToUniversalTime())
  }
  $executablePath = [string]$row.ExecutablePath
  if ([string]::IsNullOrWhiteSpace($executablePath)) {
    try { $executablePath = [string]$Process.Path } catch { $executablePath = $null }
  }
  if ([string]::IsNullOrWhiteSpace($executablePath)) { throw "MANAGED_ROOT_EXECUTABLE_UNAVAILABLE_$Role" }
  $commandLine = [string]$row.CommandLine
  if ([string]::IsNullOrWhiteSpace($commandLine)) { throw "MANAGED_ROOT_COMMAND_LINE_UNAVAILABLE_$Role" }

  $normalizedExecutablePath = ([IO.Path]::GetFullPath($executablePath) -replace '/', '\').ToLowerInvariant()
  $executablePathSha256 = Get-TextSha256 -Text $normalizedExecutablePath
  $commandLineSha256 = Get-TextSha256 -Text $commandLine
  $creationEpochMs = $creation.ToUnixTimeMilliseconds()
  $imageName = [string]$row.Name
  $identityMaterial = '{0}|{1}|{2}|{3}|{4}' -f (
    $processId,
    $creationEpochMs.ToString([Globalization.CultureInfo]::InvariantCulture),
    $imageName.ToLowerInvariant(),
    $executablePathSha256,
    $commandLineSha256
  )
  $expectedStart = [DateTimeOffset]::Parse($ExpectedStartTimeUtc)
  $startDeltaMs = [Math]::Abs(($creation - $expectedStart).TotalMilliseconds)
  if ($startDeltaMs -gt 2000) { throw "MANAGED_ROOT_CREATION_MISMATCH_${Role}_$([Math]::Round($startDeltaMs, 3))" }

  return [ordered]@{
    role = $Role
    pid = $processId
    parentPid = [int]$row.ParentProcessId
    startTimeUtc = $expectedStart.ToUniversalTime().ToString('o')
    creationAt = $creation.ToUniversalTime().ToString('o')
    creationEpochMs = $creationEpochMs
    imageName = $imageName
    executablePathSha256 = $executablePathSha256
    commandLineSha256 = $commandLineSha256
    identityStrength = 'FULL_CURRENT'
    identitySha256 = Get-TextSha256 -Text $identityMaterial
    identityEvidence = 'INITIAL_MANAGED_ROOT_SNAPSHOT'
  }
}

function Restore-EnvironmentValue {
  param([Parameter(Mandatory = $true)][string]$Name, $Value)
  if ($null -eq $Value) { Remove-Item "Env:$Name" -ErrorAction SilentlyContinue }
  else { Set-Item "Env:$Name" $Value }
}

function Get-JsonlRecords {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return @() }
  $lines = @(Get-Content -LiteralPath $Path)
  $records = [System.Collections.Generic.List[object]]::new()
  for ($index = 0; $index -lt $lines.Count; $index += 1) {
    $line = $lines[$index]
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    try { $records.Add(($line | ConvertFrom-Json)) }
    catch {
      # A persistent writer can expose its final line between write and newline.
      # Only that transient final line is deferred; any earlier invalid line fails.
      if ($index -ne ($lines.Count - 1)) { throw }
    }
  }
  return @($records)
}

function Test-ProcessHandleAlive {
  param($Process)
  if ($null -eq $Process) { return $false }
  try { $Process.Refresh(); return -not $Process.HasExited } catch { return $false }
}

function Get-ProcessCpuSeconds {
  param($Process)
  if (-not (Test-ProcessHandleAlive $Process)) { return $null }
  try { return [double]$Process.TotalProcessorTime.TotalSeconds } catch { return $null }
}

function Get-ProcessStartTimeUtc {
  param($Process)
  if ($null -eq $Process) { return $null }
  try { return $Process.StartTime.ToUniversalTime().ToString('o') } catch { return $null }
}

function Get-ProcessExitCodeSafe {
  param($Process)
  if ($null -eq $Process) { return $null }
  try {
    $Process.Refresh()
    if (-not $Process.HasExited) { return $null }
    return [int]$Process.ExitCode
  } catch { return $null }
}

function Get-ObserverCpuSnapshot {
  param($Runner, $HostSampler, $ProcessSampler, $Api)
  return [ordered]@{
    capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
    runner = Get-ProcessCpuSeconds $Runner
    hostSampler = Get-ProcessCpuSeconds $HostSampler
    processSampler = Get-ProcessCpuSeconds $ProcessSampler
    api = Get-ProcessCpuSeconds $Api
  }
}

function Get-CpuMetric {
  param($Before, $After, [double]$WallSeconds)
  if ($null -eq $Before -or $null -eq $After -or $WallSeconds -le 0) {
    return [ordered]@{ cpuSeconds = $null; cpuPercentOfOneCore = $null; cpuPercentOfTotalCapacity = $null }
  }
  $delta = [Math]::Max(0, [double]$After - [double]$Before)
  return [ordered]@{
    cpuSeconds = [Math]::Round($delta, 6)
    cpuPercentOfOneCore = [Math]::Round(($delta / $WallSeconds) * 100, 3)
    cpuPercentOfTotalCapacity = [Math]::Round((($delta / $WallSeconds) * 100) / $logicalCpuCount, 3)
  }
}

function Get-PercentileMetric {
  param([object[]]$Values, [double]$Fraction)
  $usable = @($Values | Where-Object { $null -ne $_ } | ForEach-Object { [double]$_ } | Sort-Object)
  if ($usable.Count -eq 0) { return $null }
  $index = [Math]::Min($usable.Count - 1, [Math]::Max(0, [Math]::Ceiling($usable.Count * $Fraction) - 1))
  return [Math]::Round([double]$usable[$index], 3)
}

function Test-PortAvailable {
  param([Parameter(Mandatory = $true)][int]$LocalPort)
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $LocalPort)
  try { $listener.Start(); return $true } catch { return $false } finally { try { $listener.Stop() } catch {} }
}

function Test-PortListening {
  param([Parameter(Mandatory = $true)][int]$LocalPort)
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $async = $client.BeginConnect([Net.IPAddress]::Loopback, $LocalPort, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(250)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch { return $false } finally { $client.Dispose() }
}

function Wait-ForProcessExit {
  param($Process, [int]$TimeoutSeconds)
  if ($null -eq $Process -or -not (Test-ProcessHandleAlive $Process)) { return $true }
  return $Process.WaitForExit($TimeoutSeconds * 1000)
}

function New-CanonicalClosureIntent {
  param($RunnerIdentity, [hashtable]$IntentPaths, [string]$ExternalFinalizerScript, [string]$RunIdentifier)
  [ordered]@{
    contract = 'agm-instrumentation-lifecycle-closure-intent.v2'
    contractVersion = 2
    publishedAt = [DateTimeOffset]::UtcNow.ToString('o')
    publication = [ordered]@{ atomic=$true; overwriteForbidden=$true }
    runId = $RunIdentifier
    phase = 'RUNNER_CLEANUP_COMPLETE_PENDING_EXTERNAL_FINALIZATION'
    runner = $RunnerIdentity
    windowIdentity = [ordered]@{ runId=$RunIdentifier; windowId=$RunIdentifier; signature=Get-OutputFileSignature $IntentPaths.window }
    manifestReference = [ordered]@{ pathBase='OUTPUT_ROOT'; path='SHA256SUMS.json'; hashAlgorithm='SHA256'; immutableAfterHash=$true }
    inputs = [ordered]@{
      shutdown = Get-OutputFileSignature $IntentPaths.shutdown
      managedRoots = Get-OutputFileSignature $IntentPaths.managedRoots
      priorInventory = Get-OutputFileSignature $IntentPaths.priorInventory
      knownProtectedBackground = Get-OutputFileSignature $IntentPaths.knownProtectedBackground
    }
    outputs = [ordered]@{ finalInventory='process-inventory-after.json'; analysis='instrumentation-lifecycle-analysis.json'; verdict='external-finalizer-verdict.json'; finalizerLifecycle='external-finalizer-lifecycle.json' }
    externalFinalizerSource = [ordered]@{ pathBase='WORKSPACE_ROOT'; path='scripts/Invoke-InstrumentationLifecycleExternalFinalizer.ps1'; bytes=(Get-Item $ExternalFinalizerScript).Length; sha256=(Get-FileHash -Algorithm SHA256 $ExternalFinalizerScript).Hash.ToLowerInvariant() }
    runnerMustExitBeforeFinalInventory = $true
    finalizerMustDeclareExactIdentity = $true
  }
}

$outputFull = [IO.Path]::GetFullPath($OutputRoot)
$externalFinalizerScript = Join-Path $root 'scripts/Invoke-InstrumentationLifecycleExternalFinalizer.ps1'
$closureIntentContractScript = Join-Path $root 'scripts/closure-intent-contract.mjs'
if ($HandoffIntegrationProducer) {
  [IO.Directory]::CreateDirectory($outputFull) | Out-Null
  $integrationPaths = @{
    window=Join-Path $outputFull 'window.json'; shutdown=Join-Path $outputFull 'shutdown.json'; managedRoots=Join-Path $outputFull 'managed-process-roots.json';
    priorInventory=Join-Path $outputFull 'managed-process-tree-before-shutdown.json'; knownProtectedBackground=Join-Path $outputFull 'known-protected-background.json'
  }
  foreach ($required in $integrationPaths.Values) { if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "HANDOFF_INTEGRATION_SEED_MISSING_$required" } }
  $identity = Get-ManagedProcessIdentity -Process $runnerProcess -Role 'LIFECYCLE_RUNNER' -ExpectedStartTimeUtc $runnerStartTimeUtc
  $intent = New-CanonicalClosureIntent -RunnerIdentity $identity -IntentPaths $integrationPaths -ExternalFinalizerScript $externalFinalizerScript -RunIdentifier $runId
  $candidate = Join-Path $outputFull ".closure-intent-validation-$PID.json"
  try { Write-JsonEvidence $intent $candidate; & node $closureIntentContractScript $candidate $root $outputFull | Out-Null; if($LASTEXITCODE-ne 0){throw 'HANDOFF_INTEGRATION_PRODUCER_SCHEMA_FAIL'} }
  finally { Remove-Item -LiteralPath $candidate -ErrorAction SilentlyContinue }
  Publish-JsonEvidenceAtomic $intent (Join-Path $outputFull 'closure-intent.json')
  Write-Output "HANDOFF INTEGRATION PRODUCER COMPLETE / $outputFull"
  exit 0
}

$PreflightInventoryPath = [string]$PreflightInventoryPath
if ([string]::IsNullOrWhiteSpace($PreflightInventoryPath)) { throw 'PREFLIGHT_INVENTORY_PATH_REQUIRED' }
$preflightFull = [IO.Path]::GetFullPath($PreflightInventoryPath)
$canonicalPreflightFull = Join-Path $outputFull 'process-inventory-before.json'
$knownProtectedBackgroundPath = Join-Path $outputFull 'known-protected-background.json'
$workspaceFull = [IO.Path]::GetFullPath($root).TrimEnd('\')
if (-not $outputFull.StartsWith("$workspaceFull\", [StringComparison]::OrdinalIgnoreCase)) { throw 'OUTPUT_ROOT_OUTSIDE_WORKSPACE' }
if (-not $preflightFull.StartsWith("$outputFull\", [StringComparison]::OrdinalIgnoreCase)) { throw 'PREFLIGHT_INVENTORY_OUTSIDE_OUTPUT_ROOT' }
if (-not [string]::Equals($preflightFull, $canonicalPreflightFull, [StringComparison]::OrdinalIgnoreCase)) { throw 'PREFLIGHT_CANONICAL_FILENAME_REQUIRED' }
if (-not (Test-Path -LiteralPath $preflightFull)) { throw 'PREFLIGHT_INVENTORY_MISSING' }
$unexpectedExisting = @(Get-ChildItem -LiteralPath $outputFull -Force | Where-Object {
  $_.FullName -ne $preflightFull `
    -and $_.Name -ne 'known-protected-background.json' `
    -and $_.Name -ne 'RESCUE_JOURNAL.md' `
    -and $_.Name -notlike 'process-inventory-before-attempt-*.json'
})
if ($unexpectedExisting.Count -ne 0) { throw 'OUTPUT_ROOT_NOT_CLEAN' }
if (-not (Test-Path -LiteralPath $knownProtectedBackgroundPath)) { throw 'KNOWN_PROTECTED_BACKGROUND_EVIDENCE_MISSING' }

$preflight = Get-Content -Raw -LiteralPath $preflightFull | ConvertFrom-Json
if ($preflight.contract -ne 'agm-instrumentation-lifecycle-process-inventory.v2' `
  -or $preflight.identityContract -ne 'agm-instrumentation-sanitized-process-identity.v2' `
  -or [string]$preflight.runId -ne $runId `
  -or $preflight.capturePhase -ne 'PREFLIGHT' `
  -or $preflight.trafficGenerated -ne $false `
  -or [int]$preflight.processChanges -ne 0 `
  -or $null -eq $preflight.matchCounts `
  -or $null -eq $preflight.knownProtectedBackground `
  -or $null -eq $preflight.queryAttempts `
  -or [int]$preflight.queryAttempts -lt 1) { throw 'PREFLIGHT_PROCESS_SCHEMA_INVALID' }
if ($preflight.queryStatus -ne 'SUCCESS') { throw 'PREFLIGHT_PROCESS_QUERY_NOT_SUCCESSFUL' }
if ($preflight.coverageStatus -notin @('COMPLETE_FOR_CANDIDATE_IMAGES', 'COMPLETE_WITH_IDENTITY_BOUND_KNOWN_PROTECTED_BACKGROUND') `
  -or [int]$preflight.knownProtectedBackground.unclassifiedUnavailableCount -ne 0) { throw 'PREFLIGHT_PROCESS_VISIBILITY_INCOMPLETE' }
if ([int]$preflight.matchCounts.p9 -ne 0 -or [int]$preflight.matchCounts.observer -ne 0) { throw 'PREFLIGHT_P9_OR_OBSERVER_PROCESS_FOUND' }
$preflightCapturedAt = if ($preflight.capturedAt) { $preflight.capturedAt } else { $preflight.captureStartedAt }
$preflightAgeSeconds = ([DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse($preflightCapturedAt)).TotalSeconds
if ($preflightAgeSeconds -lt 0 -or $preflightAgeSeconds -gt 900) { throw 'PREFLIGHT_PROCESS_INVENTORY_STALE' }
if (-not (Test-PortAvailable -LocalPort $Port)) { throw "DIAGNOSTIC_PORT_${Port}_IN_USE" }

$killSwitchPath = Join-Path $root 'evidence/governance/copilot-v1.2/p9/runtime/kill-switch-evidence.json'
$dailyMonitorPath = Join-Path $root 'evidence/governance/copilot-v1.2/p9/daily-monitor/latest.json'
$soakStatePath = Join-Path $root 'evidence/governance/copilot-v1.2/p9/soak/soak-state.json'
$policyPath = Join-Path $root 'config/copilot-v1.2/p9-pilot-policy.json'
foreach ($required in @($killSwitchPath, $dailyMonitorPath, $soakStatePath, $policyPath)) {
  if (-not (Test-Path -LiteralPath $required)) { throw "OPERATIONAL_EVIDENCE_MISSING_$required" }
}
$killSwitch = Get-Content -Raw -LiteralPath $killSwitchPath | ConvertFrom-Json
$dailyMonitor = Get-Content -Raw -LiteralPath $dailyMonitorPath | ConvertFrom-Json
$soakState = Get-Content -Raw -LiteralPath $soakStatePath | ConvertFrom-Json
$policy = Get-Content -Raw -LiteralPath $policyPath | ConvertFrom-Json
if ($killSwitch.killSwitch -ne 'PASS' -or [int]$killSwitch.orphans -ne 0) { throw 'INHERITED_KILL_SWITCH_EVIDENCE_INVALID' }
if ($dailyMonitor.turn.p9 -ne 'STOPPED' -or $dailyMonitor.turn.killSwitch -ne 'ACTIVE') { throw 'DAILY_MONITOR_NOT_P9_STOPPED' }
if ($soakState.status -notin @('STOP_IMMEDIATE', 'STOPPED')) { throw 'SOAK_STATE_NOT_STOPPED' }
if ($policy.environment -ne 'PRE_PRODUCTION_INTERNAL' -or $policy.externalWriteAllowed -ne $false -or $policy.productionReachable -ne $false) { throw 'P9_POLICY_NOT_READ_ONLY_INTERNAL' }

$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
  $databaseLine = (Select-String -Path (Join-Path $root '.env') -Pattern '^DATABASE_URL=' | Select-Object -First 1).Line
  if ($databaseLine) { $databaseUrl = $databaseLine.Substring($databaseLine.IndexOf('=') + 1).Trim([char]34) }
}
if (-not $databaseUrl) { throw 'DIAGNOSTIC_DATABASE_TARGET_MISSING' }
$databaseUri = [Uri]$databaseUrl
if ($databaseUri.Host -notin @('localhost', '127.0.0.1', '::1')) { throw 'DIAGNOSTIC_DATABASE_TARGET_NOT_LOOPBACK' }

$hostSamplerScript = Join-Path $root 'scripts/Sample-RealBasicHost.ps1'
$processSamplerScript = Join-Path $root 'scripts/Sample-RealBasicProcesses.ps1'
$clientProbeScript = Join-Path $root 'scripts/instrumentation-lifecycle-probe.mjs'
$analyzerScript = Join-Path $root 'scripts/analyze-instrumentation-lifecycle-cycle.mjs'
$closureIntentContractScript = Join-Path $root 'scripts/closure-intent-contract.mjs'
$inventoryScript = Join-Path $root 'scripts/Get-InstrumentationLifecycleProcessInventory.ps1'
$hashScript = Join-Path $root 'scripts/hash-instrumentation-lifecycle-evidence.mjs'
$preloadScript = Join-Path $root 'scripts/server-correlated-diagnostic-preload.cjs'
$genericRunner = Join-Path $root 'scripts/Invoke-RealBasicTimeoutInvestigation.ps1'
$externalFinalizerScript = Join-Path $root 'scripts/Invoke-InstrumentationLifecycleExternalFinalizer.ps1'
$sourceFiles = @(
  $PSCommandPath, $hostSamplerScript, $processSamplerScript, $clientProbeScript, $analyzerScript,
  $inventoryScript, $hashScript, $preloadScript, $genericRunner, $externalFinalizerScript, $closureIntentContractScript,
  (Join-Path $root 'apps/api/src/main.ts'),
  (Join-Path $root 'apps/api/src/http-application.ts'),
  (Join-Path $root 'apps/api/src/prisma/prisma.service.ts')
)
foreach ($source in $sourceFiles) { if (-not (Test-Path -LiteralPath $source)) { throw "SOURCE_MISSING_$source" } }

$tsNode = Get-ChildItem (Join-Path $root 'node_modules/.pnpm') -Directory -Filter 'ts-node@*' |
  ForEach-Object { Join-Path $_.FullName 'node_modules/ts-node/dist/bin.js' } |
  Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $tsNode) { throw 'TS_NODE_EXISTING_DEPENDENCY_NOT_FOUND' }

$paths = [ordered]@{
  authorization = Join-Path $outputFull 'authorization.json'
  custody = Join-Path $outputFull 'custody.json'
  database = Join-Path $outputFull 'database-target.json'
  sourceSignatures = Join-Path $outputFull 'source-signatures.json'
  serverTelemetry = Join-Path $outputFull 'server-correlated-telemetry.jsonl'
  hostTelemetry = Join-Path $outputFull 'host-telemetry.jsonl'
  processTelemetry = Join-Path $outputFull 'process-telemetry.jsonl'
  hostLifecycle = Join-Path $outputFull 'host-sampler-lifecycle.json'
  processLifecycle = Join-Path $outputFull 'process-sampler-lifecycle.json'
  samplerBoundary = Join-Path $outputFull 'client-boundary.json'
  samplerRelease = Join-Path $outputFull 'sampler-release.json'
  hostBoundaryReady = Join-Path $outputFull 'host-boundary-ready.json'
  processBoundaryReady = Join-Path $outputFull 'process-boundary-ready.json'
  processStart = Join-Path $outputFull 'window-start.json'
  clientReady = Join-Path $outputFull 'client-ready.json'
  clientTimeline = Join-Path $outputFull 'client-timeline.json'
  clientEvents = Join-Path $outputFull 'client-events.jsonl'
  readiness = Join-Path $outputFull 'readiness.json'
  window = Join-Path $outputFull 'window.json'
  overhead = Join-Path $outputFull 'observer-overhead.json'
  shutdown = Join-Path $outputFull 'shutdown.json'
  managedRoots = Join-Path $outputFull 'managed-process-roots.json'
  beforeWindowInventory = Join-Path $outputFull 'managed-process-tree-before-window.json'
  preShutdownInventory = Join-Path $outputFull 'managed-process-tree-before-shutdown.json'
  finalInventory = Join-Path $outputFull 'process-inventory-after.json'
  closureIntent = Join-Path $outputFull 'closure-intent.json'
  runnerError = Join-Path $outputFull 'runner-error.json'
}

$authorization = [ordered]@{
  contract = 'agm-instrumentation-lifecycle-closure-authorization.v1'
  recordedAt = [DateTimeOffset]::UtcNow.ToString('o')
  ownerGate = $ownerReviewGate
  singleWindow = $true
  durationSeconds = $DurationSeconds
  p9 = 'STOPPED'
  p9Traffic = 0
  killSwitch = 'ACTIVE / INHERITED_OPERATIONAL_EVIDENCE'
  officialBasicSloMs = 3000
  officialBasicSloUnchanged = $true
  officialSoakRestarted = $false
  hostSampleIntervalSeconds = $HostSampleIntervalSeconds
  processSampleIntervalSeconds = $ProcessSampleIntervalSeconds
  faultInjection = $false
  deploy = $false
  postgresqlRestart = $false
  infrastructureChanges = $false
  productionChanges = $false
  basicFunctionalChanges = $false
  externalWrites = 0
  automaticRepeat = $false
  finalVerdictProhibited = 'PASS / CLOSED'
  knownProtectedBackground = Get-FileSignature $knownProtectedBackgroundPath
  externalFinalizerSource = Get-FileSignature $externalFinalizerScript
}
Write-JsonEvidence -Value $authorization -Path $paths.authorization
Write-JsonEvidence -Value ([ordered]@{ contract = 'agm-instrumentation-lifecycle-database-target.v1'; host = $databaseUri.Host; port = $databaseUri.Port; database = $databaseUri.AbsolutePath.TrimStart('/'); loopback = $true; credentialsRecorded = $false }) -Path $paths.database
Write-JsonEvidence -Value ([ordered]@{ contract = 'agm-instrumentation-lifecycle-source-signatures.v1'; capturedAt = [DateTimeOffset]::UtcNow.ToString('o'); files = @($sourceFiles | ForEach-Object { Get-FileSignature $_ }) }) -Path $paths.sourceSignatures

$custody = [ordered]@{
  contract = 'agm-instrumentation-lifecycle-closure-custody.v1'
  runId = $runId
  runnerPid = $PID
  runnerStartTimeUtc = $runnerStartTimeUtc
  startedAt = $runnerStartedAt.ToString('o')
  preflightInventory = Get-FileSignature $preflightFull
  p9 = 'STOPPED'
  singleWindow = $true
  p9Launched = $false
  p9Traffic = 0
  p9TrafficGenerated = $false
  killSwitch = 'ACTIVE'
  killSwitchEvidenceSemantics = 'INHERITED_OPERATIONAL_EVIDENCE / NOT RECERTIFIED_IN_THIS_GATE'
  officialSoakRestarted = $false
  officialBasicSloMs = 3000
  officialBasicSloUnchanged = $true
  faultInjection = $false
  deployPerformed = $false
  postgresRestarted = $false
  infrastructureChanges = 0
  diagnosticApi = [ordered]@{ loopback = $true; port = $Port; temporary = $true; production = $false }
  gateEvidence = [ordered]@{ killSwitch = Get-FileSignature $killSwitchPath; dailyMonitor = Get-FileSignature $dailyMonitorPath; soakState = Get-FileSignature $soakStatePath; policy = Get-FileSignature $policyPath; knownProtectedBackground = Get-FileSignature $knownProtectedBackgroundPath }
  restrictions = [ordered]@{ p9Activation = 0; p9Traffic = 0; faultInjection = 0; postgresRestart = 0; deploy = 0; infrastructureChanges = 0; productionChanges = 0; externalWrites = 0 }
}
Write-JsonEvidence -Value $custody -Path $paths.custody

$environmentNames = @('NODE_OPTIONS', 'AGM_CORRELATED_TELEMETRY_PATH', 'AGM_CORRELATED_RUN_ID', 'AGM_DIAGNOSTIC_FAULTS', 'PORT', 'API_HOST', 'NODE_ENV')
$priorEnvironment = @{}
foreach ($name in $environmentNames) {
  $environmentItem = Get-Item "Env:$name" -ErrorAction SilentlyContinue
  $priorEnvironment[$name] = if ($null -ne $environmentItem) { $environmentItem.Value } else { $null }
}

$api = $null
$hostSampler = $null
$processSampler = $null
$client = $null
$runFailure = $null
$forcedProcesses = [System.Collections.Generic.List[int]]::new()
$cleanupErrors = [System.Collections.Generic.List[string]]::new()
$boundarySignalCreatedAt = $null
$boundaryObservedByRunnerAt = $null
$releaseSignalCreatedAt = $null
$apiFlushResult = 'NOT_ATTEMPTED'
$windowEvidence = $null
$boundaryEvidence = $null
$observerStart = $null
$observerBoundary = $null
$observerFinalizationEnd = $null
$hostBoundaryReady = $null
$processBoundaryReady = $null
$hostReadyAt = $null
$processReadyAt = $null
$clientReadyAt = $null
$hostSamplerStartTimeUtc = $null
$processSamplerStartTimeUtc = $null
$clientStartTimeUtc = $null
$managedRootIdentities = @()

try {
  Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
  Remove-Item Env:AGM_DIAGNOSTIC_FAULTS -ErrorAction SilentlyContinue
  $env:PORT = "$Port"
  $env:API_HOST = '127.0.0.1'
  $env:NODE_ENV = 'test'
  $env:AGM_CORRELATED_TELEMETRY_PATH = $paths.serverTelemetry
  $env:AGM_CORRELATED_RUN_ID = $runId
  $api = Start-Process node.exe -ArgumentList @('--require', $preloadScript, '--expose-gc', $tsNode, 'src/main.ts') `
    -WorkingDirectory (Join-Path $root 'apps/api') `
    -RedirectStandardOutput (Join-Path $outputFull 'api.stdout.log') `
    -RedirectStandardError (Join-Path $outputFull 'api.stderr.log') `
    -WindowStyle Hidden -PassThru
  $apiStartTimeUtc = $api.StartTime.ToUniversalTime().ToString('o')
  foreach ($name in $environmentNames) { Restore-EnvironmentValue -Name $name -Value $priorEnvironment[$name] }

  $apiReady = $false
  for ($index = 0; $index -lt 360; $index += 1) {
    if (-not (Test-ProcessHandleAlive $api)) { throw "DIAGNOSTIC_API_EXITED_BEFORE_READY_$($api.ExitCode)" }
    if (Test-PortListening -LocalPort $Port) { $apiReady = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $apiReady) { throw 'DIAGNOSTIC_API_START_TIMEOUT' }

  $hostSampler = Start-Process powershell.exe -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $hostSamplerScript,
    '-ApiPid', $api.Id, '-ApiStartTimeUtc', $apiStartTimeUtc,
    '-ParentPid', $PID, '-ParentStartTimeUtc', $runnerStartTimeUtc,
    '-Output', $paths.hostTelemetry, '-StopSignal', $paths.samplerBoundary,
    '-ReleaseSignal', $paths.samplerRelease, '-BoundaryReadyOutput', $paths.hostBoundaryReady,
    '-LifecycleOutput', $paths.hostLifecycle, '-RunId', $runId,
    '-SampleIntervalSeconds', $HostSampleIntervalSeconds, '-MaxRuntimeMinutes', $SamplerMaxRuntimeMinutes
  ) -WorkingDirectory $root -RedirectStandardOutput (Join-Path $outputFull 'host-sampler.stdout.log') -RedirectStandardError (Join-Path $outputFull 'host-sampler.stderr.log') -WindowStyle Hidden -PassThru
  $hostSamplerStartTimeUtc = Get-ProcessStartTimeUtc $hostSampler
  try { $hostSampler.PriorityClass = 'Normal' } catch {}

  $processSampler = Start-Process powershell.exe -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $processSamplerScript,
    '-ApiPid', $api.Id, '-ApiStartTimeUtc', $apiStartTimeUtc,
    '-ParentPid', $PID, '-ParentStartTimeUtc', $runnerStartTimeUtc,
    '-Output', $paths.processTelemetry, '-StopSignal', $paths.samplerBoundary,
    '-ReleaseSignal', $paths.samplerRelease, '-BoundaryReadyOutput', $paths.processBoundaryReady,
    '-LifecycleOutput', $paths.processLifecycle, '-RunId', $runId,
    '-StartSignal', $paths.processStart,
    '-SampleIntervalSeconds', $ProcessSampleIntervalSeconds, '-MaxRuntimeMinutes', $SamplerMaxRuntimeMinutes
  ) -WorkingDirectory $root -RedirectStandardOutput (Join-Path $outputFull 'process-sampler.stdout.log') -RedirectStandardError (Join-Path $outputFull 'process-sampler.stderr.log') -WindowStyle Hidden -PassThru
  $processSamplerStartTimeUtc = Get-ProcessStartTimeUtc $processSampler
  try { $processSampler.PriorityClass = 'Normal' } catch {}

  for ($index = 0; $index -lt 180; $index += 1) {
    if (-not (Test-ProcessHandleAlive $hostSampler)) { throw "HOST_SAMPLER_EXITED_DURING_READINESS_$($hostSampler.ExitCode)" }
    if (-not (Test-ProcessHandleAlive $processSampler)) { throw "PROCESS_SAMPLER_EXITED_DURING_READINESS_$($processSampler.ExitCode)" }
    $hostRows = @(Get-JsonlRecords $paths.hostTelemetry)
    $processRows = @(Get-JsonlRecords $paths.processTelemetry)
    if ($hostRows.Count -ge 2 -and $processRows.Count -ge 1) {
      if (@($hostRows | Where-Object { $_.runId -ne $runId -or [int]$_.samplerPid -ne $hostSampler.Id }).Count -ne 0) { throw 'HOST_READINESS_IDENTITY_MISMATCH' }
      if (@($processRows | Where-Object { $_.runId -ne $runId -or [int]$_.samplerPid -ne $processSampler.Id }).Count -ne 0) { throw 'PROCESS_READINESS_IDENTITY_MISMATCH' }
      $hostReadyAt = [DateTimeOffset]::UtcNow.ToString('o')
      $processReadyAt = $hostReadyAt
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $hostReadyAt -or -not $processReadyAt) { throw 'SAMPLER_READINESS_TIMEOUT' }

  $baseUrl = "http://127.0.0.1:$Port/api/v1"
  $client = Start-Process node.exe -ArgumentList @(
    $clientProbeScript, '--base-url', $baseUrl, '--output', $paths.clientTimeline,
    '--events-output', $paths.clientEvents, '--run-id', $runId,
    '--duration-seconds', $DurationSeconds, '--request-interval-ms', 1000,
    '--ready-file', $paths.clientReady, '--start-signal', $paths.processStart,
    '--boundary-signal', $paths.samplerBoundary,
    '--parent-pid', $PID
  ) -WorkingDirectory $root -RedirectStandardOutput (Join-Path $outputFull 'client.stdout.log') -RedirectStandardError (Join-Path $outputFull 'client.stderr.log') -WindowStyle Hidden -PassThru
  $clientStartTimeUtc = Get-ProcessStartTimeUtc $client
  try { $client.PriorityClass = 'Normal' } catch {}
  for ($index = 0; $index -lt 120; $index += 1) {
    if (-not (Test-ProcessHandleAlive $client)) { throw "CLIENT_EXITED_BEFORE_READY_$($client.ExitCode)" }
    if (Test-Path -LiteralPath $paths.clientReady) { $clientReadyAt = [DateTimeOffset]::UtcNow.ToString('o'); break }
    Start-Sleep -Milliseconds 250
  }
  if (-not $clientReadyAt) { throw 'CLIENT_READINESS_TIMEOUT' }

  $managedRootIdentities = @(
    Get-ManagedProcessIdentity -Process $api -Role 'API' -ExpectedStartTimeUtc $apiStartTimeUtc
    Get-ManagedProcessIdentity -Process $hostSampler -Role 'HOST_SAMPLER' -ExpectedStartTimeUtc $hostSamplerStartTimeUtc
    Get-ManagedProcessIdentity -Process $processSampler -Role 'PROCESS_SAMPLER' -ExpectedStartTimeUtc $processSamplerStartTimeUtc
    Get-ManagedProcessIdentity -Process $client -Role 'CLIENT' -ExpectedStartTimeUtc $clientStartTimeUtc
  )
  Write-JsonEvidence -Value ([ordered]@{
    contract = 'agm-instrumentation-lifecycle-managed-process-roots.v2'
    runId = $runId
    capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
    managedRoots = $managedRootIdentities
    identity = 'PID_CREATION_EPOCH_MS_IMAGE_EXECUTABLE_PATH_SHA256_COMMAND_LINE_SHA256'
    identityHashAlgorithm = 'SHA256'
    rawExecutablePathsRecorded = $false
    rawCommandLinesRecorded = $false
    descendantModel = 'IDENTITY_AND_TEMPORALLY_VALIDATED_WINDOWS_PARENT_PROCESS_ID_LINEAGE'
  }) -Path $paths.managedRoots

  & $inventoryScript -Output $paths.beforeWindowInventory -TrackedRootsPath $paths.managedRoots -KnownProtectedBackgroundPath $knownProtectedBackgroundPath -RunId $runId -Phase 'BEFORE_WINDOW'
  $beforeWindowInventory = Get-Content -Raw -LiteralPath $paths.beforeWindowInventory | ConvertFrom-Json
  if ($beforeWindowInventory.queryStatus -ne 'SUCCESS' `
    -or $beforeWindowInventory.runId -ne $runId -or $beforeWindowInventory.capturePhase -ne 'BEFORE_WINDOW' `
    -or $beforeWindowInventory.coverageStatus -notin @('COMPLETE_FOR_CANDIDATE_IMAGES', 'COMPLETE_WITH_IDENTITY_BOUND_KNOWN_PROTECTED_BACKGROUND') `
    -or [int]$beforeWindowInventory.knownProtectedBackground.unclassifiedUnavailableCount -ne 0) {
    throw 'BEFORE_WINDOW_PROCESS_TREE_INVENTORY_UNRELIABLE'
  }
  if ([int]$beforeWindowInventory.matchCounts.p9 -ne 0) { throw 'P9_PROCESS_FOUND_BEFORE_AUTHORIZED_WINDOW' }

  $scheduledStart = [DateTimeOffset]::UtcNow.AddSeconds(2)
  Publish-JsonEvidenceAtomic -Value ([ordered]@{ contract = 'agm-instrumentation-lifecycle-window-start.v1'; runId = $runId; windowId = $runId; startAtEpochMs = $scheduledStart.ToUnixTimeMilliseconds(); startAt = $scheduledStart.ToString('o'); durationSeconds = $DurationSeconds; p9 = 'STOPPED'; faultInjection = $false }) -Path $paths.processStart
  Write-JsonEvidence -Value ([ordered]@{ contract = 'agm-instrumentation-lifecycle-readiness.v1'; recordedAt = [DateTimeOffset]::UtcNow.ToString('o'); api = [ordered]@{ pid = $api.Id; startTimeUtc = $apiStartTimeUtc; ready = $true }; hostSampler = [ordered]@{ pid = $hostSampler.Id; readyAt = $hostReadyAt; rows = @(Get-JsonlRecords $paths.hostTelemetry).Count }; processSampler = [ordered]@{ pid = $processSampler.Id; readyAt = $processReadyAt; baselineRows = @(Get-JsonlRecords $paths.processTelemetry).Count }; client = [ordered]@{ pid = $client.Id; readyAt = $clientReadyAt }; formalStartAt = $scheduledStart.ToString('o') }) -Path $paths.readiness

  # Capture the observer numerator immediately adjacent to the declared formal
  # start. The timestamp is retained so any residual skew is measurable rather
  # than hidden in an early readiness baseline.
  $observerStartTarget = $scheduledStart.AddMilliseconds(-5)
  while ([DateTimeOffset]::UtcNow -lt $observerStartTarget) {
    if (-not (Test-ProcessHandleAlive $client)) { throw "CLIENT_EXITED_BEFORE_FORMAL_START_$($client.ExitCode)" }
    if (-not (Test-ProcessHandleAlive $hostSampler) -or -not (Test-ProcessHandleAlive $processSampler)) { throw 'SAMPLER_EXITED_BEFORE_FORMAL_START' }
    $remainingMs = [Math]::Max(1, [Math]::Min(50, ($observerStartTarget - [DateTimeOffset]::UtcNow).TotalMilliseconds))
    Start-Sleep -Milliseconds ([int]$remainingMs)
  }
  $observerStart = Get-ObserverCpuSnapshot -Runner $runnerProcess -HostSampler $hostSampler -ProcessSampler $processSampler -Api $api

  $clientDeadline = [DateTimeOffset]::UtcNow.AddSeconds($DurationSeconds + 30)
  while (Test-ProcessHandleAlive $client) {
    if (-not (Test-ProcessHandleAlive $hostSampler)) { throw "HOST_SAMPLER_EXITED_DURING_WINDOW_$($hostSampler.ExitCode)" }
    if (-not (Test-ProcessHandleAlive $processSampler)) { throw "PROCESS_SAMPLER_EXITED_DURING_WINDOW_$($processSampler.ExitCode)" }
    if (-not (Test-ProcessHandleAlive $api)) { throw "API_EXITED_DURING_WINDOW_$($api.ExitCode)" }
    if ([DateTimeOffset]::UtcNow -ge $clientDeadline) { throw 'CLIENT_WINDOW_DEADLINE_EXCEEDED' }
    if (-not $observerBoundary -and (Test-Path -LiteralPath $paths.samplerBoundary)) {
      $boundaryEvidence = Get-Content -Raw -LiteralPath $paths.samplerBoundary | ConvertFrom-Json
      if ($boundaryEvidence.contract -ne 'agm-instrumentation-lifecycle-sampler-boundary.v1' `
        -or $boundaryEvidence.runId -ne $runId `
        -or $boundaryEvidence.windowId -ne $runId `
        -or [int]$boundaryEvidence.clientPid -ne [int]$client.Id `
        -or $boundaryEvidence.reason -ne 'CLIENT_WINDOW_COMPLETED') {
        throw 'CLIENT_BOUNDARY_IDENTITY_MISMATCH'
      }
      [DateTimeOffset]::Parse([string]$boundaryEvidence.requestedAt) | Out-Null
      [DateTimeOffset]::Parse([string]$boundaryEvidence.clientCompletedAt) | Out-Null
      $boundarySignalCreatedAt = [string]$boundaryEvidence.requestedAt
      $boundaryObservedByRunnerAt = [DateTimeOffset]::UtcNow.ToString('o')
      $observerBoundary = Get-ObserverCpuSnapshot -Runner $runnerProcess -HostSampler $hostSampler -ProcessSampler $processSampler -Api $api
    }
    Start-Sleep -Milliseconds 100
  }
  # Start-Process can report HasExited before its managed Process object has
  # populated ExitCode. Reap/refresh the already-exited handle before deciding
  # custody so a successful client is not converted into a blank exit failure.
  $client.WaitForExit()
  $clientWindowExitCode = Get-ProcessExitCodeSafe $client
  if ($null -eq $clientWindowExitCode -or $clientWindowExitCode -ne 0) {
    throw "CLIENT_WINDOW_EXIT_$clientWindowExitCode"
  }
  # If the process exited between the last polling iterations, close the CPU
  # numerator from the already-published boundary before parsing the large
  # request timeline. Publication lag remains explicit in overhead evidence.
  if (-not $observerBoundary -and (Test-Path -LiteralPath $paths.samplerBoundary)) {
    $boundaryEvidence = Get-Content -Raw -LiteralPath $paths.samplerBoundary | ConvertFrom-Json
    if ($boundaryEvidence.contract -ne 'agm-instrumentation-lifecycle-sampler-boundary.v1' `
      -or $boundaryEvidence.runId -ne $runId `
      -or $boundaryEvidence.windowId -ne $runId `
      -or [int]$boundaryEvidence.clientPid -ne [int]$client.Id) { throw 'CLIENT_BOUNDARY_IDENTITY_MISMATCH_AFTER_EXIT' }
    $boundarySignalCreatedAt = [string]$boundaryEvidence.requestedAt
    $boundaryObservedByRunnerAt = [DateTimeOffset]::UtcNow.ToString('o')
    $observerBoundary = Get-ObserverCpuSnapshot -Runner $runnerProcess -HostSampler $hostSampler -ProcessSampler $processSampler -Api $api
  }
  if (-not (Test-Path -LiteralPath $paths.clientTimeline)) { throw 'CLIENT_TIMELINE_MISSING' }
  $clientTimeline = Get-Content -Raw -LiteralPath $paths.clientTimeline | ConvertFrom-Json
  if ([double]$clientTimeline.window.observedDurationMs -lt ($DurationSeconds * 1000)) { throw 'CLIENT_WINDOW_SHORTER_THAN_AUTHORIZED' }
  $windowEvidence = $clientTimeline.window
  if (-not (Test-Path -LiteralPath $paths.samplerBoundary)) { throw 'CLIENT_BOUNDARY_SIGNAL_MISSING' }
  $boundaryEvidence = Get-Content -Raw -LiteralPath $paths.samplerBoundary | ConvertFrom-Json
  if ($boundaryEvidence.contract -ne 'agm-instrumentation-lifecycle-sampler-boundary.v1' `
    -or $boundaryEvidence.runId -ne $runId `
    -or $boundaryEvidence.windowId -ne $runId `
    -or [int]$boundaryEvidence.clientPid -ne [int]$client.Id `
    -or $boundaryEvidence.clientCompletedAt -ne $windowEvidence.completedAt `
    -or $clientTimeline.boundary.clientCompletedAt -ne $windowEvidence.completedAt) {
    throw 'CLIENT_BOUNDARY_WINDOW_BINDING_MISMATCH'
  }
  $boundarySignalCreatedAt = [string]$boundaryEvidence.requestedAt
  if (-not $observerBoundary) {
    $boundaryObservedByRunnerAt = [DateTimeOffset]::UtcNow.ToString('o')
    $observerBoundary = Get-ObserverCpuSnapshot -Runner $runnerProcess -HostSampler $hostSampler -ProcessSampler $processSampler -Api $api
  }

  $boundaryReadyDeadline = [DateTimeOffset]::UtcNow.AddSeconds(30)
  while ((-not (Test-Path -LiteralPath $paths.hostBoundaryReady) -or -not (Test-Path -LiteralPath $paths.processBoundaryReady)) `
    -and [DateTimeOffset]::UtcNow -lt $boundaryReadyDeadline) {
    if (-not (Test-ProcessHandleAlive $hostSampler) -or -not (Test-ProcessHandleAlive $processSampler)) { throw 'SAMPLER_EXITED_BEFORE_BOUNDARY_ACK' }
    Start-Sleep -Milliseconds 100
  }
  if (-not (Test-Path -LiteralPath $paths.hostBoundaryReady) -or -not (Test-Path -LiteralPath $paths.processBoundaryReady)) { throw 'SAMPLER_BOUNDARY_ACK_TIMEOUT' }
  $hostBoundaryReady = Get-Content -Raw -LiteralPath $paths.hostBoundaryReady | ConvertFrom-Json
  $processBoundaryReady = Get-Content -Raw -LiteralPath $paths.processBoundaryReady | ConvertFrom-Json
  foreach ($ack in @($hostBoundaryReady, $processBoundaryReady)) {
    if ($ack.contract -ne 'agm-real-basic-sampler-boundary-ready.v1' `
      -or $ack.runId -ne $runId `
      -or $ack.boundary.contract -ne $boundaryEvidence.contract `
      -or $ack.boundary.requestedAt -ne $boundaryEvidence.requestedAt `
      -or $ack.boundary.clientCompletedAt -ne $boundaryEvidence.clientCompletedAt `
      -or $ack.periodicSamplingStopped -ne $true `
      -or $ack.quiescentUntilRelease -ne $true) {
      throw 'SAMPLER_BOUNDARY_ACK_BINDING_MISMATCH'
    }
  }
  if ($hostBoundaryReady.role -ne 'HOST' -or [int]$hostBoundaryReady.samplerPid -ne [int]$hostSampler.Id `
    -or $hostBoundaryReady.samplerStartTimeUtc -ne $hostSamplerStartTimeUtc `
    -or $hostBoundaryReady.finalSample.sampleKind -ne 'BOUNDARY_FINAL' `
    -or [DateTimeOffset]::Parse([string]$hostBoundaryReady.finalSample.scheduledAt) -ne [DateTimeOffset]::Parse([string]$boundaryEvidence.clientCompletedAt)) { throw 'HOST_BOUNDARY_ACK_INVALID' }
  if ($processBoundaryReady.role -ne 'PROCESS' -or [int]$processBoundaryReady.samplerPid -ne [int]$processSampler.Id `
    -or $processBoundaryReady.samplerStartTimeUtc -ne $processSamplerStartTimeUtc `
    -or $processBoundaryReady.measurement.baseline.sampleKind -ne 'FORMAL_BASELINE' `
    -or $processBoundaryReady.measurement.final.sampleKind -ne 'MEASUREMENT_FINAL' `
    -or [int]$processBoundaryReady.measurement.expectedDurationSeconds -ne $DurationSeconds `
    -or $processBoundaryReady.measurement.snapshotSemantics -ne 'NON_ATOMIC_PROCESS_ENUMERATION_START_TO_START_DENOMINATOR' `
    -or [DateTimeOffset]::Parse([string]$processBoundaryReady.measurement.baseline.scheduledAt).ToUnixTimeMilliseconds() -ne $scheduledStart.ToUnixTimeMilliseconds() `
    -or [DateTimeOffset]::Parse([string]$processBoundaryReady.measurement.final.scheduledAt) -ne [DateTimeOffset]::Parse([string]$boundaryEvidence.clientCompletedAt)) { throw 'PROCESS_BOUNDARY_ACK_INVALID' }
  $processAckCadenceSeconds = ([DateTimeOffset]::Parse([string]$processBoundaryReady.measurement.final.captureStartedAt) - [DateTimeOffset]::Parse([string]$processBoundaryReady.measurement.baseline.captureStartedAt)).TotalSeconds
  if ([Math]::Abs($processAckCadenceSeconds - [double]$processBoundaryReady.measurement.cadenceSeconds) -gt 0.001 `
    -or [Math]::Abs([double]$processBoundaryReady.measurement.cadenceDeviationSeconds) -gt 1) { throw 'PROCESS_BOUNDARY_ACK_CADENCE_INVALID' }
  foreach ($ack in @($hostBoundaryReady, $processBoundaryReady)) {
    if ([DateTimeOffset]::Parse([string]$ack.boundary.requestedAt) -lt [DateTimeOffset]::Parse([string]$ack.boundary.clientCompletedAt) `
      -or [DateTimeOffset]::Parse([string]$ack.boundary.observedAt) -lt [DateTimeOffset]::Parse([string]$ack.boundary.requestedAt) `
      -or [DateTimeOffset]::Parse([string]$ack.readyAt) -lt [DateTimeOffset]::Parse([string]$ack.boundary.observedAt)) { throw 'SAMPLER_BOUNDARY_ACK_ORDER_INVALID' }
  }
  $observerFinalizationEnd = Get-ObserverCpuSnapshot -Runner $runnerProcess -HostSampler $hostSampler -ProcessSampler $processSampler -Api $api

  & $inventoryScript -Output $paths.preShutdownInventory -TrackedRootsPath $paths.managedRoots -PriorInventoryPath $paths.beforeWindowInventory -KnownProtectedBackgroundPath $knownProtectedBackgroundPath -RunId $runId -Phase 'BEFORE_SHUTDOWN'
  $preShutdownInventory = Get-Content -Raw -LiteralPath $paths.preShutdownInventory | ConvertFrom-Json
  if ($preShutdownInventory.queryStatus -ne 'SUCCESS' `
    -or $preShutdownInventory.runId -ne $runId -or $preShutdownInventory.capturePhase -ne 'BEFORE_SHUTDOWN' `
    -or $preShutdownInventory.coverageStatus -notin @('COMPLETE_FOR_CANDIDATE_IMAGES', 'COMPLETE_WITH_IDENTITY_BOUND_KNOWN_PROTECTED_BACKGROUND') `
    -or [int]$preShutdownInventory.knownProtectedBackground.unclassifiedUnavailableCount -ne 0) {
    throw 'PRE_SHUTDOWN_PROCESS_TREE_INVENTORY_UNRELIABLE'
  }
  if ([int]$preShutdownInventory.matchCounts.p9 -ne 0) { throw 'P9_PROCESS_FOUND_DURING_AUTHORIZED_WINDOW' }
  $latestBoundaryReadyAt = @(
    [DateTimeOffset]::Parse([string]$hostBoundaryReady.readyAt),
    [DateTimeOffset]::Parse([string]$processBoundaryReady.readyAt)
  ) | Sort-Object -Descending | Select-Object -First 1
  if ([DateTimeOffset]::Parse([string]$preShutdownInventory.captureStartedAt) -lt $latestBoundaryReadyAt) { throw 'PRE_SHUTDOWN_INVENTORY_PRECEDES_BOUNDARY_ACK' }

  Publish-JsonEvidenceAtomic -Value ([ordered]@{
    contract = 'agm-instrumentation-lifecycle-sampler-release.v1'
    runId = $runId
    requestedAt = [DateTimeOffset]::UtcNow.ToString('o')
    reason = 'PRE_SHUTDOWN_INVENTORY_CAPTURED_AFTER_BOUNDARY_ACK'
    boundaryRequestedAt = $boundaryEvidence.requestedAt
    boundaryClientCompletedAt = $boundaryEvidence.clientCompletedAt
  }) -Path $paths.samplerRelease
  $releaseSignalCreatedAt = (Get-Content -Raw -LiteralPath $paths.samplerRelease | ConvertFrom-Json).requestedAt
  $samplerReleaseDeadline = [DateTimeOffset]::UtcNow.AddSeconds(20)
  while (((Test-ProcessHandleAlive $hostSampler) -or (Test-ProcessHandleAlive $processSampler)) -and [DateTimeOffset]::UtcNow -lt $samplerReleaseDeadline) { Start-Sleep -Milliseconds 100 }
  if ((Test-ProcessHandleAlive $hostSampler) -or (Test-ProcessHandleAlive $processSampler)) { throw 'SAMPLER_RELEASE_EXIT_TIMEOUT' }
  $hostSampler.WaitForExit()
  $processSampler.WaitForExit()
} catch {
  $runFailure = [ordered]@{
    contract = 'agm-instrumentation-lifecycle-runner-error.v1'
    at = [DateTimeOffset]::UtcNow.ToString('o')
    exceptionType = $_.Exception.GetType().FullName
    message = $_.Exception.Message
  }
} finally {
  try {
    if (($hostSampler -and (Test-ProcessHandleAlive $hostSampler)) -or ($processSampler -and (Test-ProcessHandleAlive $processSampler))) {
      try {
        if (-not (Test-Path -LiteralPath $paths.samplerBoundary)) {
          $cleanupBoundaryAt = [DateTimeOffset]::UtcNow
          Publish-JsonEvidenceAtomic -Value ([ordered]@{
            contract = 'agm-instrumentation-lifecycle-sampler-boundary.v1'
            runId = $runId
            windowId = $runId
            clientPid = if ($client) { $client.Id } else { $null }
            reason = 'RUNNER_ABORT_CLEANUP'
            requestedAt = $cleanupBoundaryAt.ToString('o')
            clientCompletedAt = if ($windowEvidence -and $windowEvidence.completedAt) { $windowEvidence.completedAt } else { $cleanupBoundaryAt.ToString('o') }
          }) -Path $paths.samplerBoundary
          $boundarySignalCreatedAt = $cleanupBoundaryAt.ToString('o')
        }
        if (-not (Test-Path -LiteralPath $paths.samplerRelease)) {
          $cleanupReleaseAt = [DateTimeOffset]::UtcNow
          Publish-JsonEvidenceAtomic -Value ([ordered]@{
            contract = 'agm-instrumentation-lifecycle-sampler-release.v1'
            runId = $runId
            requestedAt = $cleanupReleaseAt.ToString('o')
            reason = 'RUNNER_ABORT_CLEANUP'
          }) -Path $paths.samplerRelease
          $releaseSignalCreatedAt = $cleanupReleaseAt.ToString('o')
        }
      } catch {
        if (-not $runFailure) { $runFailure = [ordered]@{ contract = 'agm-instrumentation-lifecycle-runner-error.v1'; at = [DateTimeOffset]::UtcNow.ToString('o'); exceptionType = $_.Exception.GetType().FullName; message = 'BOUNDARY_RELEASE_SIGNAL_WRITE_FAILED' } }
      }
    }

    $samplerStopDeadline = [DateTimeOffset]::UtcNow.AddSeconds(20)
    while (((Test-ProcessHandleAlive $hostSampler) -or (Test-ProcessHandleAlive $processSampler)) -and [DateTimeOffset]::UtcNow -lt $samplerStopDeadline) { Start-Sleep -Milliseconds 250 }
    foreach ($managed in @($hostSampler, $processSampler)) {
      if ($managed -and (Test-ProcessHandleAlive $managed)) {
        $forcedProcesses.Add([int]$managed.Id)
        Stop-Process -Id $managed.Id -Force -ErrorAction SilentlyContinue
        $managed.WaitForExit(10000) | Out-Null
      }
    }
    if ($client -and (Test-ProcessHandleAlive $client)) {
      $forcedProcesses.Add([int]$client.Id)
      Stop-Process -Id $client.Id -Force -ErrorAction SilentlyContinue
      $client.WaitForExit(10000) | Out-Null
    }

    if ($api -and (Test-ProcessHandleAlive $api)) {
      try {
        $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Headers @{ 'x-agm-diagnostic-control' = $runId } -Uri "http://127.0.0.1:$Port/__agm_diagnostic/flush-and-stop"
        $apiFlushResult = "HTTP_$([int]$response.StatusCode)"
      } catch { $apiFlushResult = "FLUSH_EXCEPTION_$($_.Exception.GetType().Name)" }
      if (-not (Wait-ForProcessExit -Process $api -TimeoutSeconds 30)) {
        $forcedProcesses.Add([int]$api.Id)
        Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
        $api.WaitForExit(10000) | Out-Null
      }
    }
  } catch {
    $cleanupErrors.Add("$($_.Exception.GetType().Name):$($_.Exception.Message)")
    if (-not $runFailure) {
      $runFailure = [ordered]@{ contract = 'agm-instrumentation-lifecycle-runner-error.v1'; at = [DateTimeOffset]::UtcNow.ToString('o'); exceptionType = $_.Exception.GetType().FullName; message = 'CLEANUP_EXCEPTION' }
    }
  } finally {
    foreach ($name in $environmentNames) { Restore-EnvironmentValue -Name $name -Value $priorEnvironment[$name] }
  }
}

$finalInventory = $null # AFTER_SHUTDOWN belongs exclusively to the external finalizer.

$formalWallSeconds = if ($windowEvidence) { [double]$windowEvidence.observedDurationMs / 1000 } else { 0 }
$observerWallSeconds = if ($observerStart -and $observerBoundary) {
  ([DateTimeOffset]::Parse($observerBoundary.capturedAt) - [DateTimeOffset]::Parse($observerStart.capturedAt)).TotalSeconds
} else { 0 }
$finalizationTailSeconds = if ($observerBoundary -and $observerFinalizationEnd) {
  ([DateTimeOffset]::Parse($observerFinalizationEnd.capturedAt) - [DateTimeOffset]::Parse($observerBoundary.capturedAt)).TotalSeconds
} else { 0 }
$hostObserverMetric = Get-CpuMetric $observerStart.hostSampler $observerBoundary.hostSampler $observerWallSeconds
$processObserverMetric = Get-CpuMetric $observerStart.processSampler $observerBoundary.processSampler $observerWallSeconds
$combinedObserverMetric = if ($observerStart -and $observerBoundary) { Get-CpuMetric ([double]$observerStart.hostSampler + [double]$observerStart.processSampler) ([double]$observerBoundary.hostSampler + [double]$observerBoundary.processSampler) $observerWallSeconds } else { Get-CpuMetric $null $null $observerWallSeconds }
$hostFinalizationMetric = Get-CpuMetric $observerBoundary.hostSampler $observerFinalizationEnd.hostSampler $finalizationTailSeconds
$processFinalizationMetric = Get-CpuMetric $observerBoundary.processSampler $observerFinalizationEnd.processSampler $finalizationTailSeconds
$hostCaptureDurations = @((Get-JsonlRecords $paths.hostTelemetry) | ForEach-Object { $_.captureDurationMs })
$processCaptureDurations = @((Get-JsonlRecords $paths.processTelemetry) | ForEach-Object { $_.captureDurationMs })
$hostCaptureSummary = [ordered]@{ p50 = Get-PercentileMetric $hostCaptureDurations 0.5; p95 = Get-PercentileMetric $hostCaptureDurations 0.95; max = Get-PercentileMetric $hostCaptureDurations 1 }
$processCaptureSummary = [ordered]@{ p50 = Get-PercentileMetric $processCaptureDurations 0.5; p95 = Get-PercentileMetric $processCaptureDurations 0.95; max = Get-PercentileMetric $processCaptureDurations 1 }
$overhead = [ordered]@{
  contract = 'agm-instrumentation-lifecycle-observer-overhead.v2'
  runId = $runId
  windowId = $runId
  windowStartedAt = if ($windowEvidence) { $windowEvidence.actualStartedAt } else { $null }
  windowCompletedAt = if ($windowEvidence) { $windowEvidence.completedAt } else { $null }
  wallSeconds = if ($observerWallSeconds -gt 0) { [Math]::Round($observerWallSeconds, 6) } else { $null }
  exactWindowSeconds = if ($formalWallSeconds -gt 0) { [Math]::Round($formalWallSeconds, 6) } else { $null }
  capturedAtStart = $observerStart.capturedAt
  capturedAtEnd = $observerBoundary.capturedAt
  boundary = [ordered]@{
    contract = if ($boundaryEvidence) { $boundaryEvidence.contract } else { $null }
    requestedAt = if ($boundaryEvidence) { $boundaryEvidence.requestedAt } else { $null }
    clientCompletedAt = if ($boundaryEvidence) { $boundaryEvidence.clientCompletedAt } else { $null }
    observedByRunnerAt = $boundaryObservedByRunnerAt
    cpuSnapshotAt = if ($observerBoundary) { $observerBoundary.capturedAt } else { $null }
    cpuSnapshotLagMs = if ($observerBoundary -and $boundaryEvidence) { [Math]::Round(([DateTimeOffset]::Parse($observerBoundary.capturedAt) - [DateTimeOffset]::Parse($boundaryEvidence.clientCompletedAt)).TotalMilliseconds, 3) } else { $null }
  }
  formalWindow = [ordered]@{
    declaredStartedAt = if ($windowEvidence) { $windowEvidence.actualStartedAt } else { $null }
    declaredCompletedAt = if ($windowEvidence) { $windowEvidence.completedAt } else { $null }
    cpuSnapshotStartedAt = if ($observerStart) { $observerStart.capturedAt } else { $null }
    cpuSnapshotCompletedAt = if ($observerBoundary) { $observerBoundary.capturedAt } else { $null }
    cpuSnapshotStartSkewMs = if ($observerStart -and $windowEvidence) { [Math]::Round(([DateTimeOffset]::Parse($observerStart.capturedAt) - [DateTimeOffset]::Parse($windowEvidence.actualStartedAt)).TotalMilliseconds, 3) } else { $null }
    cpuSnapshotEndSkewMs = if ($observerBoundary -and $windowEvidence) { [Math]::Round(([DateTimeOffset]::Parse($observerBoundary.capturedAt) - [DateTimeOffset]::Parse($windowEvidence.completedAt)).TotalMilliseconds, 3) } else { $null }
    wallSeconds = if ($observerWallSeconds -gt 0) { [Math]::Round($observerWallSeconds, 6) } else { $null }
  }
  finalizationTail = [ordered]@{
    startedAt = if ($observerBoundary) { $observerBoundary.capturedAt } else { $null }
    completedAt = if ($observerFinalizationEnd) { $observerFinalizationEnd.capturedAt } else { $null }
    wallSeconds = if ($finalizationTailSeconds -gt 0) { [Math]::Round($finalizationTailSeconds, 6) } else { $null }
    observer = [ordered]@{ hostSampler = $hostFinalizationMetric; processSampler = $processFinalizationMetric }
  }
  observer = [ordered]@{
    hostSampler = $hostObserverMetric
    processSampler = $processObserverMetric
    combinedSamplers = $combinedObserverMetric
  }
  processes = @(
    [ordered]@{ role = 'HOST_SAMPLER'; pid = if ($hostSampler) { $hostSampler.Id } else { $null }; cpuSecondsDelta = $hostObserverMetric.cpuSeconds; cpuPercentOfOneCore = $hostObserverMetric.cpuPercentOfOneCore; cpuPercentOfHost = $hostObserverMetric.cpuPercentOfTotalCapacity; captureDurationMs = $hostCaptureSummary },
    [ordered]@{ role = 'PROCESS_SAMPLER'; pid = if ($processSampler) { $processSampler.Id } else { $null }; cpuSecondsDelta = $processObserverMetric.cpuSeconds; cpuPercentOfOneCore = $processObserverMetric.cpuPercentOfOneCore; cpuPercentOfHost = $processObserverMetric.cpuPercentOfTotalCapacity; captureDurationMs = $processCaptureSummary }
  )
  contextualNotPureObserver = [ordered]@{
    runner = Get-CpuMetric $observerStart.runner $observerBoundary.runner $observerWallSeconds
    instrumentedApi = Get-CpuMetric $observerStart.api $observerBoundary.api $observerWallSeconds
    client = if ($clientTimeline) { $clientTimeline.clientRuntime.process.cpuMicrosDuringWindow } else { $null }
  }
  interpretation = 'Formal sampler CPU deltas end at the client-published boundary. Boundary-final capture and acknowledgement CPU are retained separately as finalizationTail. All capture skew remains explicit; API/client values combine instrumentation with workload and are not pure observer overhead.'
}
Write-JsonEvidence -Value $overhead -Path $paths.overhead
if ($windowEvidence) { Write-JsonEvidence -Value $windowEvidence -Path $paths.window }

$hostLifecycle = if (Test-Path -LiteralPath $paths.hostLifecycle) { Get-Content -Raw -LiteralPath $paths.hostLifecycle | ConvertFrom-Json } else { $null }
$processLifecycle = if (Test-Path -LiteralPath $paths.processLifecycle) { Get-Content -Raw -LiteralPath $paths.processLifecycle | ConvertFrom-Json } else { $null }
$hostActualExitCode = Get-ProcessExitCodeSafe $hostSampler
$processActualExitCode = Get-ProcessExitCodeSafe $processSampler
$clientActualExitCode = Get-ProcessExitCodeSafe $client
$apiActualExitCode = Get-ProcessExitCodeSafe $api
$managedProcessIdentities = @(
  [ordered]@{ role = 'API'; process = $api; pid = if ($api) { $api.Id } else { $null }; startTimeUtc = $apiStartTimeUtc },
  [ordered]@{ role = 'HOST_SAMPLER'; process = $hostSampler; pid = if ($hostSampler) { $hostSampler.Id } else { $null }; startTimeUtc = $hostSamplerStartTimeUtc },
  [ordered]@{ role = 'PROCESS_SAMPLER'; process = $processSampler; pid = if ($processSampler) { $processSampler.Id } else { $null }; startTimeUtc = $processSamplerStartTimeUtc },
  [ordered]@{ role = 'CLIENT'; process = $client; pid = if ($client) { $client.Id } else { $null }; startTimeUtc = $clientStartTimeUtc }
)
$liveKnownIdentities = @($managedProcessIdentities | Where-Object { $_.process -and (Test-ProcessHandleAlive $_.process) } | ForEach-Object {
  [ordered]@{ role = $_.role; pid = $_.pid; startTimeUtc = $_.startTimeUtc }
})
$liveKnownPids = @($liveKnownIdentities | ForEach-Object { $_.pid })
$shutdownProcesses = @(
  [ordered]@{ role = 'HOST_SAMPLER'; pid = if ($hostSampler) { $hostSampler.Id } else { $null }; startTimeUtc = $hostSamplerStartTimeUtc; graceful = [bool]($hostLifecycle -and $hostLifecycle.graceful); forcedStopUsed = [bool]($hostSampler -and $forcedProcesses.Contains([int]$hostSampler.Id)); aliveAfter = if ($hostSampler) { Test-ProcessHandleAlive $hostSampler } else { $false }; exitCode = if ($hostLifecycle) { $hostLifecycle.exitCode } else { $null }; actualProcessExitCode = $hostActualExitCode },
  [ordered]@{ role = 'PROCESS_SAMPLER'; pid = if ($processSampler) { $processSampler.Id } else { $null }; startTimeUtc = $processSamplerStartTimeUtc; graceful = [bool]($processLifecycle -and $processLifecycle.graceful); forcedStopUsed = [bool]($processSampler -and $forcedProcesses.Contains([int]$processSampler.Id)); aliveAfter = if ($processSampler) { Test-ProcessHandleAlive $processSampler } else { $false }; exitCode = if ($processLifecycle) { $processLifecycle.exitCode } else { $null }; actualProcessExitCode = $processActualExitCode },
  [ordered]@{ role = 'CLIENT'; pid = if ($client) { $client.Id } else { $null }; startTimeUtc = $clientStartTimeUtc; graceful = ($clientActualExitCode -eq 0); forcedStopUsed = [bool]($client -and $forcedProcesses.Contains([int]$client.Id)); aliveAfter = if ($client) { Test-ProcessHandleAlive $client } else { $false }; exitCode = $clientActualExitCode; actualProcessExitCode = $clientActualExitCode },
  [ordered]@{ role = 'API'; pid = if ($api) { $api.Id } else { $null }; startTimeUtc = $apiStartTimeUtc; graceful = ($apiFlushResult -eq 'HTTP_200' -and $apiActualExitCode -eq 0); forcedStopUsed = [bool]($api -and $forcedProcesses.Contains([int]$api.Id)); aliveAfter = if ($api) { Test-ProcessHandleAlive $api } else { $false }; exitCode = $apiActualExitCode; actualProcessExitCode = $apiActualExitCode }
)
$shutdown = [ordered]@{
  contract = 'agm-instrumentation-lifecycle-shutdown.v3'
  runId = $runId
  windowId = $runId
  capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
  boundarySignalCreatedAt = $boundarySignalCreatedAt
  boundaryObservedByRunnerAt = $boundaryObservedByRunnerAt
  releaseSignalCreatedAt = $releaseSignalCreatedAt
  boundary = $boundaryEvidence
  boundaryAcknowledgements = [ordered]@{ host = $hostBoundaryReady; process = $processBoundaryReady }
  hostSampler = [ordered]@{ pid = if ($hostSampler) { $hostSampler.Id } else { $null }; lifecycle = $hostLifecycle; aliveAfter = if ($hostSampler) { Test-ProcessHandleAlive $hostSampler } else { $false } }
  processSampler = [ordered]@{ pid = if ($processSampler) { $processSampler.Id } else { $null }; lifecycle = $processLifecycle; aliveAfter = if ($processSampler) { Test-ProcessHandleAlive $processSampler } else { $false } }
  client = [ordered]@{ pid = if ($client) { $client.Id } else { $null }; aliveAfter = if ($client) { Test-ProcessHandleAlive $client } else { $false }; exitCode = if ($client -and $client.HasExited) { $client.ExitCode } else { $null } }
  api = [ordered]@{ pid = if ($api) { $api.Id } else { $null }; aliveAfter = if ($api) { Test-ProcessHandleAlive $api } else { $false }; flushResult = $apiFlushResult }
  forcedStopUsed = ($forcedProcesses.Count -gt 0)
  forcedProcessIds = @($forcedProcesses)
  cleanupErrors = @($cleanupErrors)
  exactKnownPidsAliveAfter = $liveKnownPids
  exactKnownIdentitiesAliveAfter = $liveKnownIdentities
  orphans = $liveKnownPids.Count
  processes = $shutdownProcesses
  diagnosticPortReleased = Test-PortAvailable -LocalPort $Port
  finalInventory = $null
  finalInventoryOwner = 'EXTERNAL_FINALIZER_AFTER_RUNNER_EXIT'
}
Write-JsonEvidence -Value $shutdown -Path $paths.shutdown

$lifecycleClosureValid = $hostLifecycle -and $processLifecycle `
  -and $hostLifecycle.stopReason -eq 'STOP_SIGNAL' -and $hostLifecycle.graceful -eq $true -and [int]$hostLifecycle.exitCode -eq 0 `
  -and $processLifecycle.stopReason -eq 'STOP_SIGNAL' -and $processLifecycle.graceful -eq $true -and [int]$processLifecycle.exitCode -eq 0 `
  -and $hostBoundaryReady -and $processBoundaryReady -and $releaseSignalCreatedAt `
  -and $hostLifecycle.boundaryClientCompletedAt -eq $windowEvidence.completedAt `
  -and $processLifecycle.boundaryClientCompletedAt -eq $windowEvidence.completedAt `
  -and $hostActualExitCode -eq 0 -and $processActualExitCode -eq 0 -and $clientActualExitCode -eq 0 -and $apiActualExitCode -eq 0 `
  -and $cleanupErrors.Count -eq 0 -and $forcedProcesses.Count -eq 0 -and $liveKnownPids.Count -eq 0 -and $shutdown.diagnosticPortReleased `
  -and (Test-Path -LiteralPath $canonicalPreflightFull) -and (Split-Path -Leaf $canonicalPreflightFull) -eq 'process-inventory-before.json' `
  -and -not (Test-Path -LiteralPath $paths.finalInventory)
if (-not $lifecycleClosureValid -and -not $runFailure) {
  $runFailure = [ordered]@{ contract = 'agm-instrumentation-lifecycle-runner-error.v1'; at = [DateTimeOffset]::UtcNow.ToString('o'); exceptionType = 'LifecycleAssertion'; message = 'GRACEFUL_ZERO_ORPHAN_ASSERTION_FAILED' }
}
if ($apiFlushResult -ne 'HTTP_200' -and -not $runFailure) {
  $runFailure = [ordered]@{ contract = 'agm-instrumentation-lifecycle-runner-error.v1'; at = [DateTimeOffset]::UtcNow.ToString('o'); exceptionType = 'ApiFlushAssertion'; message = "API_FLUSH_NOT_GRACEFUL_$apiFlushResult" }
}

$custody.completedAt = [DateTimeOffset]::UtcNow.ToString('o')
$custody.apiPid = if ($api) { $api.Id } else { $null }
$custody.hostSamplerPid = if ($hostSampler) { $hostSampler.Id } else { $null }
$custody.processSamplerPid = if ($processSampler) { $processSampler.Id } else { $null }
$custody.clientPid = if ($client) { $client.Id } else { $null }
$custody.window = $windowEvidence
$custody.boundary = $boundaryEvidence
$custody.boundarySignalCreatedAt = $boundarySignalCreatedAt
$custody.releaseSignalCreatedAt = $releaseSignalCreatedAt
$custody.finalInventory = $null
$custody.finalInventoryOwner = 'EXTERNAL_FINALIZER_AFTER_RUNNER_EXIT'
$custody.p9StillStoppedByConstruction = $true
$custody.runnerCompleted = ($null -eq $runFailure)
$custody.finalGate = $ownerReviewGate
Write-JsonEvidence -Value $custody -Path $paths.custody
if ($runFailure) { Write-JsonEvidence -Value $runFailure -Path $paths.runnerError }

if ($runFailure) { throw "INSTRUMENTATION_LIFECYCLE_CYCLE_OWNER_REVIEW_$($runFailure.message)" }
$runnerIdentity = Get-ManagedProcessIdentity -Process $runnerProcess -Role 'LIFECYCLE_RUNNER' -ExpectedStartTimeUtc $runnerStartTimeUtc
$intentPaths = @{ window=$paths.window; shutdown=$paths.shutdown; managedRoots=$paths.managedRoots; priorInventory=$paths.preShutdownInventory; knownProtectedBackground=$knownProtectedBackgroundPath }
$closureIntent = New-CanonicalClosureIntent -RunnerIdentity $runnerIdentity -IntentPaths $intentPaths -ExternalFinalizerScript $externalFinalizerScript -RunIdentifier $runId
$intentCandidate = Join-Path $outputFull ".closure-intent-validation-$PID.json"
try {
  Write-JsonEvidence -Value $closureIntent -Path $intentCandidate
  & node $closureIntentContractScript $intentCandidate $root $outputFull | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "CLOSURE_INTENT_PRODUCER_VALIDATION_FAILED_$LASTEXITCODE" }
} finally {
  Remove-Item -LiteralPath $intentCandidate -ErrorAction SilentlyContinue
}
Publish-JsonEvidenceAtomic -Value $closureIntent -Path $paths.closureIntent
Write-Output "INSTRUMENTATION LIFECYCLE PHASE 1 COMPLETE / EXTERNAL FINALIZER REQUIRED / $outputFull"
