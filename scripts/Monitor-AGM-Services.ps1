param(
  [string]$ConfigPath = "$env:ProgramData\AGM\monitor\config.json",
  [string]$StatePath = "$env:ProgramData\AGM\monitor\state.json",
  [ValidateSet('Live', 'Failure', 'Recovery')]
  [string]$Simulation = 'Live',
  [string]$OutboxPath = '',
  [string]$EventLogPath = "$env:ProgramData\AGM\monitor\events.jsonl"
)

$ErrorActionPreference = 'Stop'

function Read-JsonFile {
  param([string]$Path, [object]$Fallback)
  if (-not (Test-Path -LiteralPath $Path)) { return $Fallback }
  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Write-JsonFile {
  param([string]$Path, [object]$Value)
  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $temporaryPath = "$Path.tmp"
  $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temporaryPath -Encoding UTF8
  if (Test-Path -LiteralPath $Path) {
    Copy-Item -LiteralPath $temporaryPath -Destination $Path -Force
    Remove-Item -LiteralPath $temporaryPath -Force
  } else {
    Move-Item -LiteralPath $temporaryPath -Destination $Path
  }
}

function Send-AgmAlert {
  param(
    [object]$Config,
    [string]$Subject,
    [string]$Body
  )

  if ($OutboxPath) {
    $record = [ordered]@{
      sentAt = (Get-Date).ToUniversalTime().ToString('o')
      to = $Config.recipient
      subject = $Subject
      body = $Body
    }
    $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $OutboxPath -Encoding UTF8
    return
  }

  if (-not $Config.smtp -or -not $Config.smtp.credentialPath) {
    throw 'SMTP transport is not configured.'
  }

  $credential = Import-Clixml -LiteralPath $Config.smtp.credentialPath
  $message = [System.Net.Mail.MailMessage]::new()
  $client = [System.Net.Mail.SmtpClient]::new([string]$Config.smtp.host, [int]$Config.smtp.port)
  try {
    $message.From = [string]$Config.smtp.from
    [void]$message.To.Add([string]$Config.recipient)
    $message.Subject = $Subject
    $message.Body = $Body
    $message.IsBodyHtml = $false
    $client.Timeout = 15000
    $client.EnableSsl = [bool]$Config.smtp.enableSsl
    $client.Credentials = $credential.GetNetworkCredential()
    $client.Send($message)
  } finally {
    $message.Dispose()
    $client.Dispose()
  }
}

function Try-SendAgmAlert {
  param(
    [object]$Config,
    [string]$Subject,
    [string]$Body
  )

  try {
    Send-AgmAlert -Config $Config -Subject $Subject -Body $Body
    return $null
  } catch {
    return $_.Exception.Message
  }
}

function Write-AgmMonitoringEvent {
  param(
    [object]$Check,
    [object]$Result,
    [string]$Kind,
    [string]$IncidentId,
    [string]$Summary,
    [string]$RecommendedAction
  )
  if (-not $EventLogPath) { return }
  $directory = Split-Path -Parent $EventLogPath
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $event = [ordered]@{
    contract = 'agm-monitoring-event.v1'
    eventId = "AGM-MON-EVT-$([guid]::NewGuid().ToString('N'))"
    incidentId = $IncidentId
    kind = $Kind
    occurredAt = $now.ToUniversalTime().ToString('o')
    detectedAt = (Get-Date).ToUniversalTime().ToString('o')
    monitorCode = if ($Check.monitorCode) { [string]$Check.monitorCode } else { 'MON-003' }
    checkId = [string]$Check.id
    component = [string]$Check.name
    environment = if ($Check.environment) { [string]$Check.environment } else { 'API' }
    category = if ($Check.category) { [string]$Check.category } else { 'infrastructure' }
    severity = if ($Check.severity) { [string]$Check.severity } else { 'major' }
    summary = $Summary
    observedResult = [string]$Result.result
    recommendedAction = $RecommendedAction
  }
  $event | ConvertTo-Json -Compress | Add-Content -LiteralPath $EventLogPath -Encoding UTF8
}

function Invoke-AgmCheck {
  param([object]$Check)

  if ($Simulation -eq 'Failure') {
    return [ordered]@{ ok = $false; result = 'SIMULATED_FAILURE'; statusCode = 0; elapsedMs = 0 }
  }
  if ($Simulation -eq 'Recovery') {
    return [ordered]@{ ok = $true; result = 'SIMULATED_RECOVERY'; statusCode = 200; elapsedMs = 0 }
  }

  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $response = Invoke-WebRequest -Uri $Check.url -UseBasicParsing -TimeoutSec ([int]$Check.timeoutSeconds)
    $stopwatch.Stop()
    return [ordered]@{
      ok = ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 400)
      result = "HTTP $([int]$response.StatusCode)"
      statusCode = [int]$response.StatusCode
      elapsedMs = $stopwatch.ElapsedMilliseconds
    }
  } catch {
    $stopwatch.Stop()
    return [ordered]@{
      ok = $false
      result = $_.Exception.Message
      statusCode = 0
      elapsedMs = $stopwatch.ElapsedMilliseconds
    }
  }
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Monitor configuration not found: $ConfigPath"
}

$config = Read-JsonFile -Path $ConfigPath -Fallback $null
$state = Read-JsonFile -Path $StatePath -Fallback ([pscustomobject]@{ services = [pscustomobject]@{} })
$stateMap = @{}
foreach ($property in $state.services.PSObject.Properties) {
  $stateMap[$property.Name] = $property.Value
}

$now = Get-Date
foreach ($check in $config.checks) {
  $result = Invoke-AgmCheck -Check $check
  $previous = $stateMap[[string]$check.id]
  if (-not $previous) {
    $previous = [pscustomobject]@{
      status = 'unknown'
      consecutiveFailures = 0
      alertSent = $false
      lastCheckedAt = $null
      lastResult = $null
      lastAlertError = $null
    }
  }
  if (-not $previous.PSObject.Properties['lastAlertError']) {
    $previous | Add-Member -NotePropertyName lastAlertError -NotePropertyValue $null
  }

  if ($result.ok) {
    $recoveryPending = [bool]$previous.alertSent
    $previous.status = 'online'
    $previous.consecutiveFailures = 0
    $previous.alertSent = $false
    $previous.lastAlertError = $null
    if ($recoveryPending) {
      $incidentId = [string]$previous.incidentId
      $subject = "[AGM RECOVERY] $($check.name) este din nou online"
      $body = @"
Serviciu: $($check.name)
Ora revenirii: $($now.ToString('yyyy-MM-dd HH:mm:ss zzz'))
Rezultat verificare: $($result.result)
Recomandare: verificați stabilitatea și închideți incidentul numai după confirmarea operațională.
"@
      $alertError = Try-SendAgmAlert -Config $config -Subject $subject -Body $body
      if ($alertError) {
        $previous.alertSent = $true
        $previous.lastAlertError = $alertError
      }
      if ($incidentId) {
        Write-AgmMonitoringEvent -Check $check -Result $result -Kind 'recovery' -IncidentId $incidentId `
          -Summary "$($check.name) este din nou online" `
          -RecommendedAction 'Validați stabilitatea și închideți incidentul numai după confirmarea operațională.'
      }
      $previous.incidentId = $null
    }
  } else {
    $previous.consecutiveFailures = [int]$previous.consecutiveFailures + 1
    $previous.status = 'offline'
    if (-not $previous.alertSent -and $previous.consecutiveFailures -ge [int]$config.failureThreshold) {
      $incidentCreated = $false
      if (-not $previous.PSObject.Properties['incidentId'] -or -not $previous.incidentId) {
        $previous | Add-Member -NotePropertyName incidentId -NotePropertyValue `
          "AGM-MON-$($check.id)-$($now.ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))" -Force
        $incidentCreated = $true
      }
      $subject = "[AGM ALERT] $($check.name) indisponibil"
      $body = @"
Serviciu afectat: $($check.name)
Ora incidentului: $($now.ToString('yyyy-MM-dd HH:mm:ss zzz'))
Rezultat verificare: $($result.result)
URL verificat: $($check.url)
Recomandare: verificați API-ul AGM, serviciul cloudflared și conectivitatea publică; nu reporniți PostgreSQL fără diagnostic separat.
"@
      $alertError = Try-SendAgmAlert -Config $config -Subject $subject -Body $body
      if ($alertError) {
        $previous.lastAlertError = $alertError
      } else {
        $previous.alertSent = $true
        $previous.lastAlertError = $null
      }
      if ($incidentCreated) {
        Write-AgmMonitoringEvent -Check $check -Result $result -Kind 'failure' `
          -IncidentId ([string]$previous.incidentId) -Summary "$($check.name) indisponibil" `
          -RecommendedAction 'Verificați componenta, ruta și dependențele; nu executați restart automat fără diagnostic.'
      }
    }
  }

  $previous.lastCheckedAt = $now.ToUniversalTime().ToString('o')
  $previous.lastResult = $result.result
  $stateMap[[string]$check.id] = $previous
  Write-Output "$($check.id)|$($previous.status)|$($result.result)|alertSent=$($previous.alertSent)"
}

$services = [ordered]@{}
foreach ($key in ($stateMap.Keys | Sort-Object)) {
  $services[$key] = $stateMap[$key]
}
Write-JsonFile -Path $StatePath -Value ([ordered]@{ services = $services })
