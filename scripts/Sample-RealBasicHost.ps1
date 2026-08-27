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
  [ValidateRange(1, 60)][int]$SampleIntervalSeconds = 5,
  [ValidateRange(1, 1440)][int]$MaxRuntimeMinutes = 120
)

$ErrorActionPreference = 'Stop'
$startedAt = [DateTimeOffset]::UtcNow
$deadline = $startedAt.AddMinutes($MaxRuntimeMinutes)
$samplerStartTimeUtc = (Get-Process -Id $PID -ErrorAction Stop).StartTime.ToUniversalTime().ToString('o')
$sequence = 0
$firstSampleAt = $null
$lastSampleAt = $null
$stopReason = 'STARTING'
$exitCode = 1
$errorRecord = $null
$writer = $null
$apiProcess = $null
$parentProcess = $null
$boundarySignal = $null
$boundaryObservedAt = $null
$boundaryReadyAt = $null
$releaseSignalDocument = $null
$releaseObservedAt = $null
$boundaryFinalRecord = $null
$missedSlotsTotal = 0

$counterPaths = @(
  '\Processor(_Total)\% Processor Time',
  '\System\Processor Queue Length',
  '\System\Context Switches/sec',
  '\Memory\Available MBytes',
  '\Memory\Pages/sec',
  '\PhysicalDisk(_Total)\Avg. Disk Queue Length',
  '\PhysicalDisk(_Total)\Disk Bytes/sec',
  '\Network Interface(*)\Bytes Total/sec'
)

$monotonicFrequency = [double][Diagnostics.Stopwatch]::Frequency
$scheduleOriginTicks = [Diagnostics.Stopwatch]::GetTimestamp()
$scheduleOriginUtc = [DateTimeOffset]::UtcNow
$sampleIntervalTicks = [long][Math]::Round($SampleIntervalSeconds * $monotonicFrequency)

function Get-CounterSum {
  param(
    [Parameter(Mandatory = $true)]$Samples,
    [Parameter(Mandatory = $true)][string]$Pattern
  )

  $values = @($Samples | Where-Object { $_.Path -like $Pattern } | ForEach-Object { $_.CookedValue })
  if ($values.Count -eq 0) { return $null }
  return ($values | Measure-Object -Sum).Sum
}

function Convert-Rounded {
  param($Value, [int]$Digits = 3)
  if ($null -eq $Value) { return $null }
  return [math]::Round([double]$Value, $Digits)
}

function Convert-ExpectedStartTime {
  param([Parameter(Mandatory = $true)][string]$Value)
  return [DateTimeOffset]::Parse(
    $Value,
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.DateTimeStyles]::RoundtripKind
  ).UtcDateTime
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

function Convert-MonotonicTicksToUtc {
  param([Parameter(Mandatory = $true)][long]$Ticks)
  $elapsedSeconds = ($Ticks - $scheduleOriginTicks) / $monotonicFrequency
  return $scheduleOriginUtc.AddSeconds($elapsedSeconds)
}

function Wait-UntilMonotonicDue {
  param([Parameter(Mandatory = $true)][long]$DueTicks)

  while ($true) {
    $fatalReason = Get-FatalLifecycleReason
    if ($fatalReason) { return [pscustomobject]@{ Status = $fatalReason; Signal = $null } }
    $signal = Read-RunBoundSignal -Path $StopSignal -ExpectedContract 'agm-instrumentation-lifecycle-sampler-boundary.v1' -Role 'BOUNDARY'
    if ($signal) { return [pscustomobject]@{ Status = 'BOUNDARY_SIGNAL'; Signal = $signal } }

    $remainingTicks = $DueTicks - [Diagnostics.Stopwatch]::GetTimestamp()
    if ($remainingTicks -le 0) { return [pscustomobject]@{ Status = 'DUE'; Signal = $null } }
    $remainingMs = [Math]::Max(1, [Math]::Ceiling(($remainingTicks / $monotonicFrequency) * 1000))
    [System.Threading.Thread]::Sleep([Math]::Min(500, $remainingMs))
  }
}

function Wait-ForReleaseSignal {
  while ($true) {
    $fatalReason = Get-FatalLifecycleReason
    if ($fatalReason) { return [pscustomobject]@{ Status = $fatalReason; Signal = $null } }
    $signal = Read-RunBoundSignal -Path $ReleaseSignal -ExpectedContract 'agm-instrumentation-lifecycle-sampler-release.v1' -Role 'RELEASE'
    if ($signal) { return [pscustomobject]@{ Status = 'RELEASE_SIGNAL'; Signal = $signal } }
    [System.Threading.Thread]::Sleep(250)
  }
}

function Write-HostSample {
  param(
    [Parameter(Mandatory = $true)][string]$SampleKind,
    [Parameter(Mandatory = $true)][DateTimeOffset]$ScheduledAt,
    [Parameter(Mandatory = $true)][int]$MissedSlots
  )

  $captureStartedAt = [DateTimeOffset]::UtcNow
  $captureTimer = [Diagnostics.Stopwatch]::StartNew()
  $counterSet = Get-Counter -Counter $counterPaths -MaxSamples 1 -ErrorAction Stop
  $samples = $counterSet.CounterSamples

  $apiSnapshot = $null
  try {
    $apiProcess.Refresh()
    if (-not $apiProcess.HasExited) {
      $apiSnapshot = [ordered]@{
        pid = $ApiPid
        cpuSec = Convert-Rounded $apiProcess.TotalProcessorTime.TotalSeconds 6
        workingSetMB = Convert-Rounded ($apiProcess.WorkingSet64 / 1MB) 2
        privateMB = Convert-Rounded ($apiProcess.PrivateMemorySize64 / 1MB) 2
        responding = $apiProcess.Responding
      }
    }
  } catch {
    $apiSnapshot = $null
  }

  $captureTimer.Stop()
  $captureCompletedAt = [DateTimeOffset]::UtcNow
  $sequenceValue = $script:sequence + 1
  $script:sequence = $sequenceValue
  $counterTimestamp = $counterSet.Timestamp.ToUniversalTime().ToString('o')
  if ($null -eq $script:firstSampleAt) { $script:firstSampleAt = $captureStartedAt.ToString('o') }
  $script:lastSampleAt = $captureCompletedAt.ToString('o')

  $record = [ordered]@{
    contract = 'agm-real-basic-host-sample.v1'
    runId = $RunId
    samplerPid = $PID
    sequence = $sequenceValue
    sampleKind = $SampleKind
    scheduledAt = $ScheduledAt.ToString('o')
    captureStartedAt = $captureStartedAt.ToString('o')
    captureCompletedAt = $captureCompletedAt.ToString('o')
    captureAt = $counterTimestamp
    scheduleLatenessMs = [Math]::Round(($captureStartedAt - $ScheduledAt).TotalMilliseconds, 3)
    captureDurationMs = [Math]::Round($captureTimer.Elapsed.TotalMilliseconds, 3)
    missedSlots = $MissedSlots
    cpuPercent = Convert-Rounded (Get-CounterSum $samples '*processor(_total)*') 2
    processorQueue = Convert-Rounded (Get-CounterSum $samples '*system*processor queue length') 2
    contextSwitchesPerSec = Convert-Rounded (Get-CounterSum $samples '*system*context switches/sec') 2
    availableMemoryMB = Convert-Rounded (Get-CounterSum $samples '*memory*available mbytes') 2
    pagesPerSec = Convert-Rounded (Get-CounterSum $samples '*memory*pages/sec') 2
    diskQueue = Convert-Rounded (Get-CounterSum $samples '*physicaldisk(_total)*avg. disk queue length') 4
    diskBytesPerSec = Convert-Rounded (Get-CounterSum $samples '*physicaldisk(_total)*disk bytes/sec') 2
    networkBytesPerSec = Convert-Rounded (Get-CounterSum $samples '*network interface*bytes total/sec') 2
    api = $apiSnapshot
  }
  $writer.WriteLine(($record | ConvertTo-Json -Depth 6 -Compress))
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

  $nextDueTicks = $scheduleOriginTicks
  $missedSlotsBeforeSample = 0
  while ($true) {
    $waitResult = Wait-UntilMonotonicDue -DueTicks $nextDueTicks
    if ($waitResult.Status -eq 'BOUNDARY_SIGNAL') {
      $boundarySignal = $waitResult.Signal
      $boundaryObservedAt = [DateTimeOffset]::UtcNow
      break
    }
    if ($waitResult.Status -ne 'DUE') {
      $stopReason = $waitResult.Status
      break
    }

    $scheduledAt = Convert-MonotonicTicksToUtc -Ticks $nextDueTicks
    Write-HostSample -SampleKind 'PERIODIC' -ScheduledAt $scheduledAt -MissedSlots $missedSlotsBeforeSample | Out-Null

    $nextDueTicks += $sampleIntervalTicks
    $missedSlotsBeforeSample = 0
    $nowTicks = [Diagnostics.Stopwatch]::GetTimestamp()
    while ($nextDueTicks -le $nowTicks) {
      $nextDueTicks += $sampleIntervalTicks
      $missedSlotsBeforeSample += 1
      $missedSlotsTotal += 1
    }
  }

  if ($boundarySignal) {
    $boundaryScheduledAt = [DateTimeOffset]::Parse(
      [string]$boundarySignal.clientCompletedAt,
      [Globalization.CultureInfo]::InvariantCulture,
      [Globalization.DateTimeStyles]::RoundtripKind
    )
    $boundaryFinalRecord = Write-HostSample -SampleKind 'BOUNDARY_FINAL' -ScheduledAt $boundaryScheduledAt -MissedSlots 0
    $boundaryReadyAt = [DateTimeOffset]::UtcNow
    Publish-JsonAtomic -Value ([ordered]@{
      contract = 'agm-real-basic-sampler-boundary-ready.v1'
      role = 'HOST'
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
      finalSample = [ordered]@{
        sequence = $boundaryFinalRecord.sequence
        sampleKind = $boundaryFinalRecord.sampleKind
        scheduledAt = $boundaryFinalRecord.scheduledAt
        captureStartedAt = $boundaryFinalRecord.captureStartedAt
        captureCompletedAt = $boundaryFinalRecord.captureCompletedAt
        captureDurationMs = $boundaryFinalRecord.captureDurationMs
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
    role = 'HOST'
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
    cadenceModel = 'ABSOLUTE_MONOTONIC_NO_CATCH_UP_BURST'
    samplesWritten = $sequence
    firstSampleAt = $firstSampleAt
    lastSampleAt = $lastSampleAt
    missedSlotsTotal = $missedSlotsTotal
    boundarySignalRequired = $true
    boundaryRequestedAt = if ($boundarySignal) { [string]$boundarySignal.requestedAt } else { $null }
    boundaryClientCompletedAt = if ($boundarySignal) { [string]$boundarySignal.clientCompletedAt } else { $null }
    boundaryObservedAt = if ($boundaryObservedAt) { $boundaryObservedAt.ToString('o') } else { $null }
    boundaryReadyAt = if ($boundaryReadyAt) { $boundaryReadyAt.ToString('o') } else { $null }
    boundaryReadyOutput = $BoundaryReadyOutput
    boundaryFinalSequence = if ($boundaryFinalRecord) { $boundaryFinalRecord.sequence } else { $null }
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
