param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Output,

  [Parameter(Mandatory = $false)]
  [string]$TrackedRootsPath,

  [Parameter(Mandatory = $false)]
  [string]$PriorInventoryPath,

  [Parameter(Mandatory = $false)]
  [string]$KnownProtectedBackgroundPath,

  [Parameter(Mandatory = $false)]
  [string]$ExternalFinalizerIdentityPath,

  [Parameter(Mandatory = $false)]
  [string]$RunId,

  [Parameter(Mandatory = $false)]
  [string]$Phase
)

$ErrorActionPreference = 'Stop'
if ([bool]$RunId -ne [bool]$Phase) { throw 'INVENTORY_RUN_AND_PHASE_MUST_BE_BOUND_TOGETHER' }
if ($RunId -and $RunId -notmatch '^[A-Za-z0-9._:-]{1,128}$') { throw 'INVENTORY_RUN_ID_INVALID' }
if ($Phase -and $Phase -notin @('PREFLIGHT', 'BEFORE_WINDOW', 'BEFORE_SHUTDOWN', 'AFTER_SHUTDOWN')) { throw 'INVENTORY_PHASE_INVALID' }

function Write-InventoryJson {
  param(
    [Parameter(Mandatory = $true)]$Value,
    [Parameter(Mandatory = $true)][string]$Path
  )

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  $directory = [System.IO.Path]::GetDirectoryName($fullPath)
  if ($directory) {
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
  }

  $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
  $json = $Value | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText($fullPath, "$json$([Environment]::NewLine)", $utf8WithoutBom)
}

function Get-CreationTimeUtc {
  param($Process)
  if (-not $Process -or -not $Process.CreationDate) { return $null }
  try { return ([DateTimeOffset]([DateTime]$Process.CreationDate)).ToUniversalTime() } catch { return $null }
}

function Get-Sha256Hex {
  param([AllowNull()][string]$Value)
  if ($null -eq $Value) { return $null }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha256.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha256.Dispose()
  }
}

function New-SanitizedProcessIdentity {
  param($Process)

  $creationTime = Get-CreationTimeUtc $Process
  $creationEpochMs = if ($creationTime) { $creationTime.ToUnixTimeMilliseconds() } else { $null }
  $imageName = [string]$Process.Name
  $imageKey = $imageName.ToLowerInvariant()
  $executablePath = [string]$Process.ExecutablePath
  $commandLine = [string]$Process.CommandLine
  $executablePathAvailable = -not [string]::IsNullOrWhiteSpace($executablePath)
  $commandLineAvailable = -not [string]::IsNullOrWhiteSpace($commandLine)
  $normalizedExecutablePath = if ($executablePathAvailable) {
    try { [IO.Path]::GetFullPath($executablePath).Replace('/', '\').ToLowerInvariant() }
    catch { $executablePath.Replace('/', '\').ToLowerInvariant() }
  } else { $null }
  $executablePathSha256 = if ($normalizedExecutablePath) { Get-Sha256Hex $normalizedExecutablePath } else { $null }
  $commandLineSha256 = if ($commandLineAvailable) { Get-Sha256Hex $commandLine } else { $null }

  $identityStrength = if ($null -ne $creationEpochMs -and $imageKey -and $executablePathSha256 -and $commandLineSha256) {
    'FULL_CURRENT'
  } elseif ($null -eq $creationEpochMs) {
    'PARTIAL_NO_CREATION_DATE'
  } elseif (-not $executablePathSha256 -and -not $commandLineSha256) {
    'PARTIAL_NO_EXECUTABLE_OR_COMMAND_LINE'
  } elseif (-not $executablePathSha256) {
    'PARTIAL_NO_EXECUTABLE'
  } else {
    'PARTIAL_NO_COMMAND_LINE'
  }

  $identitySha256 = if ($identityStrength -eq 'FULL_CURRENT') {
    Get-Sha256Hex "$([int]$Process.ProcessId)|$creationEpochMs|$imageKey|$executablePathSha256|$commandLineSha256"
  } else { $null }

  [pscustomobject][ordered]@{
    pid = [int]$Process.ProcessId
    parentPid = [int]$Process.ParentProcessId
    imageName = $imageName
    creationAt = if ($creationTime) { $creationTime.ToString('o') } else { $null }
    creationEpochMs = $creationEpochMs
    sessionId = if ($null -ne $Process.SessionId) { [int]$Process.SessionId } else { $null }
    executablePathSha256 = $executablePathSha256
    commandLineSha256 = $commandLineSha256
    executablePathStatus = if ($executablePathAvailable) { 'AVAILABLE_HASHED' } else { 'UNAVAILABLE' }
    commandLineStatus = if ($commandLineAvailable) { 'AVAILABLE_HASHED' } else { 'UNAVAILABLE' }
    identityStrength = $identityStrength
    identitySha256 = $identitySha256
    identityEvidence = 'CURRENT_CIM_SNAPSHOT'
  }
}

function Resolve-ExactIdentityEvidence {
  param(
    [Parameter(Mandatory = $true)]$Current,
    [Parameter(Mandatory = $true)]$Expected,
    [Parameter(Mandatory = $true)][string]$EvidenceType
  )

  if (-not $Expected.identitySha256 -or -not $Expected.executablePathSha256 -or -not $Expected.commandLineSha256 `
    -or $null -eq $Expected.creationEpochMs) {
    return [pscustomobject]@{ matched = $false; reason = 'EXPECTED_FULL_IDENTITY_MISSING'; identity = $null }
  }
  if ([int]$Current.pid -ne [int]$Expected.pid) {
    return [pscustomobject]@{ matched = $false; reason = 'PID_MISMATCH'; identity = $null }
  }
  if ($null -eq $Current.creationEpochMs) {
    return [pscustomobject]@{ matched = $false; reason = 'CREATION_DATE_UNAVAILABLE'; identity = $null }
  }
  if ([long]$Current.creationEpochMs -ne [long]$Expected.creationEpochMs) {
    return [pscustomobject]@{ matched = $false; reason = 'CREATION_DATE_MISMATCH'; identity = $null }
  }
  if (-not [string]::Equals([string]$Current.imageName, [string]$Expected.imageName, [StringComparison]::OrdinalIgnoreCase)) {
    return [pscustomobject]@{ matched = $false; reason = 'EXECUTABLE_IMAGE_MISMATCH'; identity = $null }
  }
  if ($null -ne $Expected.parentPid -and [int]$Current.parentPid -ne [int]$Expected.parentPid) {
    return [pscustomobject]@{ matched = $false; reason = 'PARENT_PID_MISMATCH'; identity = $null }
  }
  if ($Current.executablePathSha256 -and $Current.executablePathSha256 -ne $Expected.executablePathSha256) {
    return [pscustomobject]@{ matched = $false; reason = 'EXECUTABLE_PATH_HASH_MISMATCH'; identity = $null }
  }
  if ($Current.commandLineSha256 -and $Current.commandLineSha256 -ne $Expected.commandLineSha256) {
    return [pscustomobject]@{ matched = $false; reason = 'COMMAND_LINE_HASH_MISMATCH'; identity = $null }
  }

  $strength = if ($Current.identityStrength -eq 'FULL_CURRENT') { 'FULL_CURRENT_EXACT_MATCH' } else { 'FULL_EXACT_EVIDENCE_ATTESTED' }
  $resolvedIdentity = [pscustomobject][ordered]@{
    pid = [int]$Current.pid
    parentPid = [int]$Current.parentPid
    imageName = [string]$Current.imageName
    creationAt = [string]$Current.creationAt
    creationEpochMs = [long]$Current.creationEpochMs
    sessionId = $Current.sessionId
    executablePathSha256 = [string]$Expected.executablePathSha256
    commandLineSha256 = [string]$Expected.commandLineSha256
    executablePathStatus = if ($Current.executablePathSha256) { 'AVAILABLE_HASHED' } else { 'PRIOR_EXACT_IDENTITY_ATTESTED' }
    commandLineStatus = if ($Current.commandLineSha256) { 'AVAILABLE_HASHED' } else { 'PRIOR_EXACT_IDENTITY_ATTESTED' }
    identityStrength = $strength
    identitySha256 = [string]$Expected.identitySha256
    identityEvidence = $EvidenceType
  }
  [pscustomobject]@{ matched = $true; reason = $null; identity = $resolvedIdentity }
}

function Get-ExpectedRootImageName {
  param([string]$Role)
  switch ($Role) {
    'API' { 'node.exe' }
    'CLIENT' { 'node.exe' }
    'HOST_SAMPLER' { 'powershell.exe' }
    'PROCESS_SAMPLER' { 'powershell.exe' }
    default { $null }
  }
}

function New-LineageRecord {
  param(
    [Parameter(Mandatory = $true)]$Identity,
    [Parameter(Mandatory = $true)][string]$Lineage,
    [Parameter(Mandatory = $true)][string]$ParentIdentitySha256,
    [Parameter(Mandatory = $true)][long]$ParentCreationEpochMs,
    [Parameter(Mandatory = $true)][string]$RootIdentitySha256,
    [Parameter(Mandatory = $true)][long]$RootCreationEpochMs
  )
  [pscustomobject][ordered]@{
    pid = [int]$Identity.pid
    parentPid = [int]$Identity.parentPid
    imageName = [string]$Identity.imageName
    creationAt = [string]$Identity.creationAt
    creationEpochMs = [long]$Identity.creationEpochMs
    sessionId = $Identity.sessionId
    executablePathSha256 = [string]$Identity.executablePathSha256
    commandLineSha256 = [string]$Identity.commandLineSha256
    identityStrength = [string]$Identity.identityStrength
    identitySha256 = [string]$Identity.identitySha256
    identityEvidence = [string]$Identity.identityEvidence
    parentIdentitySha256 = $ParentIdentitySha256
    parentCreationEpochMs = $ParentCreationEpochMs
    rootIdentitySha256 = $RootIdentitySha256
    rootCreationEpochMs = $RootCreationEpochMs
    lineage = $Lineage
    lineageVerified = $true
  }
}

function Resolve-TrackedProcessClosure {
  param(
    [Parameter(Mandatory = $true)][object[]]$ProcessIdentities,
    [Parameter(Mandatory = $true)][object[]]$TrackedRoots,
    [object[]]$PriorRootMatches = @(),
    [object[]]$PriorDescendants = @()
  )

  $processByPid = @{}
  foreach ($identity in $ProcessIdentities) { $processByPid[[int]$identity.pid] = $identity }
  $priorRootByPid = @{}
  foreach ($priorRoot in @($PriorRootMatches)) { $priorRootByPid[[int]$priorRoot.pid] = $priorRoot }
  $rootByPid = @{}
  foreach ($root in $TrackedRoots) { $rootByPid[[int]$root.pid] = $root }

  $rootIdentityMatches = [System.Collections.Generic.List[object]]::new()
  $pidReuseCollisions = [System.Collections.Generic.List[object]]::new()
  $lineageRejected = [System.Collections.Generic.List[object]]::new()
  $unverifiedDescendantCandidates = [System.Collections.Generic.List[object]]::new()
  $priorProofFailures = [System.Collections.Generic.List[object]]::new()
  $lineageByPid = @{}
  $descendantsByIdentity = @{}
  $processedPids = [System.Collections.Generic.HashSet[int]]::new()

  foreach ($root in $TrackedRoots) {
    $rootPid = [int]$root.pid
    $current = $processByPid[$rootPid]
    if (-not $current) { continue }
    [void]$processedPids.Add($rootPid)
    $expectedStartEpochMs = ([DateTimeOffset]::Parse([string]$root.startTimeUtc)).ToUnixTimeMilliseconds()
    $priorRoot = $priorRootByPid[$rootPid]
    $resolved = $null
    if ($priorRoot) {
      $resolved = Resolve-ExactIdentityEvidence -Current $current -Expected $priorRoot -EvidenceType 'PRIOR_ROOT_FULL_IDENTITY'
      if (-not $resolved.matched) {
        $record = [pscustomobject][ordered]@{ role = [string]$root.role; pid = $rootPid; expectedCreationEpochMs = $priorRoot.creationEpochMs; observedCreationEpochMs = $current.creationEpochMs; reason = $resolved.reason }
        if ($resolved.reason -eq 'CREATION_DATE_MISMATCH') { $pidReuseCollisions.Add($record) } else {
          $lineageRejected.Add($record)
          $priorProofFailures.Add([pscustomobject][ordered]@{ pid = $rootPid; role = [string]$root.role; reason = "ROOT_IDENTITY_$($resolved.reason)" })
        }
        continue
      }
    } else {
      $resolved = Resolve-ExactIdentityEvidence -Current $current -Expected $root -EvidenceType 'MANAGED_ROOT_FULL_IDENTITY_LEDGER'
      if (-not $resolved.matched) {
        $record = [pscustomobject][ordered]@{ role = [string]$root.role; pid = $rootPid; expectedCreationEpochMs = $expectedStartEpochMs; observedCreationEpochMs = $current.creationEpochMs; reason = $resolved.reason; identityStrength = $current.identityStrength }
        if ($resolved.reason -eq 'CREATION_DATE_MISMATCH') { $pidReuseCollisions.Add($record) } else {
          $lineageRejected.Add($record)
          $priorProofFailures.Add([pscustomobject][ordered]@{ pid = $rootPid; role = [string]$root.role; reason = "ROOT_IDENTITY_$($resolved.reason)" })
        }
        continue
      }
    }

    $identity = $resolved.identity
    $rootRecord = [pscustomobject][ordered]@{
      role = [string]$root.role
      pid = [int]$identity.pid
      parentPid = [int]$identity.parentPid
      imageName = [string]$identity.imageName
      creationAt = [string]$identity.creationAt
      creationEpochMs = [long]$identity.creationEpochMs
      sessionId = $identity.sessionId
      executablePathSha256 = [string]$identity.executablePathSha256
      commandLineSha256 = [string]$identity.commandLineSha256
      identityStrength = [string]$identity.identityStrength
      identitySha256 = [string]$identity.identitySha256
      identityEvidence = [string]$identity.identityEvidence
    }
    $rootIdentityMatches.Add($rootRecord)
    $lineageByPid[$rootPid] = [pscustomobject]@{
      identity = $identity
      rootIdentitySha256 = [string]$identity.identitySha256
      rootCreationEpochMs = [long]$identity.creationEpochMs
    }
  }

  foreach ($prior in @($PriorDescendants)) {
    $priorPid = [int]$prior.pid
    if ($priorPid -le 0 -or $rootByPid.ContainsKey($priorPid)) { continue }
    $current = $processByPid[$priorPid]
    if (-not $current) { continue }
    [void]$processedPids.Add($priorPid)
    $proofComplete = $prior.lineageVerified -eq $true -and $prior.identitySha256 -and $prior.parentIdentitySha256 `
      -and $prior.rootIdentitySha256 -and $null -ne $prior.parentCreationEpochMs -and $null -ne $prior.rootCreationEpochMs
    if (-not $proofComplete) {
      $priorProofFailures.Add([pscustomobject][ordered]@{ pid = $priorPid; imageName = [string]$current.imageName; reason = 'PRIOR_DESCENDANT_PROOF_INCOMPLETE' })
      continue
    }
    $resolved = Resolve-ExactIdentityEvidence -Current $current -Expected $prior -EvidenceType 'PRIOR_DESCENDANT_FULL_IDENTITY'
    if (-not $resolved.matched) {
      $record = [pscustomobject][ordered]@{ pid = $priorPid; expectedCreationEpochMs = $prior.creationEpochMs; observedCreationEpochMs = $current.creationEpochMs; reason = $resolved.reason }
      if ($resolved.reason -eq 'CREATION_DATE_MISMATCH') { $pidReuseCollisions.Add($record) } else {
        $lineageRejected.Add($record)
        $priorProofFailures.Add([pscustomobject][ordered]@{ pid = $priorPid; reason = "PRIOR_DESCENDANT_IDENTITY_$($resolved.reason)" })
      }
      continue
    }
    if ([long]$resolved.identity.creationEpochMs -lt [long]$prior.parentCreationEpochMs `
      -or [long]$resolved.identity.creationEpochMs -lt [long]$prior.rootCreationEpochMs) {
      $lineageRejected.Add([pscustomobject][ordered]@{ pid = $priorPid; creationEpochMs = $resolved.identity.creationEpochMs; parentCreationEpochMs = $prior.parentCreationEpochMs; rootCreationEpochMs = $prior.rootCreationEpochMs; reason = 'PRIOR_DESCENDANT_TEMPORAL_ORDER_INVALID' })
      continue
    }
    $record = New-LineageRecord -Identity $resolved.identity -Lineage 'PRIOR_DESCENDANT_FULL_IDENTITY' `
      -ParentIdentitySha256 ([string]$prior.parentIdentitySha256) -ParentCreationEpochMs ([long]$prior.parentCreationEpochMs) `
      -RootIdentitySha256 ([string]$prior.rootIdentitySha256) -RootCreationEpochMs ([long]$prior.rootCreationEpochMs)
    $descendantsByIdentity[$record.identitySha256] = $record
    $lineageByPid[$priorPid] = [pscustomobject]@{ identity = $resolved.identity; rootIdentitySha256 = $record.rootIdentitySha256; rootCreationEpochMs = $record.rootCreationEpochMs }
  }

  $changed = $true
  while ($changed) {
    $changed = $false
    foreach ($current in $ProcessIdentities) {
      $currentPid = [int]$current.pid
      if ($processedPids.Contains($currentPid) -or $rootByPid.ContainsKey($currentPid)) { continue }
      $parentLineage = $lineageByPid[[int]$current.parentPid]
      if (-not $parentLineage) { continue }
      [void]$processedPids.Add($currentPid)
      if ($null -eq $current.creationEpochMs -or $current.identityStrength -ne 'FULL_CURRENT') {
        $unverifiedDescendantCandidates.Add([pscustomobject][ordered]@{ pid = $currentPid; parentPid = [int]$current.parentPid; imageName = [string]$current.imageName; creationEpochMs = $current.creationEpochMs; identityStrength = $current.identityStrength; reason = 'DESCENDANT_FULL_IDENTITY_REQUIRED' })
        continue
      }
      if ([long]$current.creationEpochMs -lt [long]$parentLineage.identity.creationEpochMs) {
        $lineageRejected.Add([pscustomobject][ordered]@{ pid = $currentPid; parentPid = [int]$current.parentPid; imageName = [string]$current.imageName; creationEpochMs = $current.creationEpochMs; parentCreationEpochMs = $parentLineage.identity.creationEpochMs; reason = 'CHILD_PREDATES_PARENT' })
        continue
      }
      if ([long]$current.creationEpochMs -lt [long]$parentLineage.rootCreationEpochMs) {
        $lineageRejected.Add([pscustomobject][ordered]@{ pid = $currentPid; parentPid = [int]$current.parentPid; imageName = [string]$current.imageName; creationEpochMs = $current.creationEpochMs; rootCreationEpochMs = $parentLineage.rootCreationEpochMs; reason = 'CHILD_PREDATES_MANAGED_ROOT' })
        continue
      }
      $record = New-LineageRecord -Identity $current -Lineage 'CURRENT_FULL_IDENTITY_PARENT_CHAIN' `
        -ParentIdentitySha256 ([string]$parentLineage.identity.identitySha256) -ParentCreationEpochMs ([long]$parentLineage.identity.creationEpochMs) `
        -RootIdentitySha256 ([string]$parentLineage.rootIdentitySha256) -RootCreationEpochMs ([long]$parentLineage.rootCreationEpochMs)
      $descendantsByIdentity[$record.identitySha256] = $record
      $lineageByPid[$currentPid] = [pscustomobject]@{ identity = $current; rootIdentitySha256 = $record.rootIdentitySha256; rootCreationEpochMs = $record.rootCreationEpochMs }
      $changed = $true
    }
  }

  $orderedRoots = @($rootIdentityMatches | Sort-Object -Property @{ Expression = { [int]$_.pid } })
  $orderedDescendants = @($descendantsByIdentity.Values | Sort-Object -Property @{ Expression = { [int]$_.pid } }, @{ Expression = { [long]$_.creationEpochMs } })
  $orderedCollisions = @($pidReuseCollisions | Sort-Object -Property @{ Expression = { [int]$_.pid } })
  $orderedRejected = @($lineageRejected | Sort-Object -Property @{ Expression = { [int]$_.pid } })
  $orderedUnverified = @($unverifiedDescendantCandidates | Sort-Object -Property @{ Expression = { [int]$_.pid } })
  $orderedPriorFailures = @($priorProofFailures | Sort-Object -Property @{ Expression = { [int]$_.pid } })
  $currentTrackedMatches = $orderedRoots.Count + $orderedDescendants.Count

  [pscustomobject][ordered]@{
    rootIdentityMatches = $orderedRoots
    descendantMatches = $orderedDescendants
    pidReuseCollisions = $orderedCollisions
    lineageRejected = $orderedRejected
    unverifiedDescendantCandidates = $orderedUnverified
    priorProofFailures = $orderedPriorFailures
    currentTrackedMatches = $currentTrackedMatches
    complete = ($currentTrackedMatches -eq 0 -and $orderedUnverified.Count -eq 0 -and $orderedPriorFailures.Count -eq 0)
  }
}

if ($PriorInventoryPath -and -not $TrackedRootsPath) {
  throw 'PRIOR_INVENTORY_REQUIRES_TRACKED_ROOTS'
}

$captureStartedAt = [DateTime]::UtcNow.ToString('o')
$queryStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$ownPid = $PID
$signatures = @(
  [pscustomobject]@{ scope = 'P9'; role = 'RUNTIME'; artifact = 'scripts/p9-controlled-active-runtime.ts'; token = 'p9-controlled-active-runtime' },
  [pscustomobject]@{ scope = 'P9'; role = 'LOAD'; artifact = 'scripts/p9-controlled-load.mjs'; token = 'p9-controlled-load' },
  [pscustomobject]@{ scope = 'P9'; role = 'SOAK'; artifact = 'scripts/Invoke-P9-SoakCheckpoint.ps1'; token = 'Invoke-P9-SoakCheckpoint' },
  [pscustomobject]@{ scope = 'P9'; role = 'CONTROLLED_REPRODUCTION'; artifact = 'scripts/Invoke-P9-ControlledReproduction.ps1'; token = 'Invoke-P9-ControlledReproduction' },
  [pscustomobject]@{ scope = 'P9'; role = 'BASIC_ISOLATION'; artifact = 'scripts/Investigate-P9-BasicIsolation.ps1'; token = 'Investigate-P9-BasicIsolation' },
  [pscustomobject]@{ scope = 'P9'; role = 'PILOT_TEST'; artifact = 'scripts/test-copilot-v1-2-p9-pilot.ts'; token = 'test-copilot-v1-2-p9-pilot' },
  [pscustomobject]@{ scope = 'P9'; role = 'DAILY_MONITOR'; artifact = 'scripts/Invoke-P9-DailyMonitor.ps1'; token = 'Invoke-P9-DailyMonitor' },
  [pscustomobject]@{ scope = 'P9'; role = 'DAILY_MONITOR_TEST'; artifact = 'scripts/Test-P9-DailyMonitor.ps1'; token = 'Test-P9-DailyMonitor' },
  [pscustomobject]@{ scope = 'P9'; role = 'MONITOR_INSTALLER'; artifact = 'scripts/Install-P9-SoakMonitor.ps1'; token = 'Install-P9-SoakMonitor' },
  [pscustomobject]@{ scope = 'OBSERVER'; role = 'HOST_SAMPLER'; artifact = 'scripts/Sample-RealBasicHost.ps1'; token = 'Sample-RealBasicHost' },
  [pscustomobject]@{ scope = 'OBSERVER'; role = 'PROCESS_SAMPLER'; artifact = 'scripts/Sample-RealBasicProcesses.ps1'; token = 'Sample-RealBasicProcesses' },
  [pscustomobject]@{ scope = 'OBSERVER'; role = 'CONTROLLED_HOST_SAMPLER'; artifact = 'scripts/Sample-ControlledReproductionHost.ps1'; token = 'Sample-ControlledReproductionHost' },
  [pscustomobject]@{ scope = 'OBSERVER'; role = 'REAL_BASIC_RUNNER'; artifact = 'scripts/Invoke-RealBasicTimeoutInvestigation.ps1'; token = 'Invoke-RealBasicTimeoutInvestigation' },
  [pscustomobject]@{ scope = 'OBSERVER'; role = 'SHORT_WINDOW_RUNNER'; artifact = 'scripts/Invoke-ShortP9OffDiagnosticWindow.ps1'; token = 'Invoke-ShortP9OffDiagnosticWindow' },
  [pscustomobject]@{ scope = 'OBSERVER'; role = 'LIFECYCLE_RUNNER'; artifact = 'scripts/Invoke-InstrumentationLifecycleClosure.ps1'; token = 'Invoke-InstrumentationLifecycleClosure' },
  [pscustomobject]@{ scope = 'OBSERVER'; role = 'HOST_MEASUREMENT'; artifact = 'scripts/Measure-InstrumentationObserverHost.ps1'; token = 'Measure-InstrumentationObserverHost' },
  [pscustomobject]@{ scope = 'OBSERVER'; role = 'API_CLIENT'; artifact = 'scripts/measure-observer-api-client.mjs'; token = 'measure-observer-api-client' },
  [pscustomobject]@{ scope = 'OBSERVER'; role = 'PUBLIC_BROWSER_CLIENT'; artifact = 'scripts/measure-public-browser-latency.mjs'; token = 'measure-public-browser-latency' },
  [pscustomobject]@{ scope = 'OBSERVER'; role = 'REAL_BASIC_CLIENT'; artifact = 'scripts/real-basic-timeout-correlated-probe.mjs'; token = 'real-basic-timeout-correlated-probe' },
  [pscustomobject]@{ scope = 'OBSERVER'; role = 'LIFECYCLE_CLIENT'; artifact = 'scripts/instrumentation-lifecycle-probe.mjs'; token = 'instrumentation-lifecycle-probe' },
  [pscustomobject]@{ scope = 'OBSERVER'; role = 'PROCESS_INVENTORY'; artifact = 'scripts/Get-InstrumentationLifecycleProcessInventory.ps1'; token = 'Get-InstrumentationLifecycleProcessInventory' }
)

$candidateImages = @(
  'node',
  'node.exe',
  'powershell',
  'powershell.exe',
  'pwsh',
  'pwsh.exe',
  'cmd',
  'cmd.exe'
)

try {
  # Deliberately take exactly one process-table snapshot. Do not retry a denied
  # query and never translate a provider failure into an empty process set.
  $processSnapshot = @(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)
} catch {
  $queryStopwatch.Stop()
  $failure = [ordered]@{
    contract = 'agm-instrumentation-lifecycle-process-inventory.v2'
    runId = if ($RunId) { $RunId } else { $null }
    capturePhase = if ($Phase) { $Phase } else { $null }
    captureStartedAt = $captureStartedAt
    capturedAt = [DateTime]::UtcNow.ToString('o')
    queryDurationMs = [Math]::Round($queryStopwatch.Elapsed.TotalMilliseconds, 3)
    queryStatus = 'FAILURE'
    queryProvider = 'CIM_WIN32_PROCESS_SINGLE_SNAPSHOT'
    queryAttempts = 1
    ownPidExcluded = $ownPid
    coverageStatus = 'UNKNOWN'
    processesInspected = $null
    candidateProcessesInspected = $null
    candidateCommandLinesUnavailable = $null
    matches = $null
    matchCounts = $null
    error = [ordered]@{
      classification = if ($_.Exception.Message -match '(?i)access denied') { 'ACCESS_DENIED' } else { 'CIM_QUERY_FAILED' }
      exceptionType = $_.Exception.GetType().FullName
      hresult = $_.Exception.HResult
    }
    trafficGenerated = $false
    processChanges = 0
  }
  Write-InventoryJson -Value $failure -Path $Output
  throw 'INSTRUMENTATION_LIFECYCLE_PROCESS_INVENTORY_QUERY_FAILED'
}

$queryStopwatch.Stop()
$capturedAt = [DateTime]::UtcNow.ToString('o')
$inspected = @($processSnapshot | Where-Object { [int]$_.ProcessId -ne $ownPid })
$unreadableCandidates = [System.Collections.Generic.List[object]]::new()
$knownProtectedCandidates = [System.Collections.Generic.List[object]]::new()
$matches = [System.Collections.Generic.List[object]]::new()
$processIdentities = [System.Collections.Generic.List[object]]::new()
$candidateCount = 0
$knownProtectedByPid = @{}
$knownProtectedEvidenceFull = $null
$knownProtectedEvidenceSha256 = $null
$declaredExternalFinalizer = $null

if ($KnownProtectedBackgroundPath) {
  $knownProtectedEvidenceFull = [IO.Path]::GetFullPath($KnownProtectedBackgroundPath)
  if (-not (Test-Path -LiteralPath $knownProtectedEvidenceFull)) { throw 'KNOWN_PROTECTED_BACKGROUND_FILE_MISSING' }
  $knownProtectedEvidence = Get-Content -Raw -LiteralPath $knownProtectedEvidenceFull | ConvertFrom-Json
  $knownProtectedEvidenceSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $knownProtectedEvidenceFull).Hash.ToLowerInvariant()
  $supervisorSourcePath = Join-Path $PSScriptRoot 'Start-AGM-Services.ps1'
  $supervisorSourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $supervisorSourcePath).Hash.ToLowerInvariant()
  if ($knownProtectedEvidence.contract -ne 'agm-instrumentation-known-protected-background.v1' `
    -or $knownProtectedEvidence.scope -ne 'PRE_EXISTING_BACKGROUND / NON_P9 / NON_OBSERVER' `
    -or $knownProtectedEvidence.source.scheduledTask.expectedActionMatched -ne $true `
    -or $knownProtectedEvidence.source.supervisorSource.p9OrInstrumentationInvocationFound -ne $false `
    -or $knownProtectedEvidence.source.supervisorSource.sha256 -ne $supervisorSourceHash `
    -or $knownProtectedEvidence.acceptanceRule -ne 'EXEMPT_ONLY_WHILE_PID_PARENT_IMAGE_SESSION_AND_CREATION_IDENTITY_ALL_MATCH' `
    -or $knownProtectedEvidence.rawCommandLinesRecorded -ne $false `
    -or $knownProtectedEvidence.secretsRecorded -ne $false) {
    throw 'KNOWN_PROTECTED_BACKGROUND_EVIDENCE_INVALID'
  }
  foreach ($known in @($knownProtectedEvidence.processes)) {
    $knownPid = [int]$known.pid
    if ($knownPid -le 0 -or $knownProtectedByPid.ContainsKey($knownPid)) { throw 'KNOWN_PROTECTED_BACKGROUND_PID_INVALID' }
    $knownProtectedByPid[$knownPid] = $known
  }
}

foreach ($process in $inspected) {
  $identity = New-SanitizedProcessIdentity $process
  $processIdentities.Add($identity)
  $imageName = [string]$identity.imageName
  $imageKey = $imageName.ToLowerInvariant()
  $isCandidateImage = $imageKey -in $candidateImages
  if ($isCandidateImage) { $candidateCount += 1 }

  $commandLine = [string]$process.CommandLine
  if ([string]::IsNullOrWhiteSpace($commandLine)) {
    if ($isCandidateImage) {
      $known = $knownProtectedByPid[[int]$process.ProcessId]
      if ($known) {
        $expectedCreationEpochMs = ([DateTimeOffset]::Parse([string]$known.creationAt)).ToUnixTimeMilliseconds()
        $identityMatches = [int]$process.ParentProcessId -eq [int]$known.parentPid `
          -and [string]::Equals($imageName, [string]$known.imageName, [StringComparison]::OrdinalIgnoreCase) `
          -and [int]$process.SessionId -eq [int]$known.sessionId `
          -and $null -ne $identity.creationEpochMs `
          -and [long]$identity.creationEpochMs -eq $expectedCreationEpochMs
        if ($identityMatches) {
          $knownProtectedCandidates.Add([pscustomobject][ordered]@{
            pid = [int]$identity.pid
            parentPid = [int]$identity.parentPid
            imageName = $imageName
            creationAt = [string]$identity.creationAt
            creationEpochMs = [long]$identity.creationEpochMs
            sessionId = $identity.sessionId
            executablePathSha256 = $identity.executablePathSha256
            commandLineSha256 = $identity.commandLineSha256
            identityStrength = 'EXACT_KNOWN_PROTECTED_ATTESTATION'
            identitySha256 = $identity.identitySha256
            attestationSha256 = $knownProtectedEvidenceSha256
            classification = 'KNOWN_AGM_SERVICES_SUPERVISOR_AND_API'
          })
          continue
        }
      }
      $unreadableCandidates.Add([pscustomobject][ordered]@{
        pid = [int]$identity.pid
        parentPid = [int]$identity.parentPid
        imageName = $imageName
        creationAt = [string]$identity.creationAt
        creationEpochMs = $identity.creationEpochMs
        sessionId = $identity.sessionId
        executablePathSha256 = $identity.executablePathSha256
        commandLineSha256 = $null
        identityStrength = [string]$identity.identityStrength
        identitySha256 = $identity.identitySha256
        classification = 'UNRESOLVED_COMMAND_LINE_UNAVAILABLE'
      })
    }
    continue
  }

  $hits = @($signatures | Where-Object {
    $commandLine.IndexOf($_.token, [StringComparison]::OrdinalIgnoreCase) -ge 0
  })
  if ($hits.Count -eq 0) { continue }

  $matches.Add([pscustomobject][ordered]@{
    pid = [int]$identity.pid
    parentPid = [int]$identity.parentPid
    imageName = $imageName
    creationAt = [string]$identity.creationAt
    creationEpochMs = $identity.creationEpochMs
    sessionId = $identity.sessionId
    executablePathSha256 = $identity.executablePathSha256
    commandLineSha256 = $identity.commandLineSha256
    identityStrength = [string]$identity.identityStrength
    identitySha256 = $identity.identitySha256
    scopes = @($hits.scope | Sort-Object -Unique)
    roles = @($hits.role | Sort-Object -Unique)
    matchedArtifacts = @($hits.artifact | Sort-Object -Unique)
  })
}

$orderedMatches = @($matches | Sort-Object -Property @{ Expression = { [int]$_.pid } })
$p9Count = @($orderedMatches | Where-Object { 'P9' -in $_.scopes }).Count
$observerCount = @($orderedMatches | Where-Object { 'OBSERVER' -in $_.scopes }).Count
$coverageStatus = if ($unreadableCandidates.Count -ne 0) {
  'INCOMPLETE_COMMAND_LINE_VISIBILITY'
} elseif ($knownProtectedCandidates.Count -ne 0) {
  'COMPLETE_WITH_IDENTITY_BOUND_KNOWN_PROTECTED_BACKGROUND'
} else {
  'COMPLETE_FOR_CANDIDATE_IMAGES'
}

if ($ExternalFinalizerIdentityPath) {
  $finalizerIdentityFull = [IO.Path]::GetFullPath($ExternalFinalizerIdentityPath)
  if (-not (Test-Path -LiteralPath $finalizerIdentityFull)) { throw 'EXTERNAL_FINALIZER_IDENTITY_MISSING' }
  $declared = Get-Content -Raw -LiteralPath $finalizerIdentityFull | ConvertFrom-Json
  if ($declared.contract -ne 'agm-instrumentation-external-finalizer-identity.v1' -or $declared.runId -ne $RunId `
    -or $declared.role -ne 'EXTERNAL_FINALIZER' -or [int]$declared.pid -le 0 -or -not $declared.identitySha256) {
    throw 'EXTERNAL_FINALIZER_IDENTITY_CONTRACT_INVALID'
  }
  $observed = @($processIdentities | Where-Object { [int]$_.pid -eq [int]$declared.pid })
  if ($observed.Count -ne 1 -or $observed[0].identityStrength -ne 'FULL_CURRENT' `
    -or $observed[0].identitySha256 -ne $declared.identitySha256) {
    throw 'EXTERNAL_FINALIZER_EXACT_IDENTITY_NOT_OBSERVED'
  }
  $declaredExternalFinalizer = [ordered]@{
    role = 'EXTERNAL_FINALIZER'
    pid = [int]$declared.pid
    identitySha256 = [string]$declared.identitySha256
    observed = $true
    treatment = 'DECLARED_CONTROL_PROCESS / NOT_A_MANAGED_AGM_PROCESS / EXACT_IDENTITY_ONLY'
    genericObserverFiltering = $false
  }
}

$trackedClosure = [ordered]@{
  requested = $false
  rootsSource = $null
  priorInventorySource = $null
  rootsRequested = 0
  priorDescendantIdentities = 0
  rootIdentityMatches = @()
  descendantMatches = @()
  pidReuseCollisions = @()
  lineageRejected = @()
  unverifiedDescendantCandidates = @()
  priorProofFailures = @()
  currentTrackedMatches = 0
  complete = $null
  method = 'FULL_SANITIZED_IDENTITY_PLUS_TEMPORALLY_VALIDATED_PARENT_LINEAGE'
}

if ($TrackedRootsPath) {
  $trackedRootsFull = [IO.Path]::GetFullPath($TrackedRootsPath)
  if (-not (Test-Path -LiteralPath $trackedRootsFull)) { throw 'TRACKED_ROOTS_FILE_MISSING' }
  $trackedRootsDocument = Get-Content -Raw -LiteralPath $trackedRootsFull | ConvertFrom-Json
  if ($trackedRootsDocument.contract -ne 'agm-instrumentation-lifecycle-managed-process-roots.v2' `
    -or $trackedRootsDocument.identity -ne 'PID_CREATION_EPOCH_MS_IMAGE_EXECUTABLE_PATH_SHA256_COMMAND_LINE_SHA256' `
    -or $trackedRootsDocument.identityHashAlgorithm -ne 'SHA256' `
    -or $trackedRootsDocument.rawExecutablePathsRecorded -ne $false `
    -or $trackedRootsDocument.rawCommandLinesRecorded -ne $false) {
    throw 'TRACKED_ROOTS_FULL_IDENTITY_CONTRACT_INVALID'
  }
  if ($RunId -and [string]$trackedRootsDocument.runId -ne $RunId) { throw 'TRACKED_ROOTS_RUN_BINDING_MISMATCH' }
  $trackedRoots = @($trackedRootsDocument.managedRoots)
  if ($trackedRoots.Count -eq 0) { throw 'TRACKED_ROOTS_EMPTY' }

  $rootByPid = @{}
  foreach ($root in $trackedRoots) {
    $trackedPid = [int]$root.pid
    if ($trackedPid -le 0 -or $null -eq $root.parentPid -or -not $root.startTimeUtc -or -not $root.creationAt `
      -or $null -eq $root.creationEpochMs -or -not $root.imageName `
      -or -not $root.executablePathSha256 -or -not $root.commandLineSha256 -or -not $root.identitySha256 `
      -or $root.identityStrength -ne 'FULL_CURRENT' -or $root.identityEvidence -ne 'INITIAL_MANAGED_ROOT_SNAPSHOT') { throw 'TRACKED_ROOT_FULL_IDENTITY_INVALID' }
    if ($rootByPid.ContainsKey($trackedPid)) { throw 'TRACKED_ROOT_PID_DUPLICATE' }
    $startEpochMs = ([DateTimeOffset]::Parse([string]$root.startTimeUtc)).ToUnixTimeMilliseconds()
    $creationAtEpochMs = ([DateTimeOffset]::Parse([string]$root.creationAt)).ToUnixTimeMilliseconds()
    if ([Math]::Abs([long]$root.creationEpochMs - $startEpochMs) -gt 2000) { throw 'TRACKED_ROOT_START_AND_CREATION_MISMATCH' }
    if ([long]$root.creationEpochMs -ne $creationAtEpochMs) { throw 'TRACKED_ROOT_CREATION_FIELDS_MISMATCH' }
    $expectedImageName = Get-ExpectedRootImageName ([string]$root.role)
    if (-not $expectedImageName -or -not [string]::Equals([string]$root.imageName, $expectedImageName, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'TRACKED_ROOT_ROLE_EXECUTABLE_MISMATCH'
    }
    $canonicalRootHash = Get-Sha256Hex "$trackedPid|$([long]$root.creationEpochMs)|$(([string]$root.imageName).ToLowerInvariant())|$($root.executablePathSha256)|$($root.commandLineSha256)"
    if ($canonicalRootHash -ne [string]$root.identitySha256) { throw 'TRACKED_ROOT_IDENTITY_HASH_MISMATCH' }
    $rootByPid[$trackedPid] = $root
  }

  $priorDescendants = @()
  $priorRootMatches = @()
  if ($PriorInventoryPath) {
    $priorInventoryFull = [IO.Path]::GetFullPath($PriorInventoryPath)
    if (-not (Test-Path -LiteralPath $priorInventoryFull)) { throw 'PRIOR_INVENTORY_FILE_MISSING' }
    $priorInventory = Get-Content -Raw -LiteralPath $priorInventoryFull | ConvertFrom-Json
    if ($priorInventory.queryStatus -ne 'SUCCESS') { throw 'PRIOR_INVENTORY_QUERY_NOT_SUCCESSFUL' }
    if ($priorInventory.contract -ne 'agm-instrumentation-lifecycle-process-inventory.v2') { throw 'PRIOR_INVENTORY_IDENTITY_CONTRACT_INVALID' }
    if ($RunId) {
      if ([string]$priorInventory.runId -ne $RunId) { throw 'PRIOR_INVENTORY_RUN_BINDING_MISMATCH' }
      $expectedPriorPhase = if ($Phase -eq 'BEFORE_SHUTDOWN') { 'BEFORE_WINDOW' } elseif ($Phase -eq 'AFTER_SHUTDOWN') { 'BEFORE_SHUTDOWN' } else { $null }
      if (-not $expectedPriorPhase -or [string]$priorInventory.capturePhase -ne $expectedPriorPhase) { throw 'PRIOR_INVENTORY_PHASE_CHAIN_INVALID' }
    }
    $priorDescendants = @($priorInventory.trackedClosure.descendantMatches)
    $priorRootMatches = @($priorInventory.trackedClosure.rootIdentityMatches)
    $trackedClosure.priorInventorySource = $priorInventoryFull
  }
  $resolvedClosure = Resolve-TrackedProcessClosure -ProcessIdentities @($processIdentities) -TrackedRoots $trackedRoots `
    -PriorRootMatches $priorRootMatches -PriorDescendants $priorDescendants
  $trackedClosure.requested = $true
  $trackedClosure.rootsSource = $trackedRootsFull
  $trackedClosure.rootsRequested = $trackedRoots.Count
  $trackedClosure.priorDescendantIdentities = $priorDescendants.Count
  $trackedClosure.rootIdentityMatches = $resolvedClosure.rootIdentityMatches
  $trackedClosure.descendantMatches = $resolvedClosure.descendantMatches
  $trackedClosure.pidReuseCollisions = $resolvedClosure.pidReuseCollisions
  $trackedClosure.lineageRejected = $resolvedClosure.lineageRejected
  $trackedClosure.unverifiedDescendantCandidates = $resolvedClosure.unverifiedDescendantCandidates
  $trackedClosure.priorProofFailures = $resolvedClosure.priorProofFailures
  $trackedClosure.currentTrackedMatches = $resolvedClosure.currentTrackedMatches
  $trackedClosure.complete = $resolvedClosure.complete
}

$result = [ordered]@{
  contract = 'agm-instrumentation-lifecycle-process-inventory.v2'
  identityContract = 'agm-instrumentation-sanitized-process-identity.v2'
  runId = if ($RunId) { $RunId } else { $null }
  capturePhase = if ($Phase) { $Phase } else { $null }
  captureStartedAt = $captureStartedAt
  capturedAt = $capturedAt
  queryDurationMs = [Math]::Round($queryStopwatch.Elapsed.TotalMilliseconds, 3)
  queryStatus = 'SUCCESS'
  queryProvider = 'CIM_WIN32_PROCESS_SINGLE_SNAPSHOT'
  queryAttempts = 1
  ownPidExcluded = $ownPid
  coverageStatus = $coverageStatus
  processesInspected = $inspected.Count
  candidateProcessesInspected = $candidateCount
  candidateCommandLinesUnavailable = @($unreadableCandidates | Sort-Object -Property @{ Expression = { [int]$_.pid } })
  knownProtectedBackground = [ordered]@{
    evidenceProvided = [bool]$KnownProtectedBackgroundPath
    evidencePath = $knownProtectedEvidenceFull
    evidenceSha256 = $knownProtectedEvidenceSha256
    identityBoundCandidates = @($knownProtectedCandidates | Sort-Object -Property @{ Expression = { [int]$_.pid } })
    identityBoundCount = $knownProtectedCandidates.Count
    unclassifiedUnavailableCount = $unreadableCandidates.Count
    rawCommandLinesRequiredForExemption = $false
    exemptionBasis = if ($knownProtectedCandidates.Count -gt 0) { 'EXACT_PID_PARENT_IMAGE_SESSION_CREATION_PLUS_TASK_AND_SOURCE_HASH_ATTESTATION' } else { $null }
  }
  matches = $orderedMatches
  matchCounts = [ordered]@{
    total = $orderedMatches.Count
    p9 = $p9Count
    observer = $observerCount
  }
  externalFinalizer = $declaredExternalFinalizer
  trackedClosure = $trackedClosure
  sanitization = [ordered]@{
    rawCommandLinesRecorded = $false
    executablePathsRecorded = $false
    creationEpochMsRecorded = $true
    executablePathHashAlgorithm = 'SHA256'
    commandLineHashAlgorithm = 'SHA256'
    identityHashAlgorithm = 'SHA256'
    identityCanonicalForm = 'pid|creationEpochMs|lowercaseImageName|executablePathSha256|commandLineSha256'
  }
  trafficGenerated = $false
  processChanges = 0
}

Write-InventoryJson -Value $result -Path $Output
