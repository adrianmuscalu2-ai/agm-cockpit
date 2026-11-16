$ErrorActionPreference = 'Stop'
$container = @(docker inspect agm-development-postgres | ConvertFrom-Json)[0]
if ($container.NetworkSettings.Ports.'5432/tcp'[0].HostIp -ne '127.0.0.1' -or $container.NetworkSettings.Ports.'5432/tcp'[0].HostPort -ne '55432') { throw 'WRONG_REHEARSAL' }
$db = @{}
foreach ($entry in $container.Config.Env) { $pair = $entry.Split('=',2); $db[$pair[0]] = $pair[1] }
$env:DATABASE_URL = 'postgresql://' + [Uri]::EscapeDataString($db.POSTGRES_USER) + ':' + [Uri]::EscapeDataString($db.POSTGRES_PASSWORD) + '@127.0.0.1:55432/agm_cockpit_191_rehearsal'
# Reuse custody only; never provision, reseed, reset, rotate or print credentials.
$secret = Get-Content -LiteralPath 'D:/AGM-ACPM-Isolated-20261115-GPT6Luna/rehearsal-test-owner.dpapi' | ConvertTo-SecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try { $data = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) | ConvertFrom-Json }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
$env:AGM_REHEARSAL_OWNER_EMAIL = $data.email
$env:AGM_REHEARSAL_OWNER_PASSWORD = $data.password
$env:AGM_REHEARSAL_TURN_PIN = $data.pin
$env:JWT_SECRET = $data.jwt
$env:NODE_ENV = 'development'
$env:API_HOST = '127.0.0.1'
$env:PRISMA_CONNECT_ON_BOOT = 'true'
$env:AGMATCC_COPILOT_ISOLATED_ENABLED = 'true'
$env:AGMATCC_COPILOT_PROVIDER = 'simulated'
$env:OPENAI_API_KEY = 'LOCAL_ISOLATED_NO_KEY_CONFIG_SENTINEL'
$env:ACPM_ISOLATED_SPOOL_DIR = 'D:\\AGM-ACPM-Isolated-20261115-GPT6Luna'
$env:FUNCTIONAL_EVIDENCE_DIR = 'D:/AGM-ACPM-Isolated-20261115-GPT6Luna/evidence/functional-closure-20261116'
Push-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
try { & pnpm.cmd exec ts-node --transpile-only scripts/test-functional-auth.ts; if ($LASTEXITCODE -ne 0) { throw 'FUNCTIONAL_AUTH_TEST_FAILED' } }
finally { Pop-Location }
