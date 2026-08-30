param(
  [string]$TokenPath = (Join-Path $env:LOCALAPPDATA 'AGM\secrets\gmail-oauth-token.dpapi')
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $TokenPath)) { throw 'GMAIL_OAUTH_DPAPI_TOKEN_MISSING' }
$encrypted = [IO.File]::ReadAllText($TokenPath, [Text.Encoding]::UTF8)
$secure = ConvertTo-SecureString $encrypted
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $raw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $bundle = $raw | ConvertFrom-Json
  $env:GMAIL_OAUTH_CLIENT_ID = $bundle.client_id
  $env:GMAIL_OAUTH_CLIENT_SECRET = $bundle.client_secret
  $env:GMAIL_OAUTH_REFRESH_TOKEN = $bundle.refresh_token
  $env:GMAIL_FROM_ADDRESS = $bundle.from_address
  $env:AGM_PRODUCT_OWNER_ALERT_EMAIL = 'agm.transporte.logistik@gmail.com;adrianmuscalu2@gmail.com'
  & pnpm.cmd exec tsx apps/api/scripts/test-source-freshness-email-external.ts
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  $raw = $null
  $bundle = $null
  $secure = $null
  $encrypted = $null
  $env:GMAIL_OAUTH_CLIENT_ID = $null
  $env:GMAIL_OAUTH_CLIENT_SECRET = $null
  $env:GMAIL_OAUTH_REFRESH_TOKEN = $null
  $env:GMAIL_FROM_ADDRESS = $null
  $env:AGM_PRODUCT_OWNER_ALERT_EMAIL = $null
}
