$ErrorActionPreference = 'Stop'

$monitorRoot = "$env:ProgramData\AGM\monitor"
$configPath = Join-Path $monitorRoot 'config.json'
$statePath = Join-Path $monitorRoot 'state.json'
$monitorScript = Join-Path $PSScriptRoot 'Monitor-AGM-Services.ps1'
$taskName = 'AGM Service Monitor'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Monitor configuration not found: $configPath"
}

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

Copy-Item -LiteralPath $configPath -Destination (Join-Path $monitorRoot "config.pre-browser-$stamp.json")
if (Test-Path -LiteralPath $statePath) {
  Copy-Item -LiteralPath $statePath -Destination (Join-Path $monitorRoot "state.pre-browser-$stamp.json")
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$config.checks = @(
  [pscustomobject]@{
    id = 'api-local'
    name = 'AGM API local'
    url = 'http://127.0.0.1:3000/api/v1/health/ready'
    timeoutSeconds = 10
  },
  [pscustomobject]@{
    id = 'api-public'
    name = 'AGM acces public'
    url = 'https://api.agmcockpit.com/api/v1/health/ready'
    timeoutSeconds = 15
  },
  [pscustomobject]@{
    id = 'browser-local'
    name = 'AGM Browser local'
    url = 'http://127.0.0.1:5173/'
    timeoutSeconds = 10
  },
  [pscustomobject]@{
    id = 'browser-public'
    name = 'AGM Browser public'
    url = 'https://app.agmcockpit.com/turn'
    timeoutSeconds = 15
  }
)
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configPath -Encoding UTF8

$outboxPath = Join-Path $monitorRoot "recovery-local-$stamp.jsonl"
& $monitorScript `
  -ConfigPath $configPath `
  -StatePath $statePath `
  -OutboxPath $outboxPath `
  -Simulation Live

Start-ScheduledTask -TaskName $taskName

Write-Output "AGM Browser monitor updated: $configPath"
Write-Output "Previous configuration backup stamp: $stamp"
Write-Output "Recovery notifications captured locally: $outboxPath"
