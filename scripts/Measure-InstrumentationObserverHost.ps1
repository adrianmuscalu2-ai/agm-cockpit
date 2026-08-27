param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('BEFORE', 'AFTER')]
  [string]$Phase,
  [Parameter(Mandatory = $true)][string]$Output,
  [int]$TargetPowerShellPid = 4068,
  [ValidateRange(10, 120)][int]$DurationSeconds = 20,
  [ValidateRange(1, 30)][int]$SampleIntervalSeconds = 2
)

$ErrorActionPreference = 'Stop'
$logicalCpuCount = [Environment]::ProcessorCount
$sampleCount = [Math]::Max(2, [Math]::Ceiling($DurationSeconds / $SampleIntervalSeconds))
$trackedNames = @('powershell', 'dwm', 'vmmem', 'vmmemWSL', 'com.docker.backend', 'OneDrive')
$counterNames = @(
  '\Processor(_Total)\% Processor Time',
  '\System\Processor Queue Length',
  '\System\Context Switches/sec',
  '\Memory\% Committed Bytes In Use',
  '\Memory\Available MBytes'
)

function Get-TrackedProcessSnapshot {
  $rows = [System.Collections.Generic.List[object]]::new()
  foreach ($name in $trackedNames) {
    foreach ($process in [System.Diagnostics.Process]::GetProcessesByName($name)) {
      try {
        $rows.Add([pscustomobject]@{
          pid = [int]$process.Id
          processName = [string]$process.ProcessName
          cpuSeconds = [double]$process.TotalProcessorTime.TotalSeconds
          workingSetBytes = [long]$process.WorkingSet64
        })
      } catch {
        # A process can exit between enumeration and property access.
      } finally {
        $process.Dispose()
      }
    }
  }
  return @($rows)
}

function Get-CounterValue {
  param([Parameter(Mandatory = $true)]$CounterSet, [Parameter(Mandatory = $true)][string]$Pattern)
  $values = @($CounterSet | Where-Object { $_.Path -like $Pattern } | ForEach-Object { [double]$_.CookedValue })
  if ($values.Count -eq 0) { return $null }
  return [Math]::Round(($values | Measure-Object -Sum).Sum, 3)
}

function Get-Percentile {
  param([double[]]$Values, [double]$Percentile)
  if ($Values.Count -eq 0) { return $null }
  $ordered = @($Values | Sort-Object)
  $index = [Math]::Max(0, [Math]::Ceiling($Percentile * $ordered.Count) - 1)
  return [Math]::Round($ordered[$index], 3)
}

$startedAt = [DateTimeOffset]::UtcNow
$processBefore = @(Get-TrackedProcessSnapshot)
$counterSets = @(Get-Counter -Counter $counterNames -SampleInterval $SampleIntervalSeconds -MaxSamples $sampleCount)
$completedAt = [DateTimeOffset]::UtcNow
$processAfter = @(Get-TrackedProcessSnapshot)
$elapsedSeconds = [Math]::Max(0.001, ($completedAt - $startedAt).TotalSeconds)

$counterSamples = @($counterSets | ForEach-Object {
  [ordered]@{
    capturedAt = $_.Timestamp.ToUniversalTime().ToString('o')
    cpuTotalPercent = Get-CounterValue $_.CounterSamples '*processor(_total)*'
    processorQueue = Get-CounterValue $_.CounterSamples '*system*processor queue length'
    contextSwitchesPerSec = Get-CounterValue $_.CounterSamples '*system*context switches/sec'
    committedMemoryPercent = Get-CounterValue $_.CounterSamples '*memory*% committed bytes in use'
    availableMemoryMB = Get-CounterValue $_.CounterSamples '*memory*available mbytes'
  }
})

$processDeltas = [System.Collections.Generic.List[object]]::new()
foreach ($before in $processBefore) {
  $after = $processAfter | Where-Object { $_.pid -eq $before.pid } | Select-Object -First 1
  if (-not $after) { continue }
  $deltaSeconds = [Math]::Max(0, [double]$after.cpuSeconds - [double]$before.cpuSeconds)
  $oneCorePercent = ($deltaSeconds / $elapsedSeconds) * 100
  $processDeltas.Add([ordered]@{
    pid = $before.pid
    processName = $before.processName
    cpuDeltaSeconds = [Math]::Round($deltaSeconds, 6)
    cpuPercentOfOneCore = [Math]::Round($oneCorePercent, 3)
    cpuPercentOfHost = [Math]::Round($oneCorePercent / $logicalCpuCount, 3)
    workingSetBeforeMB = [Math]::Round($before.workingSetBytes / 1MB, 2)
    workingSetAfterMB = [Math]::Round($after.workingSetBytes / 1MB, 2)
  })
}

$groupedProcesses = [ordered]@{}
foreach ($name in $trackedNames) {
  $matching = @($processDeltas | Where-Object { $_.processName -ieq $name })
  $oneCoreSum = 0.0
  $hostSum = 0.0
  foreach ($item in $matching) {
    $oneCoreSum += [double]$item.cpuPercentOfOneCore
    $hostSum += [double]$item.cpuPercentOfHost
  }
  $groupedProcesses[$name] = [ordered]@{
    processes = $matching.Count
    cpuPercentOfOneCore = [Math]::Round($oneCoreSum, 3)
    cpuPercentOfHost = [Math]::Round($hostSum, 3)
  }
}

$target = $processDeltas | Where-Object { $_.pid -eq $TargetPowerShellPid } | Select-Object -First 1
$cpuValues = @($counterSamples | Where-Object { $null -ne $_.cpuTotalPercent } | ForEach-Object { [double]$_.cpuTotalPercent })
$queueValues = @($counterSamples | Where-Object { $null -ne $_.processorQueue } | ForEach-Object { [double]$_.processorQueue })
$memoryValues = @($counterSamples | Where-Object { $null -ne $_.committedMemoryPercent } | ForEach-Object { [double]$_.committedMemoryPercent })

$report = [ordered]@{
  contract = 'agm-instrumentation-observer-host-measurement.v1'
  phase = $Phase
  generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
  startedAt = $startedAt.ToString('o')
  completedAt = $completedAt.ToString('o')
  elapsedSeconds = [Math]::Round($elapsedSeconds, 3)
  sampling = [ordered]@{
    requestedDurationSeconds = $DurationSeconds
    intervalSeconds = $SampleIntervalSeconds
    requestedSamples = $sampleCount
    capturedSamples = $counterSamples.Count
    noGlobalProcessEnumeration = $true
    trackedNames = $trackedNames
  }
  host = [ordered]@{
    logicalCpuCount = $logicalCpuCount
    cpuTotalPercent = [ordered]@{ p50 = Get-Percentile $cpuValues 0.5; p95 = Get-Percentile $cpuValues 0.95; max = Get-Percentile $cpuValues 1.0 }
    processorQueue = [ordered]@{ p50 = Get-Percentile $queueValues 0.5; p95 = Get-Percentile $queueValues 0.95; max = Get-Percentile $queueValues 1.0 }
    committedMemoryPercent = [ordered]@{ p50 = Get-Percentile $memoryValues 0.5; p95 = Get-Percentile $memoryValues 0.95; max = Get-Percentile $memoryValues 1.0 }
  }
  targetPowerShell = if ($target) { $target } else { [ordered]@{ pid = $TargetPowerShellPid; status = 'NOT_RUNNING_OR_EXITED_DURING_WINDOW' } }
  processGroups = $groupedProcesses
  processDeltas = @($processDeltas)
  counterSamples = $counterSamples
  p9 = 'STOPPED'
  officialSoakRestarted = $false
  officialBasicSloMs = 3000
  officialBasicSloUnchanged = $true
  externalWrites = 0
  observer = [ordered]@{
    measurementPowerShellPid = $PID
    measurementProcessIncludedInPowerShellAggregate = $true
    causalUse = 'COMPARISON_CONTEXT_ONLY'
  }
}

$directory = Split-Path -Parent $Output
if ($directory) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $Output -Encoding utf8
Write-Output "OBSERVER HOST MEASUREMENT - $Phase / $Output"
