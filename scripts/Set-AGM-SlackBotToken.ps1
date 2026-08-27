param(
  [Security.SecureString]$Token,
  [string]$SecretPath = "$env:LOCALAPPDATA\AGM\secrets\slack-bot-token.dpapi"
)
$ErrorActionPreference = 'Stop'
if ($null -eq $Token) { $Token = Read-Host 'SLACK_BOT_TOKEN (masked)' -AsSecureString }
$pointer = [IntPtr]::Zero
$plain = $null
try {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Token)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ($plain -notmatch '^xoxb-[A-Za-z0-9-]+$' -or $plain -match '[\r\n\s]') { throw 'SLACK_BOT_TOKEN_FORMAT_INVALID' }
  $directory = Split-Path -Parent $SecretPath
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  if ($null -eq $identity.User) { throw 'WINDOWS_IDENTITY_UNAVAILABLE' }
  $account = $identity.Name
  & icacls.exe $directory /inheritance:r /grant:r "${account}:(OI)(CI)F" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'SECRET_DIRECTORY_ACL_FAILED' }
  $encrypted = ConvertFrom-SecureString -SecureString $Token
  $temporaryPath = Join-Path $directory ('.slack-token.' + [guid]::NewGuid().ToString('N') + '.tmp')
  [IO.File]::WriteAllText($temporaryPath, $encrypted, [Text.UTF8Encoding]::new($false))
  & icacls.exe $temporaryPath /inheritance:r /grant:r "${account}:F" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'SECRET_FILE_ACL_FAILED' }
  Move-Item -LiteralPath $temporaryPath -Destination $SecretPath -Force
  & icacls.exe $SecretPath /inheritance:r /grant:r "${account}:F" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'SECRET_FILE_ACL_FAILED' }
  'SLACK BOT TOKEN CUSTODY - CONFIGURED'
} finally {
  $plain = $null; $encrypted = $null
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  if ($null -ne $Token) { $Token.Dispose() }
  if ($temporaryPath -and (Test-Path -LiteralPath $temporaryPath)) { Remove-Item -LiteralPath $temporaryPath -Force }
}
