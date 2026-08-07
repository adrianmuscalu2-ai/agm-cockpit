param(
  [Security.SecureString]$Token,
  [string]$SecretPath = "$env:LOCALAPPDATA\AGM\secrets\hcloud-token.dpapi"
)

$ErrorActionPreference = 'Stop'
if ($null -eq $Token) { $Token = Read-Host 'HCLOUD_TOKEN' -AsSecureString }
if ($Token.Length -lt 32) { throw 'HCLOUD_TOKEN_FORMAT_INVALID' }

$directory = Split-Path -Parent $SecretPath
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
if ($null -eq $currentIdentity.User) { throw 'WINDOWS_IDENTITY_UNAVAILABLE' }
$account = $currentIdentity.Name

function Protect-Path([string]$Path, [bool]$Container) {
  & icacls.exe $Path /inheritance:r | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'ACL_INHERITANCE_PROTECTION_FAILED' }
  $grant = if ($Container) { "${account}:(OI)(CI)F" } else { "${account}:F" }
  & icacls.exe $Path /grant:r $grant | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'ACL_CURRENT_USER_GRANT_FAILED' }
}

Protect-Path $directory $true
$encrypted = ConvertFrom-SecureString -SecureString $Token
$temporaryPath = Join-Path $directory ('.hcloud-token.' + [guid]::NewGuid().ToString('N') + '.tmp')
try {
  [IO.File]::WriteAllText($temporaryPath, $encrypted, [Text.UTF8Encoding]::new($false))
  Protect-Path $temporaryPath $false
  Move-Item -LiteralPath $temporaryPath -Destination $SecretPath -Force
  Protect-Path $SecretPath $false
  'HCLOUD_TOKEN custody: CONFIGURED'
} finally {
  $encrypted = $null
  $Token.Dispose()
  if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }
}
