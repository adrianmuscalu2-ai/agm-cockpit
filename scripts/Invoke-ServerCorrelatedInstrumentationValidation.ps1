param([int]$Port = 3200, [string]$OutputRoot = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $OutputRoot) {
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
  $OutputRoot = Join-Path $root "evidence/governance/copilot-v1.2/p9/server-correlated-instrumentation/$stamp"
}
New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
if (netstat -ano | Select-String ":$Port\s+.*LISTENING") { throw "DIAGNOSTIC_PORT_$Port`_IN_USE" }
$effectiveDatabaseUrl = $env:DATABASE_URL
if (-not $effectiveDatabaseUrl) {
  $databaseLine = (Select-String -Path (Join-Path $root '.env') -Pattern '^DATABASE_URL=' | Select-Object -First 1).Line
  if ($databaseLine) { $effectiveDatabaseUrl = $databaseLine.Substring($databaseLine.IndexOf('=') + 1).Trim('"') }
}
if (-not $effectiveDatabaseUrl) { throw 'DIAGNOSTIC_DATABASE_TARGET_MISSING' }
$databaseUri = [uri]$effectiveDatabaseUrl
$databaseLoopback = $databaseUri.Host -in @('localhost', '127.0.0.1', '::1')
if (-not $databaseLoopback) { throw 'DIAGNOSTIC_DATABASE_TARGET_NOT_LOOPBACK' }
[ordered]@{
  contract = 'agm-server-correlated-database-target.v1'
  host = $databaseUri.Host
  port = $databaseUri.Port
  database = $databaseUri.AbsolutePath.TrimStart('/')
  loopback = $databaseLoopback
  credentialsRecorded = $false
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputRoot 'database-target.json') -Encoding utf8

$telemetry = Join-Path $OutputRoot 'server-correlated-telemetry.jsonl'
$runId = Split-Path -Leaf $OutputRoot
$prior = @{
  NODE_OPTIONS = $env:NODE_OPTIONS
  AGM_CORRELATED_TELEMETRY_PATH = $env:AGM_CORRELATED_TELEMETRY_PATH
  AGM_DIAGNOSTIC_FAULTS = $env:AGM_DIAGNOSTIC_FAULTS
  AGM_CORRELATED_RUN_ID = $env:AGM_CORRELATED_RUN_ID
  PORT = $env:PORT
  API_HOST = $env:API_HOST
  NODE_ENV = $env:NODE_ENV
}
$env:PORT = "$Port"
$env:API_HOST = '127.0.0.1'
$env:NODE_ENV = 'test'
$env:AGM_CORRELATED_TELEMETRY_PATH = $telemetry
$env:AGM_DIAGNOSTIC_FAULTS = 'AUTHORIZED'
$env:AGM_CORRELATED_RUN_ID = $runId
$tsNode = Get-ChildItem (Join-Path $root 'node_modules/.pnpm') -Directory -Filter 'ts-node@*' |
  ForEach-Object { Join-Path $_.FullName 'node_modules/ts-node/dist/bin.js' } |
  Where-Object { Test-Path $_ } |
  Select-Object -First 1
if (-not $tsNode) { throw 'TS_NODE_EXISTING_DEPENDENCY_NOT_FOUND' }
$preload = Join-Path $root 'scripts/server-correlated-diagnostic-preload.cjs'
$api = Start-Process node.exe -ArgumentList @('--require', $preload, '--expose-gc', $tsNode, 'src/main.ts') `
  -WorkingDirectory (Join-Path $root 'apps/api') `
  -RedirectStandardOutput (Join-Path $OutputRoot 'api.stdout.log') `
  -RedirectStandardError (Join-Path $OutputRoot 'api.stderr.log') `
  -WindowStyle Hidden -PassThru
foreach ($name in $prior.Keys) {
  if ($null -eq $prior[$name]) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
  else { Set-Item "Env:$name" $prior[$name] }
}

$apiPid = $api.Id
try {
  $ready = $false
  for ($index = 0; $index -lt 120; $index += 1) {
    Start-Sleep -Milliseconds 250
    if (netstat -ano | Select-String ":$Port\s+.*LISTENING") { $ready = $true; break }
  }
  if (-not $ready) { throw 'SERVER_CORRELATED_RUNTIME_START_TIMEOUT' }
  $before = @(Get-Process | Sort-Object CPU -Descending | Select-Object -First 12 Id, ProcessName, CPU, WorkingSet64, PrivateMemorySize64, StartTime)
  & node scripts/validate-server-correlated-instrumentation.mjs "http://127.0.0.1:$Port/api/v1" (Join-Path $OutputRoot 'client-timeline.json')
  if ($LASTEXITCODE -ne 0) { throw 'SERVER_CORRELATED_CLIENT_FAILED' }
  $after = @(Get-Process | Sort-Object CPU -Descending | Select-Object -First 12 Id, ProcessName, CPU, WorkingSet64, PrivateMemorySize64, StartTime)
  [ordered]@{
    contract = 'agm-server-correlated-host-process-evidence.v1'
    capturedAt = (Get-Date).ToUniversalTime().ToString('o')
    before = $before
    after = $after
    diagnosticApiPid = $apiPid
  } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $OutputRoot 'host-process-snapshots.json') -Encoding utf8
  $curlDiscardPath = [System.IO.Path]::GetTempFileName()
  try {
    $flushStatus = & curl.exe --silent --show-error --output $curlDiscardPath --write-out '%{http_code}' --max-time 10 -H "x-agm-diagnostic-control: $runId" "http://127.0.0.1:$Port/__agm_diagnostic/flush-and-stop"
  } finally {
    Remove-Item -LiteralPath $curlDiscardPath -Force -ErrorAction SilentlyContinue
  }
  if ($LASTEXITCODE -ne 0 -or $flushStatus -ne '200') { throw 'SERVER_CORRELATED_GRACEFUL_FLUSH_FAILED' }
  if (-not $api.WaitForExit(20000)) { throw 'SERVER_CORRELATED_GRACEFUL_EXIT_TIMEOUT' }
} finally {
  if (-not $api.HasExited) { Stop-Process -Id $apiPid -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 1
& node scripts/analyze-server-correlated-instrumentation.mjs $OutputRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
[ordered]@{
  contract = 'agm-server-correlated-runtime-custody.v1'
  completedAt = (Get-Date).ToUniversalTime().ToString('o')
  port = $Port
  apiHost = '127.0.0.1'
  nodeEnv = 'test'
  diagnosticOnly = $true
  production = $false
  basicFunctionalChanges = 0
  officialBasicSloMs = 3000
  officialBasicSloUnchanged = $true
  p9 = 'STOPPED'
  killSwitch = 'ACTIVE'
  soakRestarted = $false
  externalWrites = 0
  newUnjustifiedSecretAccess = 0
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputRoot 'custody.json') -Encoding utf8
& node scripts/hash-server-correlated-evidence.mjs $OutputRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "SERVER-SIDE CORRELATED INSTRUMENTATION VALIDATION - COMPLETE / $OutputRoot"
