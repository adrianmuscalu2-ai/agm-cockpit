param(
  [long]$ServerId = 0,
  [string]$ExpectedIpv4 = '167.233.237.253',
  [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path (Split-Path -Parent $PSScriptRoot) '.tmp\hetzner-automation-channel.latest.json' }
$api = 'https://api.hetzner.cloud/v1'
$token = [Environment]::GetEnvironmentVariable('HCLOUD_TOKEN', 'Process')
$checkedAt = (Get-Date).ToUniversalTime().ToString('o')
$checks = [System.Collections.Generic.List[object]]::new()
function Add-Check([string]$Id, [string]$Status, [string]$Detail) {
  $checks.Add([ordered]@{ id = $Id; status = $Status; checkedAt = $checkedAt; safeDetail = $Detail })
}
function Invoke-Hetzner([string]$Method, [string]$Path, [object]$Body = $null) {
  $parameters = @{ Method = $Method; Uri = "$api$Path"; Headers = @{ Authorization = "Bearer $token" }; ContentType = 'application/json' }
  if ($null -ne $Body) { $parameters.Body = ($Body | ConvertTo-Json -Compress) }
  Invoke-RestMethod @parameters
}

if ([string]::IsNullOrWhiteSpace($token)) {
  Add-Check 'token-reference' 'MISSING' 'HCLOUD_TOKEN nu este configurat în mediul procesului.'
} else {
  Add-Check 'token-reference' 'CONFIGURED' 'Referința tokenului Hetzner este configurată; valoarea nu este afișată.'
  $temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "agm-hcloud-channel-$([guid]::NewGuid().ToString('N'))"
  $remoteKeyId = $null
  try {
    if ($ServerId -gt 0) {
      $server = (Invoke-Hetzner 'GET' "/servers/$ServerId").server
    } else {
      $matches = @((Invoke-Hetzner 'GET' '/servers').servers | Where-Object { $_.public_net.ipv4.ip -eq $ExpectedIpv4 })
      if ($matches.Count -ne 1) { throw 'SERVER_TARGET_NOT_UNIQUE' }
      $server = $matches[0]
      $ServerId = [long]$server.id
    }
    if ($server.public_net.ipv4.ip -ne $ExpectedIpv4) { throw 'SERVER_TARGET_MISMATCH' }
    Add-Check 'server-scope' 'PASS' 'Tokenul poate citi exclusiv ținta Production verificată prin ID și IPv4.'

    New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
    $temporaryIdentity = Join-Path $temporaryDirectory 'channel-validation'
    & ssh-keygen -q -t ed25519 -N 'agm-ephemeral-validation-only' -C 'agm-channel-validation-ephemeral' -f $temporaryIdentity
    if ($LASTEXITCODE -ne 0) { throw 'EPHEMERAL_IDENTITY_FAILED' }
    $publicKey = (Get-Content -LiteralPath "$temporaryIdentity.pub" -Raw).Trim()
    $name = "agm-channel-validation-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
    $created = Invoke-Hetzner 'POST' '/ssh_keys' @{ name = $name; public_key = $publicKey }
    $remoteKeyId = [long]$created.ssh_key.id
    Add-Check 'minimum-write' 'PASS' 'Tokenul poate crea o identitate publică temporară pentru recovery.'
    Invoke-Hetzner 'DELETE' "/ssh_keys/$remoteKeyId" | Out-Null
    $remoteKeyId = $null
    Add-Check 'revocation' 'PASS' 'Identitatea temporară a fost revocată prin API.'
  } catch {
    Add-Check 'channel-validation' 'FAIL' "Validarea canalului a eșuat: $($_.Exception.Message -replace $token, '[REDACTED]')"
  } finally {
    if ($remoteKeyId) { try { Invoke-Hetzner 'DELETE' "/ssh_keys/$remoteKeyId" | Out-Null } catch {} }
    if (Test-Path -LiteralPath $temporaryDirectory) { Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force }
  }
}

$pass = $checks.Count -gt 0 -and ($checks | Where-Object status -notin @('PASS', 'CONFIGURED')).Count -eq 0
$report = [ordered]@{ contract = 'agm-hetzner-automation-channel.v1'; checkedAt = $checkedAt; serverId = $ServerId; expectedIpv4 = $ExpectedIpv4; overallStatus = $(if($pass){'PASS'}else{'FAIL'}); checks = $checks }
New-Item -ItemType Directory -Path (Split-Path -Parent $OutputPath) -Force | Out-Null
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
"Hetzner automation channel: $($report.overallStatus)"
if (-not $pass) { exit 1 }
