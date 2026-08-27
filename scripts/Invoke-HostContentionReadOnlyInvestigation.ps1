param(
  [Parameter(Mandatory = $true)][string]$Output,
  [ValidateRange(20, 600)][int]$DurationSeconds = 30,
  [ValidateRange(1, 10)][int]$SampleIntervalSeconds = 2
)

$ErrorActionPreference = 'Stop'
$startedAt = [DateTimeOffset]::UtcNow
$logicalCpu = [Environment]::ProcessorCount

function Protect-CommandLine([string]$value) {
  if (-not $value) { return $null }
  $result = $value
  $patterns = @(
    '(?i)(token|secret|password|passwd|api[_-]?key|authorization)(\s*[=:]\s*)([^\s"'']+)',
    '(?i)(bearer\s+)([^\s"'']+)'
  )
  foreach ($pattern in $patterns) { $result = [regex]::Replace($result, $pattern, '$1$2[REDACTED]') }
  return $result
}

function Get-ProcessSnapshot {
  $capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
  $rows = @(Get-CimInstance Win32_Process | ForEach-Object {
    [pscustomobject]@{
      pid = [int]$_.ProcessId
      parentPid = [int]$_.ParentProcessId
      name = [string]$_.Name
      creationAt = if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUniversalTime().ToString('o') } else { $null }
      commandLine = Protect-CommandLine ([string]$_.CommandLine)
      commandLineAvailable = [bool]$_.CommandLine
      kernelTime100ns = [uint64]$_.KernelModeTime
      userTime100ns = [uint64]$_.UserModeTime
      workingSetBytes = [uint64]$_.WorkingSetSize
      readBytes = [uint64]$_.ReadTransferCount
      writeBytes = [uint64]$_.WriteTransferCount
      readOperations = [uint64]$_.ReadOperationCount
      writeOperations = [uint64]$_.WriteOperationCount
      sessionId = [int]$_.SessionId
    }
  })
  return [pscustomobject]@{ capturedAt = $capturedAt; processes = $rows }
}

$before = Get-ProcessSnapshot
$counterPaths = @(
  '\Processor(_Total)\% Processor Time',
  '\System\Processor Queue Length',
  '\Memory\Available MBytes',
  '\Memory\% Committed Bytes In Use',
  '\PhysicalDisk(_Total)\% Disk Time',
  '\PhysicalDisk(_Total)\Current Disk Queue Length',
  '\PhysicalDisk(_Total)\Disk Bytes/sec'
)
$sampleCount = [Math]::Max(2, [Math]::Ceiling($DurationSeconds / $SampleIntervalSeconds))
$counterSets = @(Get-Counter -Counter $counterPaths -SampleInterval $SampleIntervalSeconds -MaxSamples $sampleCount)
$after = Get-ProcessSnapshot
$completedAt = [DateTimeOffset]::UtcNow
$elapsed = [Math]::Max(0.001, ($completedAt - $startedAt).TotalSeconds)

$deltas = foreach ($a in $after.processes) {
  $b = $before.processes | Where-Object pid -eq $a.pid | Select-Object -First 1
  if (-not $b -or $b.creationAt -ne $a.creationAt) { continue }
  $cpuSeconds = (($a.kernelTime100ns + $a.userTime100ns) - ($b.kernelTime100ns + $b.userTime100ns)) / 10000000
  [pscustomobject]@{
    pid = $a.pid; parentPid = $a.parentPid; name = $a.name; creationAt = $a.creationAt
    commandLine = $a.commandLine; commandLineAvailable = $a.commandLineAvailable
    cpuSecondsDelta = [Math]::Round($cpuSeconds, 6)
    cpuPercentOfHost = [Math]::Round(($cpuSeconds / ($elapsed * $logicalCpu)) * 100, 3)
    workingSetMB = [Math]::Round($a.workingSetBytes / 1MB, 3)
    readBytesDelta = [long]($a.readBytes - $b.readBytes)
    writeBytesDelta = [long]($a.writeBytes - $b.writeBytes)
    readOperationsDelta = [long]($a.readOperations - $b.readOperations)
    writeOperationsDelta = [long]($a.writeOperations - $b.writeOperations)
  }
}

$samples = foreach ($set in $counterSets) {
  $values = @{}
  foreach ($sample in $set.CounterSamples) { $values[$sample.Path.ToLowerInvariant()] = [Math]::Round([double]$sample.CookedValue, 3) }
  [pscustomobject]@{ capturedAt = $set.Timestamp.ToUniversalTime().ToString('o'); counters = $values }
}

$services = @(Get-CimInstance Win32_Service | Where-Object ProcessId -gt 0 | ForEach-Object {
  [pscustomobject]@{ name=$_.Name; displayName=$_.DisplayName; state=$_.State; startMode=$_.StartMode; pid=[int]$_.ProcessId }
})
$tasks = @(Get-ScheduledTask | Where-Object State -eq 'Running' | ForEach-Object {
  [pscustomobject]@{ taskPath=$_.TaskPath; taskName=$_.TaskName; state=[string]$_.State }
})
$containers = [ordered]@{ available=$false; records=@(); error=$null }
try {
  $docker = Get-Command docker -ErrorAction Stop
  $raw = @(& $docker.Source ps --no-trunc --format '{{json .}}' 2>&1)
  if ($LASTEXITCODE -eq 0) { $containers.available=$true; $containers.records=@($raw | ForEach-Object { $_ | ConvertFrom-Json }) }
  else { $containers.error='DOCKER_PS_FAILED' }
} catch { $containers.error=$_.Exception.GetType().FullName }

$result = [ordered]@{
  contract='agm-host-contention-read-only-investigation.v1'; startedAt=$startedAt.ToString('o'); completedAt=$completedAt.ToString('o')
  durationSeconds=[Math]::Round($elapsed,3); sampleIntervalSeconds=$SampleIntervalSeconds; logicalCpuCount=$logicalCpu
  trafficGenerated=$false; processChanges=0; serviceChanges=0; p9Launched=$false
  processInventoryBefore=$before; processInventoryAfter=$after
  processDeltasByCpu=@($deltas | Sort-Object cpuSecondsDelta -Descending)
  processDeltasByMemory=@($deltas | Sort-Object workingSetMB -Descending)
  processDeltasByIo=@($deltas | Sort-Object @{Expression={ $_.readBytesDelta + $_.writeBytesDelta }} -Descending)
  hostSamples=@($samples); activeServices=$services; runningScheduledTasks=$tasks; containers=$containers
  eventLoop=[ordered]@{ status='UNAVAILABLE_WITHOUT_RUNTIME_ATTACHMENT_OR_INSTRUMENTED_TRAFFIC'; attachmentPerformed=$false; trafficGenerated=$false }
  sanitization=[ordered]@{ commandLinesRecorded=$true; secretLikeValuesRedacted=$true; executablePathsRecorded=$false }
}
$directory=[IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($Output)); [IO.Directory]::CreateDirectory($directory)|Out-Null
$result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Output -Encoding UTF8
Write-Output "HOST_CONTENTION_READ_ONLY_CAPTURE_OK $Output"
