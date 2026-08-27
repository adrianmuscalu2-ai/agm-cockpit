param(
  [Parameter(Mandatory=$true)][ValidateSet('CustodyProbe','SlackReadRegression','ControlledWrite')][string]$Operation,
  [string]$SecretPath = "$env:LOCALAPPDATA\AGM\secrets\slack-bot-token.dpapi"
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $SecretPath -PathType Leaf)) { throw 'SLACK_BOT_TOKEN_CUSTODY_MISSING' }
$encrypted = [IO.File]::ReadAllText($SecretPath, [Text.Encoding]::UTF8).Trim()
$secure = ConvertTo-SecureString -String $encrypted
$pointer = [IntPtr]::Zero
$plain = $null
try {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ($plain -notmatch '^xoxb-[A-Za-z0-9-]+$') { throw 'SLACK_BOT_TOKEN_DECRYPTION_FAILED' }
  [Environment]::SetEnvironmentVariable('SLACK_BOT_TOKEN',$plain,'Process')
  switch ($Operation) {
    'CustodyProbe' { & "$PSScriptRoot\Test-AGM-SlackPersistentRuntimeProbe.ps1" }
    'SlackReadRegression' { & 'C:\Program Files\nodejs\pnpm.CMD' --filter '@agm/web' test:agma-slack-readonly:real }
    'ControlledWrite' { & 'C:\Program Files\nodejs\pnpm.CMD' --filter '@agm/web' run:first-real-slack-write }
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  [Environment]::SetEnvironmentVariable('SLACK_BOT_TOKEN',$null,'Process')
  $plain=$null; $encrypted=$null
  if ($null -ne $secure) { $secure.Dispose() }
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
