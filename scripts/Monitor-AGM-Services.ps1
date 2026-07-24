param(
  [string]$ConfigPath = "$env:ProgramData\AGM\monitor\config.json",
  [string]$StatePath = "$env:ProgramData\AGM\monitor\state.json",
  [ValidateSet('Live', 'Failure', 'Recovery')]
  [string]$Simulation = 'Live',
  [string]$OutboxPath = ''
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
  Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
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
    $client.EnableSsl = [bool]$Config.smtp.enableSsl
    $client.Credentials = $credential.GetNetworkCredential()
    $client.Send($message)
  } finally {
    $message.Dispose()
    $client.Dispose()
  }
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
    }
  }

  if ($result.ok) {
    if ($previous.alertSent) {
      $subject = "[AGM RECOVERY] $($check.name) este din nou online"
      $body = @"
Serviciu: $($check.name)
Ora revenirii: $($now.ToString('yyyy-MM-dd HH:mm:ss zzz'))
Rezultat verificare: $($result.result)
Recomandare: verificați stabilitatea și închideți incidentul numai după confirmarea operațională.
"@
      Send-AgmAlert -Config $config -Subject $subject -Body $body
    }
    $previous.status = 'online'
    $previous.consecutiveFailures = 0
    $previous.alertSent = $false
  } else {
    $previous.consecutiveFailures = [int]$previous.consecutiveFailures + 1
    $previous.status = 'offline'
    if (-not $previous.alertSent -and $previous.consecutiveFailures -ge [int]$config.failureThreshold) {
      $subject = "[AGM ALERT] $($check.name) indisponibil"
      $body = @"
Serviciu afectat: $($check.name)
Ora incidentului: $($now.ToString('yyyy-MM-dd HH:mm:ss zzz'))
Rezultat verificare: $($result.result)
URL verificat: $($check.url)
Recomandare: verificați API-ul AGM, serviciul cloudflared și conectivitatea publică; nu reporniți PostgreSQL fără diagnostic separat.
"@
      Send-AgmAlert -Config $config -Subject $subject -Body $body
      $previous.alertSent = $true
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
