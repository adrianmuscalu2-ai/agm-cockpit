param()

$ErrorActionPreference = 'Stop'

function Assert-Static {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw "STATIC_IDENTITY_ASSERTION_FAILED_$Message" }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$inventoryPath = Join-Path $PSScriptRoot 'Get-InstrumentationLifecycleProcessInventory.ps1'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($inventoryPath, [ref]$tokens, [ref]$parseErrors)
Assert-Static ($parseErrors.Count -eq 0) 'INVENTORY_AST'

$requiredFunctions = @(
  'Get-Sha256Hex',
  'Get-CreationTimeUtc',
  'New-SanitizedProcessIdentity',
  'Resolve-ExactIdentityEvidence',
  'Get-ExpectedRootImageName',
  'New-LineageRecord',
  'Resolve-TrackedProcessClosure'
)
$functionDefinitions = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true))
$definitionText = [System.Collections.Generic.List[string]]::new()
foreach ($name in $requiredFunctions) {
  $definition = @($functionDefinitions | Where-Object { $_.Name -eq $name })
  Assert-Static ($definition.Count -eq 1) "FUNCTION_$name"
  $definitionText.Add($definition[0].Extent.Text)
}
# Load only pure helper definitions. The inventory script body, including CIM,
# is deliberately never invoked by this static test.
. ([scriptblock]::Create(($definitionText -join [Environment]::NewLine)))

function New-FixtureIdentity {
  param(
    [int]$ProcessId,
    [int]$ParentPid,
    [string]$ImageName,
    [long]$CreationEpochMs,
    [string]$ExecutableSeed,
    [string]$CommandSeed
  )
  $executableHash = Get-Sha256Hex $ExecutableSeed
  $commandHash = Get-Sha256Hex $CommandSeed
  $identityHash = Get-Sha256Hex "$ProcessId|$CreationEpochMs|$($ImageName.ToLowerInvariant())|$executableHash|$commandHash"
  [pscustomobject][ordered]@{
    pid = $ProcessId
    parentPid = $ParentPid
    imageName = $ImageName
    creationAt = [DateTimeOffset]::FromUnixTimeMilliseconds($CreationEpochMs).ToString('o')
    creationEpochMs = $CreationEpochMs
    sessionId = 1
    executablePathSha256 = $executableHash
    commandLineSha256 = $commandHash
    executablePathStatus = 'AVAILABLE_HASHED'
    commandLineStatus = 'AVAILABLE_HASHED'
    identityStrength = 'FULL_CURRENT'
    identitySha256 = $identityHash
    identityEvidence = 'STATIC_FIXTURE'
  }
}

function New-FixtureRoot {
  param([string]$Role, $Identity)
  [pscustomobject][ordered]@{
    role = $Role
    pid = [int]$Identity.pid
    parentPid = [int]$Identity.parentPid
    startTimeUtc = [string]$Identity.creationAt
    creationAt = [string]$Identity.creationAt
    creationEpochMs = [long]$Identity.creationEpochMs
    imageName = [string]$Identity.imageName
    executablePathSha256 = [string]$Identity.executablePathSha256
    commandLineSha256 = [string]$Identity.commandLineSha256
    identityStrength = 'FULL_CURRENT'
    identitySha256 = [string]$Identity.identitySha256
    identityEvidence = 'STATIC_FIXTURE_ROOT_LEDGER'
  }
}

$frozenRoot = Join-Path $root 'evidence/governance/copilot-v1.2/p9/instrumentation-lifecycle-closure/20260814T111028Z-p9-off-150s-replacement'
$beforeWindow = Get-Content -Raw -LiteralPath (Join-Path $frozenRoot 'managed-process-tree-before-window.json') | ConvertFrom-Json
$beforeShutdown = Get-Content -Raw -LiteralPath (Join-Path $frozenRoot 'managed-process-tree-before-shutdown.json') | ConvertFrom-Json
$after = Get-Content -Raw -LiteralPath (Join-Path $frozenRoot 'process-inventory-after.json') | ConvertFrom-Json
$frozenRoots = Get-Content -Raw -LiteralPath (Join-Path $frozenRoot 'managed-process-roots.json') | ConvertFrom-Json

$pid29020 = @($beforeShutdown.candidateCommandLinesUnavailable | Where-Object { [int]$_.pid -eq 29020 })
Assert-Static ($pid29020.Count -eq 1) 'FROZEN_PID_29020_PRESENT'
Assert-Static (-not $pid29020[0].creationAt -and -not $pid29020[0].commandLineSha256) 'FROZEN_PID_29020_IDENTITY_NOT_RECOVERABLE'
Assert-Static (@($after.candidateCommandLinesUnavailable | Where-Object { [int]$_.pid -eq 29020 }).Count -eq 0) 'FROZEN_PID_29020_LATER_ABSENCE_ONLY'

$sourceText = Get-Content -Raw -LiteralPath $inventoryPath
Assert-Static ($sourceText -match "classification = 'UNRESOLVED_COMMAND_LINE_UNAVAILABLE'") 'UNREADABLE_FAILS_CLOSED'
Assert-Static ($sourceText -notmatch 'Sort-Object\s+pid\s+-Unique') 'ORDERED_DICTIONARY_PID_DEDUPE_REMOVED'
Assert-Static ($sourceText -match 'agm-instrumentation-lifecycle-managed-process-roots\.v2') 'FULL_ROOT_CONTRACT_REQUIRED'

# Exact frozen msedge record, attached to a synthetic full-identity root with
# the recorded parent PID. Its timestamp predates the root and must be rejected.
$frozenMsedge = @($beforeShutdown.trackedClosure.descendantMatches | Where-Object { [int]$_.pid -eq 13464 })[0]
$earliestManagedRootEpochMs = @($frozenRoots.managedRoots | ForEach-Object { ([DateTimeOffset]::Parse([string]$_.startTimeUtc)).ToUnixTimeMilliseconds() } | Measure-Object -Minimum).Minimum
$temporalRoot = New-FixtureIdentity -ProcessId ([int]$frozenMsedge.parentPid) -ParentPid 1 -ImageName 'node.exe' -CreationEpochMs ([long]$earliestManagedRootEpochMs) -ExecutableSeed 'node-root' -CommandSeed 'api-root'
$temporalChild = New-FixtureIdentity -ProcessId ([int]$frozenMsedge.pid) -ParentPid ([int]$frozenMsedge.parentPid) -ImageName ([string]$frozenMsedge.imageName) -CreationEpochMs (([DateTimeOffset]::Parse([string]$frozenMsedge.creationAt)).ToUnixTimeMilliseconds()) -ExecutableSeed 'frozen-msedge' -CommandSeed 'frozen-msedge-command'
$temporalResult = Resolve-TrackedProcessClosure -ProcessIdentities @($temporalRoot, $temporalChild) -TrackedRoots @((New-FixtureRoot -Role 'API' -Identity $temporalRoot))
Assert-Static ($temporalResult.descendantMatches.Count -eq 0) 'FROZEN_MSEDGE_NOT_DESCENDANT'
Assert-Static (@($temporalResult.lineageRejected | Where-Object { $_.reason -eq 'CHILD_PREDATES_PARENT' -and [int]$_.pid -eq 13464 }).Count -eq 1) 'FROZEN_MSEDGE_TEMPORAL_REJECTION'

# A legacy prior record has no full identity or lineage certificate. Even an
# exact live PID/creation must not seed lineage from that incomplete proof.
$legacyPriorResult = Resolve-TrackedProcessClosure -ProcessIdentities @($temporalChild) -TrackedRoots @((New-FixtureRoot -Role 'API' -Identity $temporalRoot)) -PriorDescendants @($frozenMsedge)
Assert-Static ($legacyPriorResult.descendantMatches.Count -eq 0) 'LEGACY_PRIOR_NOT_PROPAGATED'
Assert-Static (@($legacyPriorResult.priorProofFailures | Where-Object { $_.reason -eq 'PRIOR_DESCENDANT_PROOF_INCOMPLETE' }).Count -eq 1) 'LEGACY_PRIOR_PROOF_FAILURE_RECORDED'

# Distinct valid descendants must both survive identity-key deduplication.
$rootIdentity = New-FixtureIdentity -ProcessId 100 -ParentPid 10 -ImageName 'node.exe' -CreationEpochMs 100000 -ExecutableSeed 'node' -CommandSeed 'api'
$childOne = New-FixtureIdentity -ProcessId 101 -ParentPid 100 -ImageName 'node.exe' -CreationEpochMs 100100 -ExecutableSeed 'node' -CommandSeed 'child-one'
$childTwo = New-FixtureIdentity -ProcessId 102 -ParentPid 101 -ImageName 'node.exe' -CreationEpochMs 100200 -ExecutableSeed 'node' -CommandSeed 'child-two'
$validResult = Resolve-TrackedProcessClosure -ProcessIdentities @($childTwo, $rootIdentity, $childOne) -TrackedRoots @((New-FixtureRoot -Role 'API' -Identity $rootIdentity))
Assert-Static ($validResult.descendantMatches.Count -eq 2) 'IDENTITY_KEY_DEDUPE_PRESERVES_DISTINCT_DESCENDANTS'
Assert-Static (($validResult.descendantMatches.pid -join ',') -eq '101,102') 'DESCENDANT_ORDER_DETERMINISTIC'

# PID reuse against a fully certified prior descendant is a collision, never a
# live descendant and never a lineage seed.
$priorChild = New-LineageRecord -Identity $childOne -Lineage 'CURRENT_FULL_IDENTITY_PARENT_CHAIN' -ParentIdentitySha256 $rootIdentity.identitySha256 -ParentCreationEpochMs $rootIdentity.creationEpochMs -RootIdentitySha256 $rootIdentity.identitySha256 -RootCreationEpochMs $rootIdentity.creationEpochMs
$reusedChild = New-FixtureIdentity -ProcessId 101 -ParentPid 100 -ImageName 'node.exe' -CreationEpochMs 200100 -ExecutableSeed 'node' -CommandSeed 'unrelated-reused-pid'
$reuseResult = Resolve-TrackedProcessClosure -ProcessIdentities @($rootIdentity, $reusedChild) -TrackedRoots @((New-FixtureRoot -Role 'API' -Identity $rootIdentity)) -PriorDescendants @($priorChild)
Assert-Static ($reuseResult.descendantMatches.Count -eq 0) 'PID_REUSE_NOT_DESCENDANT'
Assert-Static (@($reuseResult.pidReuseCollisions | Where-Object { $_.reason -eq 'CREATION_DATE_MISMATCH' -and [int]$_.pid -eq 101 }).Count -eq 1) 'PID_REUSE_COLLISION_RECORDED'

# Missing current executable/command data can be filled only from exact prior
# full identity evidence for the same PID, creation time, image and parent.
$partialCurrent = [pscustomobject][ordered]@{
  pid = $childOne.pid; parentPid = $childOne.parentPid; imageName = $childOne.imageName
  creationAt = $childOne.creationAt; creationEpochMs = $childOne.creationEpochMs; sessionId = $childOne.sessionId
  executablePathSha256 = $null; commandLineSha256 = $null
  executablePathStatus = 'UNAVAILABLE'; commandLineStatus = 'UNAVAILABLE'
  identityStrength = 'PARTIAL_NO_EXECUTABLE_OR_COMMAND_LINE'; identitySha256 = $null; identityEvidence = 'STATIC_FIXTURE'
}
$attested = Resolve-ExactIdentityEvidence -Current $partialCurrent -Expected $childOne -EvidenceType 'STATIC_EXACT_PRIOR_ATTESTATION'
Assert-Static ($attested.matched -and $attested.identity.identityStrength -eq 'FULL_EXACT_EVIDENCE_ATTESTED') 'EXACT_PRIOR_ATTESTATION_ONLY'

# A missing live CreationDate is an unresolved identity proof, not evidence of
# PID reuse. It must therefore block closure instead of entering the
# non-blocking, positively demonstrated PID-reuse collection.
$missingCreationRoot = [pscustomobject][ordered]@{
  pid = $rootIdentity.pid; parentPid = $rootIdentity.parentPid; imageName = $rootIdentity.imageName
  creationAt = $null; creationEpochMs = $null; sessionId = $rootIdentity.sessionId
  executablePathSha256 = $rootIdentity.executablePathSha256; commandLineSha256 = $rootIdentity.commandLineSha256
  executablePathStatus = 'AVAILABLE_HASHED'; commandLineStatus = 'AVAILABLE_HASHED'
  identityStrength = 'PARTIAL_NO_CREATION_DATE'; identitySha256 = $null; identityEvidence = 'STATIC_FIXTURE'
}
$missingCreationResolution = Resolve-ExactIdentityEvidence -Current $missingCreationRoot -Expected $rootIdentity -EvidenceType 'STATIC_CREATION_UNAVAILABLE'
Assert-Static (-not $missingCreationResolution.matched -and $missingCreationResolution.reason -eq 'CREATION_DATE_UNAVAILABLE') 'CREATION_UNAVAILABLE_DISTINCT_FROM_REUSE'
$missingCreationClosure = Resolve-TrackedProcessClosure -ProcessIdentities @($missingCreationRoot) -TrackedRoots @((New-FixtureRoot -Role 'API' -Identity $rootIdentity))
Assert-Static ($missingCreationClosure.complete -eq $false) 'CREATION_UNAVAILABLE_BLOCKS_CLOSURE'
Assert-Static ($missingCreationClosure.pidReuseCollisions.Count -eq 0) 'CREATION_UNAVAILABLE_NOT_PID_REUSE'
Assert-Static (@($missingCreationClosure.priorProofFailures | Where-Object { $_.reason -eq 'ROOT_IDENTITY_CREATION_DATE_UNAVAILABLE' }).Count -eq 1) 'CREATION_UNAVAILABLE_PROOF_FAILURE_RECORDED'

# Verify the accepted replacement evidence remains byte-for-byte frozen.
$manifestPath = Join-Path $frozenRoot 'SHA256SUMS.json'
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$verifiedFiles = 0
foreach ($entry in @($manifest.files)) {
  $evidencePath = Join-Path $frozenRoot ([string]$entry.file)
  Assert-Static (Test-Path -LiteralPath $evidencePath) "MANIFEST_FILE_MISSING_$($entry.file)"
  $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $evidencePath).Hash.ToLowerInvariant()
  Assert-Static ($actualHash -eq [string]$entry.sha256) "MANIFEST_HASH_$($entry.file)"
  $verifiedFiles += 1
}

[pscustomobject][ordered]@{
  status = 'STATIC_IDENTITY_LINEAGE_TESTS_OK'
  cimQueries = 0
  trafficGenerated = $false
  samplerRuns = 0
  frozenEvidenceFilesVerified = $verifiedFiles
  frozenPid29020Classification = 'UNRESOLVED_COMMAND_LINE_UNAVAILABLE'
  frozenMsedgeClassification = 'TEMPORALLY_IMPOSSIBLE_DESCENDANT / REJECTED'
  validDescendantsPreserved = $validResult.descendantMatches.Count
} | ConvertTo-Json -Depth 5
