param(
  [Parameter(Mandatory = $true)][string]$OutputRoot,
  [ValidateRange(5, 300)][int]$RunnerExitTimeoutSeconds = 60,
  [switch]$HandoffIntegrationMode
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outputFull = [IO.Path]::GetFullPath($OutputRoot)
$intentPath = Join-Path $outputFull 'closure-intent.json'
$identityPath = Join-Path $outputFull 'external-finalizer-identity.json'
$lifecyclePath = Join-Path $outputFull 'external-finalizer-lifecycle.json'
$runnerExitPath = Join-Path $outputFull 'external-finalizer-runner-exit.json'
$inventoryPath = Join-Path $outputFull 'process-inventory-after.json'
$verdictPath = Join-Path $outputFull 'external-finalizer-verdict.json'
$analysisPath = Join-Path $outputFull 'instrumentation-lifecycle-analysis.json'

function Write-JsonAtomic($Value, [string]$Path) {
  if ([IO.File]::Exists($Path)) { throw "FINALIZER_ATOMIC_TARGET_EXISTS_$Path" }
  $temporary = "$Path.publish-$PID-$([Guid]::NewGuid().ToString('N')).tmp"
  [IO.File]::WriteAllText($temporary, "$(($Value | ConvertTo-Json -Depth 14))$([Environment]::NewLine)", [Text.UTF8Encoding]::new($false))
  [IO.File]::Move($temporary, $Path)
}

function Get-Sha256([string]$Path) {
  (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Assert-SignedFile($Signature, [string]$ExpectedName) {
  if (-not $Signature -or (Split-Path -Leaf ([string]$Signature.path)) -ne $ExpectedName) { throw "CLOSURE_INTENT_SIGNATURE_NAME_INVALID_$ExpectedName" }
  $path = Join-Path $outputFull $ExpectedName
  if (-not (Test-Path -LiteralPath $path)) { throw "CLOSURE_INTENT_SIGNED_FILE_MISSING_$ExpectedName" }
  $item = Get-Item -LiteralPath $path
  if ([long]$Signature.bytes -ne $item.Length -or [string]$Signature.sha256 -ne (Get-Sha256 $path)) { throw "CLOSURE_INTENT_HASH_MISMATCH_$ExpectedName" }
}

function Get-Identity([int]$ProcessId) {
  $rows = @(Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop)
  if ($rows.Count -eq 0) { return $null }
  if ($rows.Count -ne 1) { throw 'PROCESS_IDENTITY_QUERY_CARDINALITY_INVALID' }
  $row = $rows[0]
  if (-not $row.CreationDate -or -not $row.ExecutablePath -or -not $row.CommandLine) { throw 'PROCESS_FULL_IDENTITY_UNAVAILABLE' }
  $creation = [DateTimeOffset]([DateTime]$row.CreationDate)
  $epochMs = $creation.ToUniversalTime().ToUnixTimeMilliseconds()
  $normalizedPath = ([IO.Path]::GetFullPath([string]$row.ExecutablePath) -replace '/', '\').ToLowerInvariant()
  $pathHash = Get-TextHash $normalizedPath
  $commandHash = Get-TextHash ([string]$row.CommandLine)
  $identityHash = Get-TextHash "$ProcessId|$epochMs|$(([string]$row.Name).ToLowerInvariant())|$pathHash|$commandHash"
  [ordered]@{ pid=$ProcessId; parentPid=[int]$row.ParentProcessId; imageName=[string]$row.Name; creationAt=$creation.ToUniversalTime().ToString('o'); creationEpochMs=$epochMs; executablePathSha256=$pathHash; commandLineSha256=$commandHash; identitySha256=$identityHash }
}

function Get-TextHash([string]$Text) {
  $sha=[Security.Cryptography.SHA256]::Create()
  try { -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)) | ForEach-Object { $_.ToString('x2') }) } finally { $sha.Dispose() }
}

if (-not (Test-Path -LiteralPath $intentPath)) { throw 'CLOSURE_INTENT_MISSING' }
$contractValidator = Join-Path $root 'scripts/closure-intent-contract.mjs'
if (-not (Test-Path -LiteralPath $contractValidator)) { throw 'CLOSURE_INTENT_VALIDATOR_MISSING' }
& node $contractValidator $intentPath $root $outputFull | Out-Null
if ($LASTEXITCODE -ne 0) { throw "CLOSURE_INTENT_CONSUMER_VALIDATION_FAILED_$LASTEXITCODE" }
$intent = Get-Content -Raw -LiteralPath $intentPath | ConvertFrom-Json
if ($intent.contract -ne 'agm-instrumentation-lifecycle-closure-intent.v2' -or [int]$intent.contractVersion -ne 2 -or $intent.phase -ne 'RUNNER_CLEANUP_COMPLETE_PENDING_EXTERNAL_FINALIZATION' `
  -or -not $intent.runnerMustExitBeforeFinalInventory -or -not $intent.finalizerMustDeclareExactIdentity `
  -or [int]$intent.runner.pid -le 0 -or -not $intent.runner.identitySha256 -or -not $intent.runId) { throw 'CLOSURE_INTENT_CONTRACT_INVALID' }
Assert-SignedFile $intent.windowIdentity.signature 'window.json'
Assert-SignedFile $intent.inputs.shutdown 'shutdown.json'
Assert-SignedFile $intent.inputs.managedRoots 'managed-process-roots.json'
Assert-SignedFile $intent.inputs.priorInventory 'managed-process-tree-before-shutdown.json'
Assert-SignedFile $intent.inputs.knownProtectedBackground 'known-protected-background.json'
$finalizerSourcePath = [string]$intent.externalFinalizerSource.path
if ([string]::IsNullOrWhiteSpace($finalizerSourcePath)) { throw 'CLOSURE_INTENT_FINALIZER_SOURCE_PATH_EMPTY' }
$resolvedFinalizerSource = [IO.Path]::GetFullPath((Join-Path $root $finalizerSourcePath))
if (-not (Test-Path -LiteralPath $resolvedFinalizerSource -PathType Leaf)) { throw 'CLOSURE_INTENT_FINALIZER_SOURCE_MISSING' }
if ($resolvedFinalizerSource -ne [IO.Path]::GetFullPath($PSCommandPath) `
  -or [string]$intent.externalFinalizerSource.sha256 -ne (Get-Sha256 $resolvedFinalizerSource) `
  -or [long]$intent.externalFinalizerSource.bytes -ne (Get-Item -LiteralPath $resolvedFinalizerSource).Length) { throw 'CLOSURE_INTENT_FINALIZER_SOURCE_MISMATCH' }

$startedAt = [DateTimeOffset]::UtcNow
$self = Get-Identity $PID
Write-JsonAtomic ([ordered]@{ contract='agm-instrumentation-external-finalizer-identity.v1'; runId=$intent.runId; role='EXTERNAL_FINALIZER'; startedAt=$startedAt.ToString('o'); pid=$PID; parentPid=$self.parentPid; imageName=$self.imageName; creationAt=$self.creationAt; creationEpochMs=$self.creationEpochMs; executablePathSha256=$self.executablePathSha256; commandLineSha256=$self.commandLineSha256; identitySha256=$self.identitySha256 }) $identityPath

$deadline = [DateTimeOffset]::UtcNow.AddSeconds($RunnerExitTimeoutSeconds)
do {
  $runnerCurrent = Get-Identity ([int]$intent.runner.pid)
  if ($null -eq $runnerCurrent) { break }
  if ($runnerCurrent.identitySha256 -ne [string]$intent.runner.identitySha256) { throw 'RUNNER_PID_REUSED_WITH_DIFFERENT_IDENTITY' }
  Start-Sleep -Milliseconds 200
} while ([DateTimeOffset]::UtcNow -lt $deadline)
if ($null -ne $runnerCurrent) { throw 'RUNNER_DID_NOT_EXIT_BEFORE_FINALIZATION' }
$runnerExitedAt = [DateTimeOffset]::UtcNow
Write-JsonAtomic ([ordered]@{ contract='agm-instrumentation-external-finalizer-runner-exit.v1'; runId=$intent.runId; runnerPid=[int]$intent.runner.pid; expectedIdentitySha256=[string]$intent.runner.identitySha256; runnerPidAbsent=$true; runnerPidReuseDetected=$false; verifiedAt=$runnerExitedAt.ToString('o') }) $runnerExitPath

if ($HandoffIntegrationMode) {
  $snapshot = @(Get-CimInstance Win32_Process -ErrorAction Stop)
  Write-JsonAtomic ([ordered]@{ contract='agm-handoff-integration-final-inventory.v1'; runId=$intent.runId; capturePhase='AFTER_RUNNER_EXIT'; capturedAt=[DateTimeOffset]::UtcNow.ToString('o'); runnerPidAbsent=$true; runnerPidReuseDetected=$false; processesInspected=$snapshot.Count; externalFinalizer=[ordered]@{ role='EXTERNAL_FINALIZER'; pid=$PID; identitySha256=$self.identitySha256; observed=$true; genericObserverFiltering=$false }; trafficGenerated=$false; processChanges=0 }) $inventoryPath
  $analysisJson = & node $contractValidator $intentPath $root $outputFull
  if ($LASTEXITCODE -ne 0) { throw 'HANDOFF_INTEGRATION_ANALYZER_FAILED' }
  $analysisResult = $analysisJson | ConvertFrom-Json
  Write-JsonAtomic ([ordered]@{ contract='agm-runner-finalizer-handoff-analysis.v1'; runId=$intent.runId; schema=$intent.contract; valid=$analysisResult.valid; findings=@($analysisResult.findings); inventoryCapturedAfterRunnerExit=$true; finalizerSourceResolved=$true }) $analysisPath
  Write-JsonAtomic ([ordered]@{ contract='agm-instrumentation-external-finalizer-verdict.v1'; runId=$intent.runId; verdict='PASS'; runnerPidAbsent=$true; runnerPidReuseDetected=$false; inventoryCapturedAfterRunnerExit=$true; analyzer='PASS'; publishedAt=[DateTimeOffset]::UtcNow.ToString('o') }) $verdictPath
  Write-JsonAtomic ([ordered]@{ contract='agm-instrumentation-external-finalizer-lifecycle.v1'; runId=$intent.runId; role='EXTERNAL_FINALIZER'; pid=$PID; startedAt=$startedAt.ToString('o'); runnerExitedAt=$runnerExitedAt.ToString('o'); verdictPublished=$true; manifestPublicationNext=$true; genericObserverFiltering=$false; completedAt=[DateTimeOffset]::UtcNow.ToString('o') }) $lifecyclePath
  & node (Join-Path $root 'scripts/hash-instrumentation-lifecycle-evidence.mjs') $outputFull
  if ($LASTEXITCODE -ne 0) { throw 'HANDOFF_INTEGRATION_MANIFEST_FAILED' }
  & node (Join-Path $root 'scripts/hash-instrumentation-lifecycle-evidence.mjs') $outputFull --verify
  if ($LASTEXITCODE -ne 0) { throw 'HANDOFF_INTEGRATION_MANIFEST_VERIFY_FAILED' }
  Write-Output "HANDOFF INTEGRATION FINALIZER COMPLETE / $outputFull"
  exit 0
}

$inventoryScript = Join-Path $root 'scripts/Get-InstrumentationLifecycleProcessInventory.ps1'
& $inventoryScript -Output $inventoryPath -TrackedRootsPath (Join-Path $outputFull 'managed-process-roots.json') `
  -PriorInventoryPath (Join-Path $outputFull 'managed-process-tree-before-shutdown.json') `
  -KnownProtectedBackgroundPath (Join-Path $outputFull 'known-protected-background.json') `
  -ExternalFinalizerIdentityPath $identityPath -RunId ([string]$intent.runId) -Phase AFTER_SHUTDOWN
$inventory = Get-Content -Raw -LiteralPath $inventoryPath | ConvertFrom-Json
if ($inventory.queryStatus -ne 'SUCCESS' -or $inventory.trackedClosure.complete -ne $true `
  -or [int]$inventory.trackedClosure.currentTrackedMatches -ne 0 -or [int]$inventory.matchCounts.p9 -ne 0 `
  -or [int]$inventory.matchCounts.observer -ne 0 -or $inventory.externalFinalizer.observed -ne $true `
  -or $inventory.externalFinalizer.identitySha256 -ne $self.identitySha256) { throw 'EXTERNAL_FINAL_INVENTORY_INVALID' }

& node (Join-Path $root 'scripts/analyze-instrumentation-lifecycle-cycle.mjs') $outputFull $analysisPath
if ($LASTEXITCODE -ne 0) { throw "EXTERNAL_FINAL_ANALYZER_FAILED_$LASTEXITCODE" }
Write-JsonAtomic ([ordered]@{ contract='agm-instrumentation-external-finalizer-verdict.v1'; runId=$intent.runId; verdict='PASS'; runnerPidAbsent=$true; runnerPidReuseDetected=$false; inventoryCapturedAfterRunnerExit=$true; zeroManagedProcesses=$true; zeroDescendants=$true; zeroOrphans=$true; finalizerIdentityDeclared=$true; analyzer='PASS'; publishedAt=[DateTimeOffset]::UtcNow.ToString('o') }) $verdictPath
Write-JsonAtomic ([ordered]@{ contract='agm-instrumentation-external-finalizer-lifecycle.v1'; runId=$intent.runId; role='EXTERNAL_FINALIZER'; pid=$PID; startedAt=$startedAt.ToString('o'); runnerExitedAt=$runnerExitedAt.ToString('o'); inventoryCapturedAt=$inventory.capturedAt; verdictPublished=$true; verdictPath='external-finalizer-verdict.json'; manifestPublicationNext=$true; genericObserverFiltering=$false; completedAt=[DateTimeOffset]::UtcNow.ToString('o') }) $lifecyclePath
& node (Join-Path $root 'scripts/hash-instrumentation-lifecycle-evidence.mjs') $outputFull
if ($LASTEXITCODE -ne 0) { throw "EXTERNAL_FINAL_MANIFEST_FAILED_$LASTEXITCODE" }
& node (Join-Path $root 'scripts/hash-instrumentation-lifecycle-evidence.mjs') $outputFull --verify
if ($LASTEXITCODE -ne 0) { throw "EXTERNAL_FINAL_MANIFEST_VERIFY_FAILED_$LASTEXITCODE" }
Write-Output "TWO-PHASE EXTERNAL FINALIZATION COMPLETE / OWNER REVIEW / $outputFull"
