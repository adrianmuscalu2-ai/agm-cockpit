$ErrorActionPreference = 'Stop'

$sourceEnvPath = 'C:\Users\adria\Documents\AGM\.env'
$spool = 'D:\AGM-ACPM-Isolated-20261115-GPT6Luna'
if (-not (Test-Path -LiteralPath $sourceEnvPath)) { throw 'LOCAL_BASE_ENV_NOT_FOUND' }
if (-not (Test-Path -LiteralPath $spool)) { throw 'ISOLATED_SPOOL_NOT_FOUND' }

$settings = @{}
foreach ($line in Get-Content -LiteralPath $sourceEnvPath) {
  if ($line -match '^\s*([^#=]+)=(.*)$') { $settings[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"') }
}
if ($settings.NODE_ENV -ne 'development') { throw 'LOCAL_BASE_ENV_NOT_DEVELOPMENT' }
$container = @(docker inspect agm-development-postgres | ConvertFrom-Json)[0]
if ($container.NetworkSettings.Ports.'5432/tcp'[0].HostIp -ne '127.0.0.1' -or $container.NetworkSettings.Ports.'5432/tcp'[0].HostPort -ne '55432') { throw 'REHEARSAL_PORT_BINDING_REQUIRED' }
$dbSettings = @{}
foreach ($entry in $container.Config.Env) { $pair = $entry.Split('=', 2); $dbSettings[$pair[0]] = $pair[1] }
$settings.DATABASE_URL = 'postgresql://' + [Uri]::EscapeDataString($dbSettings.POSTGRES_USER) + ':' + [Uri]::EscapeDataString($dbSettings.POSTGRES_PASSWORD) + '@127.0.0.1:55432/agm_cockpit_191_rehearsal'
$databaseUri = [Uri]$settings.DATABASE_URL
if ($databaseUri.Host -notin @('localhost', '127.0.0.1', '::1')) { throw 'DATABASE_TARGET_NOT_LOOPBACK' }

. "$PSScriptRoot\load-openai-test-credential.ps1"
$null = Set-AgmatccOpenAiCredentialFromWindowsCredentialManager

foreach ($name in $settings.Keys) {
  if ($name -notin @('VITE_AGM_API_BASE_URL', 'OPENAI_API_KEY')) {
    [Environment]::SetEnvironmentVariable($name, $settings[$name], 'Process')
  }
}
$env:NODE_ENV = 'development'
$env:API_HOST = '127.0.0.1'
$env:PORT = '3001'
$env:CORS_ALLOWED_ORIGINS = 'http://127.0.0.1:5174'
$env:AGMATCC_COPILOT_ISOLATED_ENABLED = 'true'
$env:AGMATCC_COPILOT_PROVIDER = 'openai'
$env:ACPM_ISOLATED_SPOOL_DIR = $spool
$env:DATABASE_URL = $settings.DATABASE_URL

Write-Output 'Credential target read into this process; secret value suppressed.'
Write-Output 'API binding: 127.0.0.1:3001; database: existing rehearsal 55432, ACPM measurements and authentication only; provider: OpenAI Responses; spool: D: isolated directory.'
Push-Location (Join-Path $PSScriptRoot '..')
try { & pnpm.cmd exec ts-node --transpile-only scripts/start-agmatcc-isolated-local.ts }
finally { Pop-Location }
