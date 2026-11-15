$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$container = @(docker inspect agm-development-postgres | ConvertFrom-Json)[0]
if ($container.NetworkSettings.Ports.'5432/tcp'[0].HostIp -ne '127.0.0.1' -or $container.NetworkSettings.Ports.'5432/tcp'[0].HostPort -ne '55432') { throw 'REHEARSAL_TARGET_MISMATCH' }
$db = @{}
foreach ($entry in $container.Config.Env) { $pair = $entry.Split('=',2); $db[$pair[0]] = $pair[1] }
$env:DATABASE_URL = 'postgresql://' + [Uri]::EscapeDataString($db.POSTGRES_USER) + ':' + [Uri]::EscapeDataString($db.POSTGRES_PASSWORD) + '@127.0.0.1:55432/agm_cockpit_191_rehearsal'
$custody = 'D:\AGM-ACPM-Isolated-20261115-GPT6Luna\rehearsal-test-owner.dpapi'
if (-not (Test-Path -LiteralPath $custody)) {
  function New-LocalSecret { $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); return [Convert]::ToBase64String($bytes) }
  $data = @{ email='pr35-owner@rehearsal.invalid'; password=(New-LocalSecret); pin=(New-LocalSecret); jwt=(New-LocalSecret) }
  $plain = $data | ConvertTo-Json -Compress
  $secure = ConvertTo-SecureString $plain -AsPlainText -Force
  $secure | ConvertFrom-SecureString | Set-Content -LiteralPath $custody
}
$secret = Get-Content -LiteralPath $custody | ConvertTo-SecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try { $data = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) | ConvertFrom-Json }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
$env:SEED_OWNER_EMAIL = $data.email
$env:SEED_OWNER_PASSWORD = $data.password
$env:SEED_OWNER_NAME = 'PR35 Rehearsal Test Owner'
$env:DEFAULT_COMPANY_NAME = 'AGM PR35 Rehearsal Only'
$env:AGM_REHEARSAL_TURN_PIN = $data.pin
$env:AGM_REHEARSAL_OWNER_EMAIL = $data.email
$env:AGM_REHEARSAL_OWNER_PASSWORD = $data.password
$env:JWT_SECRET = $data.jwt
$env:NODE_ENV = 'development'
$env:API_HOST = '127.0.0.1'
$env:PORT = '3001'
$env:PRISMA_CONNECT_ON_BOOT = 'true'
$env:AGMATCC_COPILOT_ISOLATED_ENABLED = 'true'
$env:AGMATCC_COPILOT_PROVIDER = 'openai'
$env:ACPM_ISOLATED_SPOOL_DIR = 'D:\AGM-ACPM-Isolated-20261115-GPT6Luna'
. "$PSScriptRoot\load-openai-test-credential.ps1"
$null = Set-AgmatccOpenAiCredentialFromWindowsCredentialManager
Push-Location $root
try {
  & pnpm.cmd exec tsx prisma/seed/seed.ts
  if ($LASTEXITCODE -ne 0) { throw 'REHEARSAL_OWNER_SEED_FAILED' }
  Push-Location (Join-Path $root 'apps/api')
  try { & pnpm.cmd exec ts-node --transpile-only scripts/run-luna-browser-rehearsal.ts; if ($LASTEXITCODE -ne 0) { throw 'REHEARSAL_BROWSER_RUN_FAILED' } }
  finally { Pop-Location }
} finally { Pop-Location }
