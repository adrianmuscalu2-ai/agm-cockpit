param(
  [Parameter(Mandatory = $true)][int]$ApiPid,
  [Parameter(Mandatory = $true)][string]$Output,
  [string]$StopSignal = '',
  [int]$ParentPid = 0,
  [ValidateRange(2, 60)][int]$SampleIntervalSeconds = 5,
  [ValidateRange(1, 1440)][int]$MaxRuntimeMinutes = 120,
  [ValidateRange(1, 120)][int]$ProcessSnapshotEverySamples = 30
)

$ErrorActionPreference = 'Stop'
$deadline = [DateTimeOffset]::UtcNow.AddMinutes($MaxRuntimeMinutes)
$sequence = 0
$counters = @(
  '\Processor(_Total)\% Processor Time',
  '\System\Processor Queue Length',
  '\System\Context Switches/sec',
  '\Memory\Available MBytes',
  '\Memory\Pages/sec',
  '\PhysicalDisk(_Total)\Avg. Disk Queue Length',
  '\PhysicalDisk(_Total)\Disk Bytes/sec',
  '\Network Interface(*)\Bytes Total/sec'
)

function Get-CounterSum {
  param($Samples, [string]$Pattern)
  $values = @($Samples | Where-Object { $_.Path -like $Pattern } | ForEach-Object { $_.CookedValue })
  if ($values.Count -eq 0) { return $null }
  return ($values | Measure-Object -Sum).Sum
}

function Convert-Rounded {
  param($Value, [int]$Digits = 3)
  if ($null -eq $Value) { return $null }
  return [Math]::Round([double]$Value, $Digits)
}

function Get-TopProcesses {
  # Preserve the existing cumulative-CPU top-eight contract without the
  # PowerShell pipeline and global Sort-Object observer cost.
  $limit = 8
  $topPids = [int[]]::new($limit)
  $topNames = [string[]]::new($limit)
  $topCpu = [double[]]::new($limit)
  $topWorkingSet = [long[]]::new($limit)
  $topCount = 0
  foreach ($process in [System.Diagnostics.Process]::GetProcesses()) {
    try {
      $cpu = [double]$process.TotalProcessorTime.TotalSeconds
      $insertAt = $topCount
      for ($index = 0; $index -lt $topCount; $index += 1) {
        if ($cpu -gt $topCpu[$index]) { $insertAt = $index; break }
      }
      if ($insertAt -lt $limit) {
        $pidValue = [int]$process.Id
        $name = [string]$process.ProcessName
        $workingSet = [long]$process.WorkingSet64
        $lastIndex = [Math]::Min($topCount, $limit - 1)
        for ($index = $lastIndex; $index -gt $insertAt; $index -= 1) {
          $topPids[$index] = $topPids[$index - 1]
          $topNames[$index] = $topNames[$index - 1]
          $topCpu[$index] = $topCpu[$index - 1]
          $topWorkingSet[$index] = $topWorkingSet[$index - 1]
        }
        $topPids[$insertAt] = $pidValue
        $topNames[$insertAt] = $name
        $topCpu[$insertAt] = $cpu
        $topWorkingSet[$insertAt] = $workingSet
        if ($topCount -lt $limit) { $topCount += 1 }
      }
    } catch {
      # Expected race when a process exits during the bounded snapshot.
    } finally {
      $process.Dispose()
    }
  }
  $result = [System.Collections.Generic.List[object]]::new($topCount)
  for ($index = 0; $index -lt $topCount; $index += 1) {
    $result.Add([ordered]@{ Id = $topPids[$index]; ProcessName = $topNames[$index]; CPU = $topCpu[$index]; WorkingSet64 = $topWorkingSet[$index] })
  }
  return @($result)
}

$outputDirectory = Split-Path -Parent $Output
if ($outputDirectory) { New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null }
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
$fileStream = [System.IO.FileStream]::new($Output, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
$writer = [System.IO.StreamWriter]::new($fileStream, $utf8WithoutBom)
$writer.AutoFlush = $true

try {
  Get-Counter -Counter $counters -SampleInterval $SampleIntervalSeconds -Continuous -ErrorAction Stop | ForEach-Object {
    if ($StopSignal -and [System.IO.File]::Exists($StopSignal)) { break }
    if ([DateTimeOffset]::UtcNow -ge $deadline) { break }
    if (-not (Get-Process -Id $ApiPid -ErrorAction SilentlyContinue)) { break }
    if ($ParentPid -gt 0 -and -not (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)) { break }

    $captureStarted = [Diagnostics.Stopwatch]::StartNew()
    $sequence += 1
    $api = Get-Process -Id $ApiPid -ErrorAction SilentlyContinue
    $captureProcessSnapshot = (($sequence - 1) % $ProcessSnapshotEverySamples) -eq 0
    $top = if ($captureProcessSnapshot) { @(Get-TopProcesses) } else { $null }
    $samples = $_.CounterSamples
    $record = [ordered]@{
      contract = 'agm-controlled-reproduction-host-sample.v2'
      sequence = $sequence
      at = $_.Timestamp.ToUniversalTime().ToString('o')
      samplerPid = $PID
      intervalSeconds = $SampleIntervalSeconds
      processSnapshotEverySamples = $ProcessSnapshotEverySamples
      processSnapshotCaptured = $captureProcessSnapshot
      cpuPercent = Convert-Rounded (Get-CounterSum $samples '*processor(_total)*') 2
      processorQueue = Convert-Rounded (Get-CounterSum $samples '*system*processor queue length') 2
      contextSwitchesPerSec = Convert-Rounded (Get-CounterSum $samples '*system*context switches/sec') 2
      availableMemoryMB = Convert-Rounded (Get-CounterSum $samples '*memory*available mbytes') 2
      pagesPerSec = Convert-Rounded (Get-CounterSum $samples '*memory*pages/sec') 2
      diskQueue = Convert-Rounded (Get-CounterSum $samples '*physicaldisk(_total)*avg. disk queue length') 3
      diskBytesPerSec = Convert-Rounded (Get-CounterSum $samples '*physicaldisk(_total)*disk bytes/sec') 2
      networkBytesPerSec = Convert-Rounded (Get-CounterSum $samples '*network interface*bytes total/sec') 2
      apiPid = $ApiPid
      apiCpuSec = if ($api) { Convert-Rounded $api.CPU 6 } else { $null }
      apiWorkingSetMB = if ($api) { Convert-Rounded ($api.WorkingSet64 / 1MB) 2 } else { $null }
      apiPrivateMB = if ($api) { Convert-Rounded ($api.PrivateMemorySize64 / 1MB) 2 } else { $null }
      topCpuProcesses = $top
      captureDurationMs = $null
    }
    $captureStarted.Stop()
    $record.captureDurationMs = Convert-Rounded $captureStarted.Elapsed.TotalMilliseconds 3
    $writer.WriteLine(($record | ConvertTo-Json -Depth 6 -Compress))
  }
} finally {
  $writer.Dispose()
}
