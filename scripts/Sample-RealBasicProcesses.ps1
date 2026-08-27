param(
  [Parameter(Mandatory = $true)][int]$ApiPid,
  [Parameter(Mandatory = $true)][string]$ApiStartTimeUtc,
  [Parameter(Mandatory = $true)][int]$ParentPid,
  [Parameter(Mandatory = $true)][string]$ParentStartTimeUtc,
  [Parameter(Mandatory = $true)][string]$Output,
  [Parameter(Mandatory = $true)][string]$StopSignal,
  [Parameter(Mandatory = $true)][string]$ReleaseSignal,
  [Parameter(Mandatory = $true)][string]$BoundaryReadyOutput,
  [Parameter(Mandatory = $true)][string]$LifecycleOutput,
  [Parameter(Mandatory = $true)][string]$RunId,
  [Parameter(Mandatory = $true)][string]$StartSignal,
  [ValidateRange(1, 300)][int]$SampleIntervalSeconds = 150,
  [ValidateRange(1, 1440)][int]$MaxRuntimeMinutes = 120
)

$ErrorActionPreference = 'Stop'
$startedAt = [DateTimeOffset]::UtcNow
$deadline = $startedAt.AddMinutes($MaxRuntimeMinutes)
$samplerStartTimeUtc = (Get-Process -Id $PID -ErrorAction Stop).StartTime.ToUniversalTime().ToString('o')
$sequence = 0
$topLimit = 24
$firstSampleAt = $null
$lastSampleAt = $null
$startSignalObservedAt = $null
$measurementBaselineAt = $null
$measurementBaselineCompletedAt = $null
$measurementFinalAt = $null
$measurementFinalCompletedAt = $null
$measurementCadenceSeconds = $null
$startSignalDocument = $null
$startSignalStartAtEpochMs = $null
$startSignalDurationSeconds = $null
$startSignalWindowId = $null
$boundarySignal = $null
$boundaryObservedAt = $null
$boundaryReadyAt = $null
$releaseSignalDocument = $null
$releaseObservedAt = $null
$formalBaselineRecord = $null
$measurementFinalRecord = $null
$stopReason = 'STARTING'
$exitCode = 1
$errorRecord = $null
$writer = $null
$apiProcess = $null
$parentProcess = $null

function Convert-ExpectedStartTime {
  param([Parameter(Mandatory = $true)][string]$Value)
  return [DateTimeOffset]::Parse(
    $Value,
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.DateTimeStyles]::RoundtripKind
  ).UtcDateTime
}

function Convert-ScheduledAtEvidenceValue {
  param([AllowNull()]$Value)

  if ($null -eq $Value) { return $null }
  if ($Value -is [DateTimeOffset]) { return ([DateTimeOffset]$Value).ToString('o') }

  $converted = [DateTimeOffset]::MinValue
  $parsed = [DateTimeOffset]::TryParse(
    [string]$Value,
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.DateTimeStyles]::RoundtripKind,
    [ref]$converted
  )
  if ($parsed) { return $converted.ToString('o') }
  return 'not_available'
}

function Convert-CadenceSecondsEvidenceValue {
  param([AllowNull()]$Value)

  if ($null -eq $Value) { return $null }
  $converted = 0.0
  if (-not [double]::TryParse(
    [string]$Value,
    [Globalization.NumberStyles]::Float,
    [Globalization.CultureInfo]::InvariantCulture,
    [ref]$converted
  )) { return 'not_available' }
  if ([double]::IsNaN($converted) -or [double]::IsInfinity($converted) -or $converted -lt 0) {
    return 'not_available'
  }
  return [Math]::Round($converted, 3)
}

function Open-ExpectedProcess {
  param(
    [Parameter(Mandatory = $true)][int]$ProcessId,
    [Parameter(Mandatory = $true)][string]$ExpectedStartTimeUtc,
    [Parameter(Mandatory = $true)][string]$Role
  )

  $process = [System.Diagnostics.Process]::GetProcessById($ProcessId)
  try {
    $expected = Convert-ExpectedStartTime $ExpectedStartTimeUtc
    $actual = $process.StartTime.ToUniversalTime()
    if ($actual.Ticks -ne $expected.Ticks) {
      throw "${Role}_PROCESS_IDENTITY_MISMATCH_$ProcessId"
    }
    return $process
  } catch {
    $process.Dispose()
    throw
  }
}

function Test-TrackedProcessAlive {
  param([System.Diagnostics.Process]$Process)
  if ($null -eq $Process) { return $false }
  try {
    $Process.Refresh()
    return -not $Process.HasExited
  } catch {
    return $false
  }
}

function Get-FatalLifecycleReason {
  if ([DateTimeOffset]::UtcNow -ge $deadline) { return 'DEADLINE' }
  if (-not (Test-TrackedProcessAlive $apiProcess)) { return 'API_EXITED' }
  if (-not (Test-TrackedProcessAlive $parentProcess)) { return 'PARENT_EXITED' }
  return $null
}

function Read-RunBoundSignal {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$ExpectedContract,
    [Parameter(Mandatory = $true)][string]$Role
  )

  if (-not [System.IO.File]::Exists($Path)) { return $null }
  try {
    $text = [System.IO.File]::ReadAllText($Path)
  } catch [System.IO.IOException] {
    return $null
  } catch [System.UnauthorizedAccessException] {
    return $null
  }
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }

  try {
    $document = $text | ConvertFrom-Json
  } catch {
    throw "${Role}_SIGNAL_JSON_INVALID"
  }
  if ([string]$document.contract -ne $ExpectedContract) { throw "${Role}_SIGNAL_CONTRACT_MISMATCH" }
  if ([string]$document.runId -ne $RunId) { throw "${Role}_SIGNAL_RUN_ID_MISMATCH" }
  if (-not $document.requestedAt) { throw "${Role}_SIGNAL_REQUESTED_AT_MISSING" }
  [DateTimeOffset]::Parse(
    [string]$document.requestedAt,
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.DateTimeStyles]::RoundtripKind
  ) | Out-Null
  if ($Role -eq 'BOUNDARY') {
    if (-not $document.clientCompletedAt) { throw 'BOUNDARY_SIGNAL_CLIENT_COMPLETED_AT_MISSING' }
    [DateTimeOffset]::Parse(
      [string]$document.clientCompletedAt,
      [Globalization.CultureInfo]::InvariantCulture,
      [Globalization.DateTimeStyles]::RoundtripKind
    ) | Out-Null
  }
  return $document
}

function Read-StartSignal {
  if ($script:startSignalDocument) { return $script:startSignalDocument }
  if (-not [System.IO.File]::Exists($StartSignal)) { return $null }
  try {
    $text = [System.IO.File]::ReadAllText($StartSignal)
  } catch [System.IO.IOException] {
    return $null
  } catch [System.UnauthorizedAccessException] {
    return $null
  }
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }

  try {
    $document = $text | ConvertFrom-Json
  } catch {
    throw 'START_SIGNAL_JSON_INVALID'
  }
  if ([string]$document.contract -ne 'agm-instrumentation-lifecycle-window-start.v1') { throw 'START_SIGNAL_CONTRACT_MISMATCH' }
  if ([string]$document.runId -ne $RunId -or [string]$document.windowId -ne $RunId) { throw 'START_SIGNAL_RUN_ID_MISMATCH' }
  if ($null -eq $document.startAtEpochMs -or $null -eq $document.durationSeconds) { throw 'START_SIGNAL_TIMING_MISSING' }
  $startAtEpochMs = [long]$document.startAtEpochMs
  $durationSeconds = [int]$document.durationSeconds
  if ($startAtEpochMs -le 0 -or $durationSeconds -ne $SampleIntervalSeconds) { throw 'START_SIGNAL_TIMING_MISMATCH' }

  $script:startSignalDocument = $document
  $script:startSignalStartAtEpochMs = $startAtEpochMs
  $script:startSignalDurationSeconds = $durationSeconds
  $script:startSignalWindowId = [string]$document.windowId
  return $document
}

function Publish-JsonAtomic {
  param(
    [Parameter(Mandatory = $true)]$Value,
    [Parameter(Mandatory = $true)][string]$Path,
    [int]$Depth = 10
  )

  if ([System.IO.File]::Exists($Path)) { throw "BOUNDARY_READY_TARGET_EXISTS_$Path" }
  $directory = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($Path))
  if ($directory) { [System.IO.Directory]::CreateDirectory($directory) | Out-Null }
  $temporaryPath = "$Path.publish-$PID-$([Guid]::NewGuid().ToString('N')).tmp"
  try {
    $json = $Value | ConvertTo-Json -Depth $Depth
    [System.IO.File]::WriteAllText($temporaryPath, "$json$([Environment]::NewLine)", [System.Text.UTF8Encoding]::new($false))
    [System.IO.File]::Move($temporaryPath, $Path)
  } finally {
    if ([System.IO.File]::Exists($temporaryPath)) { [System.IO.File]::Delete($temporaryPath) }
  }
}

function Wait-ForStartSignal {
  while ($true) {
    $fatalReason = Get-FatalLifecycleReason
    if ($fatalReason) { return [pscustomobject]@{ Status = $fatalReason; Signal = $null } }
    $earlyBoundary = Read-RunBoundSignal -Path $StopSignal -ExpectedContract 'agm-instrumentation-lifecycle-sampler-boundary.v1' -Role 'BOUNDARY'
    if ($earlyBoundary) { throw 'BOUNDARY_SIGNAL_BEFORE_FORMAL_BASELINE' }

    $signal = Read-StartSignal
    if ($signal -and [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $script:startSignalStartAtEpochMs) {
      return [pscustomobject]@{ Status = 'START_SIGNAL'; Signal = $signal }
    }
    [System.Threading.Thread]::Sleep(250)
  }
}

function Wait-ForBoundarySignal {
  while ($true) {
    $signal = Read-RunBoundSignal -Path $StopSignal -ExpectedContract 'agm-instrumentation-lifecycle-sampler-boundary.v1' -Role 'BOUNDARY'
    if ($signal) { return [pscustomobject]@{ Status = 'BOUNDARY_SIGNAL'; Signal = $signal } }
    $fatalReason = Get-FatalLifecycleReason
    if ($fatalReason) { return [pscustomobject]@{ Status = $fatalReason; Signal = $null } }
    [System.Threading.Thread]::Sleep(250)
  }
}

function Wait-ForReleaseSignal {
  while ($true) {
    $signal = Read-RunBoundSignal -Path $ReleaseSignal -ExpectedContract 'agm-instrumentation-lifecycle-sampler-release.v1' -Role 'RELEASE'
    if ($signal) { return [pscustomobject]@{ Status = 'RELEASE_SIGNAL'; Signal = $signal } }
    $fatalReason = Get-FatalLifecycleReason
    if ($fatalReason) { return [pscustomobject]@{ Status = $fatalReason; Signal = $null } }
    [System.Threading.Thread]::Sleep(250)
  }
}

function Get-ProcessCpuSnapshot {
  param(
    [Parameter(Mandatory = $true)][System.Collections.Generic.Dictionary[string, double]]$PreviousCpu,
    [Parameter(Mandatory = $true)][DateTimeOffset]$PreviousCaptureStartedAt,
    [bool]$BuildTop = $true
  )

  $captureStartedAt = [DateTimeOffset]::UtcNow
  $captureTimer = [Diagnostics.Stopwatch]::StartNew()
  $processes = [System.Diagnostics.Process]::GetProcesses()
  $currentCpu = [System.Collections.Generic.Dictionary[string, double]]::new($processes.Length)
  $topPids = [int[]]::new($topLimit)
  $topNames = [string[]]::new($topLimit)
  $topStartTimes = [string[]]::new($topLimit)
  $topCpuDeltas = [double[]]::new($topLimit)
  $topCount = 0
  $wallSeconds = [Math]::Max(0.001, ($captureStartedAt - $PreviousCaptureStartedAt).TotalSeconds)

  foreach ($process in $processes) {
    try {
      $pidValue = [int]$process.Id
      $startTimeUtc = $process.StartTime.ToUniversalTime()
      $identityKey = "$pidValue`:$($startTimeUtc.Ticks)"
      $cpuValue = [double]$process.TotalProcessorTime.TotalSeconds
      $currentCpu[$identityKey] = $cpuValue

      if ($BuildTop) {
        $previousCpuValue = 0.0
        if ($PreviousCpu.TryGetValue($identityKey, [ref]$previousCpuValue)) {
          $cpuDelta = $cpuValue - $previousCpuValue
          if ($cpuDelta -gt 0) {
            $insertAt = $topCount
            for ($index = 0; $index -lt $topCount; $index += 1) {
              if ($cpuDelta -gt $topCpuDeltas[$index]) {
                $insertAt = $index
                break
              }
            }

            if ($insertAt -lt $topLimit) {
              $processName = [string]$process.ProcessName
              $lastIndex = [Math]::Min($topCount, $topLimit - 1)
              for ($index = $lastIndex; $index -gt $insertAt; $index -= 1) {
                $topPids[$index] = $topPids[$index - 1]
                $topNames[$index] = $topNames[$index - 1]
                $topStartTimes[$index] = $topStartTimes[$index - 1]
                $topCpuDeltas[$index] = $topCpuDeltas[$index - 1]
              }
              $topPids[$insertAt] = $pidValue
              $topNames[$insertAt] = $processName
              $topStartTimes[$insertAt] = $startTimeUtc.ToString('o')
              $topCpuDeltas[$insertAt] = $cpuDelta
              if ($topCount -lt $topLimit) { $topCount += 1 }
            }
          }
        }
      }
    } catch {
      # A process can exit between enumeration and property access.
    } finally {
      $process.Dispose()
    }
  }

  $captureCompletedAt = [DateTimeOffset]::UtcNow
  $captureTimer.Stop()
  $top = [System.Collections.Generic.List[object]]::new($topCount)
  for ($index = 0; $index -lt $topCount; $index += 1) {
    $top.Add([ordered]@{
      pid = $topPids[$index]
      processName = $topNames[$index]
      processStartTimeUtc = $topStartTimes[$index]
      cpuPercentOfOneCore = [Math]::Round(($topCpuDeltas[$index] / $wallSeconds) * 100, 3)
    })
  }

  return [pscustomobject]@{
    Cpu = $currentCpu
    CaptureStartedAt = $captureStartedAt
    CaptureCompletedAt = $captureCompletedAt
    CaptureDurationMs = [Math]::Round($captureTimer.Elapsed.TotalMilliseconds, 3)
    WallSeconds = [Math]::Round($wallSeconds, 3)
    Top = $top
  }
}

function Write-ProcessSample {
  param(
    [Parameter(Mandatory = $true)][string]$SampleKind,
    [Parameter(Mandatory = $true)]$Snapshot,
    [Parameter(Mandatory = $true)][DateTimeOffset]$WindowStartedAt,
    [AllowNull()]$ScheduledAt,
    [AllowNull()]$CadenceSeconds
  )

  $sequenceValue = $script:sequence + 1
  $script:sequence = $sequenceValue
  $captureStartedAtText = $Snapshot.CaptureStartedAt.ToString('o')
  $captureCompletedAtText = $Snapshot.CaptureCompletedAt.ToString('o')
  if ($null -eq $script:firstSampleAt) { $script:firstSampleAt = $captureStartedAtText }
  $script:lastSampleAt = $captureCompletedAtText

  $record = [ordered]@{
    contract = 'agm-real-basic-process-sample.v1'
    runId = $RunId
    samplerPid = $PID
    sequence = $sequenceValue
    sampleKind = $SampleKind
    scheduledAt = Convert-ScheduledAtEvidenceValue $ScheduledAt
    windowStartedAt = $WindowStartedAt.ToString('o')
    captureStartedAt = $captureStartedAtText
    captureCompletedAt = $captureCompletedAtText
    captureDurationMs = $Snapshot.CaptureDurationMs
    wallSeconds = $Snapshot.WallSeconds
    cadenceSeconds = Convert-CadenceSecondsEvidenceValue $CadenceSeconds
    snapshotSemantics = 'NON_ATOMIC_PROCESS_ENUMERATION_START_TO_START_DENOMINATOR'
    topCpuProcesses = $Snapshot.Top
  }
  $writer.WriteLine(($record | ConvertTo-Json -Depth 5 -Compress))
  return [pscustomobject]$record
}

$outputDirectory = [System.IO.Path]::GetDirectoryName($Output)
if ($outputDirectory) { [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null }
$lifecycleDirectory = [System.IO.Path]::GetDirectoryName($LifecycleOutput)
if ($lifecycleDirectory) { [System.IO.Directory]::CreateDirectory($lifecycleDirectory) | Out-Null }
$boundaryDirectory = [System.IO.Path]::GetDirectoryName($BoundaryReadyOutput)
if ($boundaryDirectory) { [System.IO.Directory]::CreateDirectory($boundaryDirectory) | Out-Null }

try {
  $apiProcess = Open-ExpectedProcess -ProcessId $ApiPid -ExpectedStartTimeUtc $ApiStartTimeUtc -Role 'API'
  $parentProcess = Open-ExpectedProcess -ProcessId $ParentPid -ExpectedStartTimeUtc $ParentStartTimeUtc -Role 'PARENT'

  $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
  $fileStream = [System.IO.FileStream]::new(
    $Output,
    [System.IO.FileMode]::CreateNew,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::Read
  )
  $writer = [System.IO.StreamWriter]::new($fileStream, $utf8WithoutBom)
  $writer.AutoFlush = $true
  $stopReason = 'RUNNING'

  $emptyCpu = [System.Collections.Generic.Dictionary[string, double]]::new()
  $readinessWindowStartedAt = [DateTimeOffset]::UtcNow
  $readinessSnapshot = Get-ProcessCpuSnapshot -PreviousCpu $emptyCpu -PreviousCaptureStartedAt $readinessWindowStartedAt -BuildTop $false
  Write-ProcessSample -SampleKind 'READINESS_BASELINE' -Snapshot $readinessSnapshot -WindowStartedAt $readinessWindowStartedAt -ScheduledAt $null -CadenceSeconds $null | Out-Null

  $startResult = Wait-ForStartSignal
  if ($startResult.Status -ne 'START_SIGNAL') {
    $stopReason = $startResult.Status
  } else {
    $startSignalObservedAt = [DateTimeOffset]::UtcNow
    $formalScheduledAt = [DateTimeOffset]::FromUnixTimeMilliseconds($startSignalStartAtEpochMs)
    $formalBaselineSnapshot = Get-ProcessCpuSnapshot -PreviousCpu $readinessSnapshot.Cpu -PreviousCaptureStartedAt $readinessSnapshot.CaptureStartedAt -BuildTop $false
    $measurementBaselineAt = $formalBaselineSnapshot.CaptureStartedAt
    $measurementBaselineCompletedAt = $formalBaselineSnapshot.CaptureCompletedAt
    $formalBaselineRecord = Write-ProcessSample -SampleKind 'FORMAL_BASELINE' -Snapshot $formalBaselineSnapshot -WindowStartedAt $measurementBaselineAt -ScheduledAt $formalScheduledAt -CadenceSeconds $null

    $boundaryResult = Wait-ForBoundarySignal
    if ($boundaryResult.Status -ne 'BOUNDARY_SIGNAL') {
      $stopReason = $boundaryResult.Status
    } else {
      $boundarySignal = $boundaryResult.Signal
      $boundaryObservedAt = [DateTimeOffset]::UtcNow
      $boundaryScheduledAt = [DateTimeOffset]::Parse(
        [string]$boundarySignal.clientCompletedAt,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::RoundtripKind
      )
      if ($boundaryScheduledAt -lt $formalScheduledAt) { throw 'BOUNDARY_SIGNAL_PRECEDES_FORMAL_WINDOW' }

      $finalSnapshot = Get-ProcessCpuSnapshot -PreviousCpu $formalBaselineSnapshot.Cpu -PreviousCaptureStartedAt $measurementBaselineAt -BuildTop $true
      $measurementFinalAt = $finalSnapshot.CaptureStartedAt
      $measurementFinalCompletedAt = $finalSnapshot.CaptureCompletedAt
      $measurementCadenceSeconds = ($measurementFinalAt - $measurementBaselineAt).TotalSeconds
      $measurementFinalRecord = Write-ProcessSample -SampleKind 'MEASUREMENT_FINAL' -Snapshot $finalSnapshot -WindowStartedAt $measurementBaselineAt -ScheduledAt $boundaryScheduledAt -CadenceSeconds $measurementCadenceSeconds

      $boundaryReadyAt = [DateTimeOffset]::UtcNow
      Publish-JsonAtomic -Value ([ordered]@{
        contract = 'agm-real-basic-sampler-boundary-ready.v1'
        role = 'PROCESS'
        runId = $RunId
        samplerPid = $PID
        samplerStartTimeUtc = $samplerStartTimeUtc
        boundary = [ordered]@{
          contract = [string]$boundarySignal.contract
          requestedAt = [string]$boundarySignal.requestedAt
          clientCompletedAt = [string]$boundarySignal.clientCompletedAt
          observedAt = $boundaryObservedAt.ToString('o')
        }
        readyAt = $boundaryReadyAt.ToString('o')
        periodicSamplingStopped = $true
        quiescentUntilRelease = $true
        measurement = [ordered]@{
          expectedDurationSeconds = $startSignalDurationSeconds
          baseline = [ordered]@{
            sequence = $formalBaselineRecord.sequence
            sampleKind = $formalBaselineRecord.sampleKind
            scheduledAt = $formalBaselineRecord.scheduledAt
            captureStartedAt = $formalBaselineRecord.captureStartedAt
            captureCompletedAt = $formalBaselineRecord.captureCompletedAt
            captureDurationMs = $formalBaselineRecord.captureDurationMs
          }
          final = [ordered]@{
            sequence = $measurementFinalRecord.sequence
            sampleKind = $measurementFinalRecord.sampleKind
            scheduledAt = $measurementFinalRecord.scheduledAt
            captureStartedAt = $measurementFinalRecord.captureStartedAt
            captureCompletedAt = $measurementFinalRecord.captureCompletedAt
            captureDurationMs = $measurementFinalRecord.captureDurationMs
          }
          cadenceSeconds = [Math]::Round($measurementCadenceSeconds, 3)
          cadenceDeviationSeconds = [Math]::Round($measurementCadenceSeconds - $startSignalDurationSeconds, 3)
          snapshotSemantics = 'NON_ATOMIC_PROCESS_ENUMERATION_START_TO_START_DENOMINATOR'
        }
      }) -Path $BoundaryReadyOutput

      $releaseResult = Wait-ForReleaseSignal
      if ($releaseResult.Status -eq 'RELEASE_SIGNAL') {
        $releaseSignalDocument = $releaseResult.Signal
        $releaseObservedAt = [DateTimeOffset]::UtcNow
        $stopReason = 'STOP_SIGNAL'
        $exitCode = 0
      } else {
        $stopReason = $releaseResult.Status
      }
    }
  }

  if ($exitCode -ne 0) {
    if ($stopReason -eq 'API_EXITED') { $exitCode = 2 }
    elseif ($stopReason -eq 'PARENT_EXITED') { $exitCode = 3 }
    elseif ($stopReason -eq 'DEADLINE') { $exitCode = 4 }
    else { $exitCode = 5 }
  }
} catch {
  $stopReason = 'ERROR'
  $exitCode = 1
  $errorRecord = [ordered]@{
    type = $_.Exception.GetType().FullName
    message = $_.Exception.Message
  }
} finally {
  if ($writer) { $writer.Dispose() }
  if ($apiProcess) { $apiProcess.Dispose() }
  if ($parentProcess) { $parentProcess.Dispose() }

  $lifecycle = [ordered]@{
    contract = 'agm-real-basic-sampler-lifecycle.v1'
    role = 'PROCESS'
    runId = $RunId
    samplerPid = $PID
    samplerStartTimeUtc = $samplerStartTimeUtc
    parentPid = $ParentPid
    parentStartTimeUtc = $ParentStartTimeUtc
    apiPid = $ApiPid
    apiStartTimeUtc = $ApiStartTimeUtc
    startedAt = $startedAt.ToString('o')
    deadlineAt = $deadline.ToString('o')
    completedAt = [DateTimeOffset]::UtcNow.ToString('o')
    sampleIntervalSeconds = $SampleIntervalSeconds
    cadenceModel = 'BOUNDARY_TRIGGERED_CAPTURE_START_TO_START'
    samplesWritten = $sequence
    firstSampleAt = $firstSampleAt
    lastSampleAt = $lastSampleAt
    startSignalRequired = $true
    startSignalObservedAt = if ($startSignalObservedAt) { $startSignalObservedAt.ToString('o') } else { $null }
    startSignalStartAtEpochMs = $startSignalStartAtEpochMs
    startSignalDurationSeconds = $startSignalDurationSeconds
    startSignalWindowId = $startSignalWindowId
    measurementBaselineAt = if ($measurementBaselineAt) { $measurementBaselineAt.ToString('o') } else { $null }
    measurementBaselineCompletedAt = if ($measurementBaselineCompletedAt) { $measurementBaselineCompletedAt.ToString('o') } else { $null }
    measurementFinalAt = if ($measurementFinalAt) { $measurementFinalAt.ToString('o') } else { $null }
    measurementFinalCompletedAt = if ($measurementFinalCompletedAt) { $measurementFinalCompletedAt.ToString('o') } else { $null }
    measurementCadenceSeconds = if ($null -ne $measurementCadenceSeconds) { [Math]::Round($measurementCadenceSeconds, 3) } else { $null }
    boundarySignalRequired = $true
    boundaryRequestedAt = if ($boundarySignal) { [string]$boundarySignal.requestedAt } else { $null }
    boundaryClientCompletedAt = if ($boundarySignal) { [string]$boundarySignal.clientCompletedAt } else { $null }
    boundaryObservedAt = if ($boundaryObservedAt) { $boundaryObservedAt.ToString('o') } else { $null }
    boundaryReadyAt = if ($boundaryReadyAt) { $boundaryReadyAt.ToString('o') } else { $null }
    boundaryReadyOutput = $BoundaryReadyOutput
    boundaryFinalSequence = if ($measurementFinalRecord) { $measurementFinalRecord.sequence } else { $null }
    releaseSignalRequired = $true
    releaseRequestedAt = if ($releaseSignalDocument) { [string]$releaseSignalDocument.requestedAt } else { $null }
    releaseObservedAt = if ($releaseObservedAt) { $releaseObservedAt.ToString('o') } else { $null }
    stopReason = $stopReason
    graceful = ($stopReason -eq 'STOP_SIGNAL' -and $null -ne $boundaryReadyAt -and $null -ne $releaseObservedAt)
    exitCode = $exitCode
    error = $errorRecord
  }
  $lifecycleJson = $lifecycle | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText($LifecycleOutput, $lifecycleJson, [System.Text.UTF8Encoding]::new($false))
}

exit $exitCode
