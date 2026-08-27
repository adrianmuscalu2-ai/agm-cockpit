$ErrorActionPreference = 'Stop'

$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$monitor = Join-Path $repositoryRoot 'scripts\Monitor-AGM-Services.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "agm-mon008-$([guid]::NewGuid().ToString('N'))"
$configPath = Join-Path $testRoot 'config.json'
$statePath = Join-Path $testRoot 'state.json'
$eventPath = Join-Path $testRoot 'events.jsonl'
$outboxPath = Join-Path $testRoot 'outbox.jsonl'

try {
  New-Item -ItemType Directory -Path $testRoot | Out-Null
  [ordered]@{
    recipient = 'test@example.invalid'
    failureThreshold = 2
    checks = @([ordered]@{
      id = 'browser-public'
      name = 'AGM Turn public'
      url = 'https://app.agmcockpit.com/turn'
      timeoutSeconds = 15
      monitorCode = 'MON-008'
      environment = 'Cloudflare'
      category = 'network'
      severity = 'major'
    })
  } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configPath -Encoding UTF8

  & $monitor -ConfigPath $configPath -StatePath $statePath -EventLogPath $eventPath -OutboxPath $outboxPath -Simulation Failure | Out-Null
  & $monitor -ConfigPath $configPath -StatePath $statePath -EventLogPath $eventPath -OutboxPath $outboxPath -Simulation Failure | Out-Null
  $failureState = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
  $failure = $failureState.services.'browser-public'
  if ($failure.status -ne 'TRANSPORT_ERROR') { throw "Expected TRANSPORT_ERROR, got $($failure.status)" }
  if ($failure.alertSent) { throw 'TRANSPORT_ERROR must not publish a confirmed Cloudflare alert.' }
  if (Test-Path -LiteralPath $eventPath) { throw 'TRANSPORT_ERROR must not create a confirmed Cloudflare incident event.' }

  & $monitor -ConfigPath $configPath -StatePath $statePath -EventLogPath $eventPath -OutboxPath $outboxPath -Simulation Recovery | Out-Null
  $recoveryState = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
  $recovery = $recoveryState.services.'browser-public'
  if ($recovery.status -ne 'online') { throw "Expected online, got $($recovery.status)" }
  if ($recovery.outcome -ne 'HTTP_STATUS' -or $recovery.httpStatus -ne 200) { throw 'HTTP result fields are incomplete.' }
  if (-not $recovery.lastSuccessAt) { throw 'LAST_SUCCESS was not preserved.' }
  if ($recovery.effectiveUrl -ne 'https://app.agmcockpit.com/turn') { throw 'Effective URL is incorrect.' }

  Write-Output 'MON-008 external monitor focused remediation: PASS'
} finally {
  if (Test-Path -LiteralPath $testRoot) {
    Remove-Item -LiteralPath $testRoot -Recurse -Force
  }
}
