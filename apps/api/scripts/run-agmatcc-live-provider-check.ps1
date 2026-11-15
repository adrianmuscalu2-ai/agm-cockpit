$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\load-openai-test-credential.ps1"
$null = Set-AgmatccOpenAiCredentialFromWindowsCredentialManager
$env:NODE_ENV = 'development'
$env:AGMATCC_COPILOT_ISOLATED_ENABLED = 'true'
$env:AGMATCC_COPILOT_PROVIDER = 'openai'
$env:ACPM_ISOLATED_SPOOL_DIR = 'D:\AGM-ACPM-Isolated-20261115-GPT6Luna'
Push-Location (Join-Path $PSScriptRoot '..')
try { & pnpm.cmd exec tsx scripts/agmatcc-live-provider-check.ts }
finally { Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue; Pop-Location }
