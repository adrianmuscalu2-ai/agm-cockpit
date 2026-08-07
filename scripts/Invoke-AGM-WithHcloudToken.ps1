param(
  [Parameter(Mandatory = $true)][ValidateSet('ValidateChannel', 'RecoverSsh', 'CustodyProbe')][string]$Operation,
  [long]$ServerId,
  [string]$SecretPath = "$env:LOCALAPPDATA\AGM\secrets\hcloud-token.dpapi",
  [string]$ExpectedIpv4 = '167.233.237.253'
)

$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $SecretPath -PathType Leaf)) { throw 'HCLOUD_TOKEN_CUSTODY_MISSING' }
if ($Operation -eq 'RecoverSsh' -and $ServerId -le 0) { throw 'HETZNER_SERVER_ID_REQUIRED' }

$encrypted = [IO.File]::ReadAllText($SecretPath, [Text.Encoding]::UTF8).Trim()
$secure = ConvertTo-SecureString -String $encrypted
$bstr = [IntPtr]::Zero
$plain = $null
try {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ([string]::IsNullOrWhiteSpace($plain)) { throw 'HCLOUD_TOKEN_DECRYPTION_FAILED' }
  [Environment]::SetEnvironmentVariable('HCLOUD_TOKEN', $plain, 'Process')
  switch ($Operation) {
    'ValidateChannel' { & "$PSScriptRoot\Test-AGM-HetznerAutomationChannel.ps1" -ServerId $ServerId -ExpectedIpv4 $ExpectedIpv4 }
    'RecoverSsh' { & "$PSScriptRoot\Invoke-AGM-HetznerSshRecovery.ps1" -ServerId $ServerId -ExpectedIpv4 $ExpectedIpv4 }
    'CustodyProbe' { & "$PSScriptRoot\Test-AGM-DpapiCustodyProbe.ps1" }
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  [Environment]::SetEnvironmentVariable('HCLOUD_TOKEN', $null, 'Process')
  $plain = $null
  $encrypted = $null
  $secure.Dispose()
  if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
