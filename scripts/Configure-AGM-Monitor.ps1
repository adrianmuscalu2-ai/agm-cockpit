param(
  [string]$Recipient,
  [string]$SmtpHost,
  [int]$SmtpPort = 587,
  [string]$From,
  [switch]$EnableSsl = $true
)

$ErrorActionPreference = 'Stop'
$monitorRoot = "$env:ProgramData\AGM\monitor"
$configPath = Join-Path $monitorRoot 'config.json'
$credentialPath = Join-Path $monitorRoot 'smtp.credential.xml'

if (-not $Recipient -or -not $SmtpHost -or -not $From) {
  throw 'Recipient, SmtpHost and From are required.'
}

New-Item -ItemType Directory -Path $monitorRoot -Force | Out-Null
$credential = Get-Credential -Message 'Introduceți utilizatorul SMTP și parola/aplicația credential pentru alarma AGM.'
$credential | Export-Clixml -LiteralPath $credentialPath

$config = [ordered]@{
  recipient = $Recipient
  failureThreshold = 2
  checks = @(
    [ordered]@{
      id = 'api-local'
      name = 'AGM API local'
      url = 'http://127.0.0.1:3000/api/v1/health/ready'
      timeoutSeconds = 10
    },
    [ordered]@{
      id = 'api-public'
      name = 'AGM acces public'
      url = 'https://api.agmcockpit.com/api/v1/health/ready'
      timeoutSeconds = 15
    }
  )
  smtp = [ordered]@{
    host = $SmtpHost
    port = $SmtpPort
    enableSsl = [bool]$EnableSsl
    from = $From
    credentialPath = $credentialPath
  }
}

$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configPath -Encoding UTF8
icacls $monitorRoot /inheritance:r /grant:r "$env:USERNAME:(OI)(CI)F" | Out-Null
Write-Output "Configuration saved: $configPath"
Write-Output 'SMTP credential is encrypted for the current Windows user and stored outside the repository.'
