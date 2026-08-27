param(
  [Parameter(Mandatory = $true)][ValidateRange(1, 2147483647)][int]$TargetPid,
  [Parameter(Mandatory = $true)][string]$WindowStartUtc,
  [Parameter(Mandatory = $true)][string]$WindowEndUtc,
  [Parameter(Mandatory = $true)][string]$Output
)

$ErrorActionPreference = 'Stop'

function Get-Sha256Text {
  param([Parameter(Mandatory = $true)][string]$Value)
  $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $algorithm.Dispose()
  }
}

function Convert-PidValue {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
  $trimmed = $Value.Trim()
  try {
    if ($trimmed -match '^0x[0-9a-fA-F]+$') {
      return [Convert]::ToInt32($trimmed.Substring(2), 16)
    }
    if ($trimmed -match '^\d+$') { return [int]$trimmed }
  } catch {}
  return $null
}

function Get-ClassificationTokens {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
  $rules = @(
    [pscustomobject]@{ token = 'Get-InstrumentationLifecycleProcessInventory'; classification = 'PROCESS_INVENTORY' },
    [pscustomobject]@{ token = 'Invoke-InstrumentationLifecycleClosure'; classification = 'LIFECYCLE_RUNNER' },
    [pscustomobject]@{ token = 'Sample-RealBasicHost'; classification = 'HOST_SAMPLER' },
    [pscustomobject]@{ token = 'Sample-RealBasicProcesses'; classification = 'PROCESS_SAMPLER' },
    [pscustomobject]@{ token = 'instrumentation-lifecycle-probe'; classification = 'LIFECYCLE_CLIENT' },
    [pscustomobject]@{ token = '-EncodedCommand'; classification = 'ENCODED_POWERSHELL' },
    [pscustomobject]@{ token = 'CodexSandbox'; classification = 'CODEX_SANDBOX' },
    [pscustomobject]@{ token = 'AGM Services'; classification = 'AGM_SERVICES_TASK' }
  )
  return @($rules | Where-Object {
    $Value.IndexOf($_.token, [StringComparison]::OrdinalIgnoreCase) -ge 0
  } | ForEach-Object { $_.classification } | Sort-Object -Unique)
}

function Get-XmlEventData {
  param([xml]$Xml)
  $fields = [System.Collections.Generic.List[object]]::new()
  $index = 0
  foreach ($node in @($Xml.Event.EventData.Data)) {
    $name = if ($node.Name) { [string]$node.Name } else { "EventData[$index]" }
    $value = [string]$node.'#text'
    if ([string]::IsNullOrEmpty($value)) { $value = [string]$node.InnerText }
    $fields.Add([pscustomobject]@{ Name = $name; Value = $value })
    $index += 1
  }
  return @($fields)
}

function Get-FieldEvidence {
  param([object[]]$Fields)
  $commandEvidence = [System.Collections.Generic.List[object]]::new()
  $executableEvidence = [System.Collections.Generic.List[object]]::new()
  $parentPids = [System.Collections.Generic.List[int]]::new()
  $taskEvidence = [System.Collections.Generic.List[object]]::new()

  foreach ($field in $Fields) {
    $name = [string]$field.Name
    $value = [string]$field.Value
    if ([string]::IsNullOrWhiteSpace($value)) { continue }

    if ($name -match '(?i)commandline|hostapplication') {
      $commandEvidence.Add([ordered]@{
        field = $name
        length = $value.Length
        sha256 = Get-Sha256Text $value
        classifications = @(Get-ClassificationTokens $value)
      })
    }

    if ($name -match '(?i)newprocessname|image|executablepath|applicationname|actionname') {
      $leafName = $null
      try { $leafName = [IO.Path]::GetFileName($value.Trim('"')) } catch {}
      $executableEvidence.Add([ordered]@{
        field = $name
        leafName = $leafName
        valueSha256 = Get-Sha256Text $value
        classifications = @(Get-ClassificationTokens $value)
      })
    }

    if ($name -match '(?i)parent.*process.*id|parentpid') {
      $parsedParent = Convert-PidValue $value
      if ($null -ne $parsedParent) { $parentPids.Add($parsedParent) }
    }

    if ($name -match '(?i)taskname') {
      $taskEvidence.Add([ordered]@{
        field = $name
        valueSha256 = Get-Sha256Text $value
        isAgmServices = $value -match '(?i)AGM Services'
      })
    }
  }

  return [ordered]@{
    commandFields = @($commandEvidence)
    executableFields = @($executableEvidence)
    parentPids = @($parentPids | Sort-Object -Unique)
    taskFields = @($taskEvidence)
  }
}

$start = [DateTimeOffset]::Parse($WindowStartUtc).ToUniversalTime()
$end = [DateTimeOffset]::Parse($WindowEndUtc).ToUniversalTime()
if ($end -le $start) { throw 'INVALID_FORENSIC_WINDOW' }

$logSpecifications = @(
  [pscustomobject]@{ LogName = 'Security'; Ids = @(4688) },
  [pscustomobject]@{ LogName = 'Microsoft-Windows-Sysmon/Operational'; Ids = @(1) },
  [pscustomobject]@{ LogName = 'Windows PowerShell'; Ids = @() },
  [pscustomobject]@{ LogName = 'Microsoft-Windows-PowerShell/Operational'; Ids = @() },
  [pscustomobject]@{ LogName = 'Microsoft-Windows-TaskScheduler/Operational'; Ids = @() }
)

$queries = [System.Collections.Generic.List[object]]::new()
$eventMatches = [System.Collections.Generic.List[object]]::new()

foreach ($specification in $logSpecifications) {
  $queryRecord = [ordered]@{
    logName = $specification.LogName
    status = 'UNKNOWN'
    enabled = $null
    recordsInspected = 0
    matches = 0
    errorClassification = $null
  }
  try {
    $log = Get-WinEvent -ListLog $specification.LogName -ErrorAction Stop
    $queryRecord.enabled = [bool]$log.IsEnabled
    if (-not $log.IsEnabled) {
      $queryRecord.status = 'DISABLED'
      $queries.Add($queryRecord)
      continue
    }

    $filter = @{
      LogName = $specification.LogName
      StartTime = $start.UtcDateTime
      EndTime = $end.UtcDateTime
    }
    if ($specification.Ids.Count -gt 0) { $filter.Id = $specification.Ids }
    $events = @(Get-WinEvent -FilterHashtable $filter -ErrorAction Stop)
    $queryRecord.recordsInspected = $events.Count

    foreach ($event in $events) {
      $xml = [xml]$event.ToXml()
      $systemPid = Convert-PidValue ([string]$xml.Event.System.Execution.ProcessID)
      $fields = @(Get-XmlEventData $xml)
      $matchingFields = [System.Collections.Generic.List[string]]::new()
      if ($systemPid -eq $TargetPid) { $matchingFields.Add('System.Execution.ProcessID') }
      foreach ($field in $fields) {
        if ($field.Name -match '(?i)(^|[^a-z])(new|parent|client|engine)?processid$|(^|[^a-z])pid$|enginepid') {
          $parsedPid = Convert-PidValue ([string]$field.Value)
          if ($parsedPid -eq $TargetPid) { $matchingFields.Add([string]$field.Name) }
        }
      }
      if ($matchingFields.Count -eq 0) { continue }

      $fieldEvidence = Get-FieldEvidence $fields
      $eventMatches.Add([ordered]@{
        logName = $specification.LogName
        providerName = $event.ProviderName
        eventId = [int]$event.Id
        recordId = [long]$event.RecordId
        timeCreated = $event.TimeCreated.ToUniversalTime().ToString('o')
        systemProcessId = $systemPid
        matchingFields = @($matchingFields | Sort-Object -Unique)
        evidence = $fieldEvidence
      })
    }

    $queryRecord.matches = @($eventMatches | Where-Object { $_.logName -eq $specification.LogName }).Count
    $queryRecord.status = 'SUCCESS'
  } catch {
    $queryRecord.status = 'UNAVAILABLE'
    $queryRecord.errorClassification = if ($_.Exception.Message -match '(?i)access.*denied|unauthorized') {
      'ACCESS_DENIED'
    } elseif ($_.Exception.Message -match '(?i)no events were found') {
      'NO_EVENTS'
    } elseif ($_.Exception.Message -match '(?i)does not exist|not found') {
      'LOG_NOT_PRESENT'
    } else {
      'QUERY_FAILED'
    }
  }
  $queries.Add($queryRecord)
}

$classificationTokens = @($eventMatches | ForEach-Object {
  @($_.evidence.commandFields.classifications) + @($_.evidence.executableFields.classifications)
} | Where-Object { $_ } | Sort-Object -Unique)

$result = [ordered]@{
  contract = 'agm-sanitized-historical-process-evidence.v1'
  capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
  target = [ordered]@{
    pid = $TargetPid
    windowStartUtc = $start.ToString('o')
    windowEndUtc = $end.ToString('o')
  }
  queries = @($queries)
  matches = @($eventMatches | Sort-Object timeCreated, logName, recordId)
  aggregateClassifications = $classificationTokens
  classification = if ($classificationTokens.Count -eq 1) { $classificationTokens[0] } elseif ($classificationTokens.Count -gt 1) { 'MULTIPLE_EVIDENCE_TOKENS' } else { 'NOT_PROVEN_FROM_AVAILABLE_LOGS' }
  rawMessagesRecorded = $false
  rawCommandLinesRecorded = $false
  secretsRecorded = $false
  trafficGenerated = $false
  processChanges = 0
}

$fullOutput = [IO.Path]::GetFullPath($Output)
$directory = [IO.Path]::GetDirectoryName($fullOutput)
if ($directory) { [IO.Directory]::CreateDirectory($directory) | Out-Null }
$json = $result | ConvertTo-Json -Depth 12
[IO.File]::WriteAllText($fullOutput, "$json$([Environment]::NewLine)", [Text.UTF8Encoding]::new($false))
