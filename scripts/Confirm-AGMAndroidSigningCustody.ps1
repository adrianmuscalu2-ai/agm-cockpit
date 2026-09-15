[CmdletBinding()]
param(
    [string]$SecretPath = (Join-Path $env:LOCALAPPDATA 'AGM\secrets\android\agm-release-password.dpapi'),
    [string]$KeystorePath = (Join-Path $env:LOCALAPPDATA 'AGM\secrets\android\agm-release.p12'),
    [string]$ExpectedCertificateSha256 = '6E:18:2B:67:BD:A9:E4:C4:F6:EE:93:D7:95:F6:19:AF:06:88:D3:96:7F:9B:74:B5:37:9A:42:FE:67:AC:C8:C1'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $SecretPath -PathType Leaf)) { throw 'AGM_RELEASE_DPAPI_CREDENTIAL_MISSING' }
if (-not (Test-Path -LiteralPath $KeystorePath -PathType Leaf)) { throw 'AGM_RELEASE_KEYSTORE_NOT_FOUND' }

$encryptedPassword = $null
$securePassword = $null
$sha256 = $null

try {
    $encryptedPassword = [IO.File]::ReadAllText($SecretPath, [Text.Encoding]::UTF8).Trim()
    if ([string]::IsNullOrWhiteSpace($encryptedPassword)) { throw 'AGM_RELEASE_DPAPI_CREDENTIAL_EMPTY' }
    try {
        $securePassword = ConvertTo-SecureString -String $encryptedPassword -ErrorAction Stop
    }
    catch {
        throw 'AGM_RELEASE_DPAPI_CREDENTIAL_INVALID'
    }

    $pfxData = Get-PfxData -FilePath $KeystorePath -Password $securePassword
    $certificate = @($pfxData.EndEntityCertificates)[0]
    if ($null -eq $certificate) { throw 'AGM_RELEASE_CERTIFICATE_MISSING' }

    $sha256 = [Security.Cryptography.SHA256]::Create()
    $fingerprint = ($sha256.ComputeHash($certificate.RawData) | ForEach-Object { $_.ToString('X2') }) -join ':'
    if ($fingerprint -ne $ExpectedCertificateSha256.ToUpperInvariant()) { throw 'AGM_RELEASE_CERTIFICATE_FINGERPRINT_MISMATCH' }

    [pscustomobject]@{
        Status = 'CUSTODY_VALIDATED'
        CredentialCustody = 'DPAPI'
        CertificateSha256 = $fingerprint
        SecretDisplayed = $false
        PlaintextMaterialized = $false
    } | ConvertTo-Json -Compress
}
finally {
    if ($sha256) { $sha256.Dispose() }
    if ($securePassword) { $securePassword.Dispose() }
    $encryptedPassword = $null
    $securePassword = $null
}
