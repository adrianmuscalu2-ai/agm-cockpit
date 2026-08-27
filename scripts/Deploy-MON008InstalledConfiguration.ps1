[CmdletBinding()]
param(
  [ValidateSet('Apply', 'Rollback')]
  [string]$Mode = 'Apply',
  [string]$ConfigPath = 'C:\ProgramData\AGM\monitor\config.json',
  [string]$BackupPath = 'C:\ProgramData\AGM\monitor\config.pre-mon008-remediation-20260815.json'
)

$ErrorActionPreference = 'Stop'
$oldUrl = 'https://app.agmcockpit.com/'
$newUrl = 'https://app.agmcockpit.com/turn'
$temporaryPath = "$ConfigPath.mon008-admin.tmp"
$transactionBackupPath = "$ConfigPath.mon008-admin-transaction.bak"

function Assert-ElevatedSession {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'FAIL_CLOSED: PowerShell must be opened with Run as administrator.'
  }
}

function Read-ValidatedConfiguration {
  param([string]$Path, [string]$Label)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "FAIL_CLOSED: $Label is missing: $Path"
  }
  $raw = [IO.File]::ReadAllText($Path)
  try { $value = $raw | ConvertFrom-Json } catch { throw "FAIL_CLOSED: $Label is not valid JSON." }
  $matches = @($value.checks | Where-Object { $_.id -eq 'browser-public' })
  if ($matches.Count -ne 1) {
    throw "FAIL_CLOSED: MON-008/browser-public must occur exactly once in $Label."
  }
  if ($matches[0].PSObject.Properties['monitorCode'] -and $matches[0].monitorCode -ne 'MON-008') {
    throw "FAIL_CLOSED: browser-public has an incompatible monitorCode in $Label."
  }
  return [pscustomobject]@{ Raw = $raw; Value = $value; Check = $matches[0] }
}

function ConvertTo-CanonicalJson {
  param([object]$Value)
  return $Value | ConvertTo-Json -Depth 20 -Compress
}

function Assert-OnlyUrlDifference {
  param([object]$Before, [object]$After, [string]$ExpectedAfterUrl)
  $expected = $Before | ConvertTo-Json -Depth 20 | ConvertFrom-Json
  $expectedCheck = @($expected.checks | Where-Object { $_.id -eq 'browser-public' })
  $expectedCheck[0].url = $ExpectedAfterUrl
  if ((ConvertTo-CanonicalJson $expected) -cne (ConvertTo-CanonicalJson $After)) {
    throw 'FAIL_CLOSED: configuration contains differences outside the authorized MON-008 URL.'
  }
}

function Remove-TransactionFiles {
  foreach ($path in @($temporaryPath, $transactionBackupPath)) {
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
  }
}

Assert-ElevatedSession
$backup = Read-ValidatedConfiguration -Path $BackupPath -Label 'required backup'
$installed = Read-ValidatedConfiguration -Path $ConfigPath -Label 'installed configuration'
$aclBefore = (Get-Acl -LiteralPath $ConfigPath).Sddl

if ($backup.Check.url -ne $oldUrl) {
  throw "FAIL_CLOSED: required backup does not contain the expected old MON-008 URL."
}

if ($Mode -eq 'Apply') {
  if ($installed.Check.url -ne $oldUrl) {
    throw "FAIL_CLOSED: installed MON-008 URL is not the expected old value."
  }
  $occurrences = ([regex]::Matches($installed.Raw, [regex]::Escape($oldUrl))).Count
  if ($occurrences -ne 1) {
    throw 'FAIL_CLOSED: expected old URL must occur exactly once in the installed JSON text.'
  }
  $candidateRaw = $installed.Raw.Replace($oldUrl, $newUrl)
  try { $candidate = $candidateRaw | ConvertFrom-Json } catch { throw 'FAIL_CLOSED: candidate JSON is invalid.' }
  Assert-OnlyUrlDifference -Before $installed.Value -After $candidate -ExpectedAfterUrl $newUrl
} else {
  if ($installed.Check.url -ne $newUrl) {
    throw 'FAIL_CLOSED: rollback requires the installed MON-008 URL to be the new value.'
  }
  Assert-OnlyUrlDifference -Before $backup.Value -After $installed.Value -ExpectedAfterUrl $newUrl
  $candidateRaw = $backup.Raw
  $candidate = $backup.Value
}

Remove-TransactionFiles
[IO.File]::WriteAllText($temporaryPath, $candidateRaw, [Text.UTF8Encoding]::new($false))
$temporaryValidation = Read-ValidatedConfiguration -Path $temporaryPath -Label 'transaction candidate'
$expectedUrl = if ($Mode -eq 'Apply') { $newUrl } else { $oldUrl }
if ($temporaryValidation.Check.url -ne $expectedUrl) {
  Remove-TransactionFiles
  throw 'FAIL_CLOSED: transaction candidate URL validation failed.'
}

try {
  [IO.File]::Replace($temporaryPath, $ConfigPath, $transactionBackupPath, $true)
  $post = Read-ValidatedConfiguration -Path $ConfigPath -Label 'post-write installed configuration'
  if ($post.Check.url -ne $expectedUrl) { throw 'Post-write URL validation failed.' }
  if ((Get-Acl -LiteralPath $ConfigPath).Sddl -cne $aclBefore) { throw 'Post-write ACL changed.' }
  if ($Mode -eq 'Apply') {
    Assert-OnlyUrlDifference -Before $installed.Value -After $post.Value -ExpectedAfterUrl $newUrl
  } else {
    if ((ConvertTo-CanonicalJson $post.Value) -cne (ConvertTo-CanonicalJson $backup.Value)) {
      throw 'Rollback content does not match the required backup.'
    }
  }
} catch {
  $failure = $_.Exception.Message
  if (Test-Path -LiteralPath $transactionBackupPath) {
    if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }
    [IO.File]::Replace($transactionBackupPath, $ConfigPath, $temporaryPath, $true)
    if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }
  }
  throw "FAIL_CLOSED: deployment validation failed and rollback was executed. Cause: $failure"
} finally {
  Remove-TransactionFiles
}

[ordered]@{
  verdict = "MON-008 INSTALLED CONFIGURATION $($Mode.ToUpperInvariant()) - PASS"
  configPath = $ConfigPath
  checkId = 'browser-public'
  monitorCode = 'MON-008'
  url = $expectedUrl
  jsonValid = $true
  onlyAuthorizedDifference = $true
  aclUnchanged = $true
  backupSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $BackupPath).Hash
  appliedAt = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json
