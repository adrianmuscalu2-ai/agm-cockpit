[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$keystorePath = Join-Path $env:LOCALAPPDATA 'AGM\secrets\android\agm-release.p12'
$androidSdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$statusPath = Join-Path $env:LOCALAPPDATA 'AGM\state\secure-aab-build-status.json'
$alias = 'agm-release'

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $statusPath) | Out-Null
@{ state = 'AWAITING_LOCAL_SECRET_INPUT'; error = 'NONE'; secretsPrinted = $false; keystoreMutation = 'NONE' } |
    ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding UTF8

$passwordBstr = [IntPtr]::Zero
$securePassword = $null
$password = $null
$previousAndroidHome = [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'Process')
$previousAndroidSdkRoot = [Environment]::GetEnvironmentVariable('ANDROID_SDK_ROOT', 'Process')

try {
    if (-not (Test-Path -LiteralPath $keystorePath -PathType Leaf)) { throw 'AGM_RELEASE_KEYSTORE_NOT_FOUND' }
    if (-not (Test-Path -LiteralPath $androidSdkPath -PathType Container)) { throw 'AGM_ANDROID_SDK_NOT_FOUND' }
    $securePassword = Read-Host 'AGM Production PKCS12 keystore/key password' -AsSecureString
    $passwordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordBstr)

    $env:AGM_ANDROID_RELEASE_KEYSTORE = $keystorePath
    $env:AGM_ANDROID_RELEASE_STORE_PASSWORD = $password
    $env:AGM_ANDROID_RELEASE_KEY_ALIAS = $alias
    $env:AGM_ANDROID_RELEASE_KEY_PASSWORD = $password
    $env:ANDROID_HOME = $androidSdkPath
    $env:ANDROID_SDK_ROOT = $androidSdkPath

    Push-Location $repoRoot
    try {
        & pnpm.cmd --filter '@agm/web' android:aab
        if ($LASTEXITCODE -ne 0) { throw 'AGM_RELEASE_AAB_BUILD_FAILED' }
    }
    finally { Pop-Location }

    @{ state = 'PASS'; error = 'NONE'; secretsPrinted = $false; keystoreMutation = 'NONE' } |
        ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding UTF8
    Write-Host 'AGM SIGNED AAB BUILD = PASS' -ForegroundColor Green
}
catch {
    @{ state = 'FAIL'; error = $_.Exception.Message; secretsPrinted = $false; keystoreMutation = 'NONE' } |
        ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding UTF8
    Write-Host ('AGM SIGNED AAB BUILD = FAIL: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
finally {
    Remove-Item Env:AGM_ANDROID_RELEASE_KEYSTORE -ErrorAction SilentlyContinue
    Remove-Item Env:AGM_ANDROID_RELEASE_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:AGM_ANDROID_RELEASE_KEY_ALIAS -ErrorAction SilentlyContinue
    Remove-Item Env:AGM_ANDROID_RELEASE_KEY_PASSWORD -ErrorAction SilentlyContinue
    if ($null -eq $previousAndroidHome) { Remove-Item Env:ANDROID_HOME -ErrorAction SilentlyContinue } else { $env:ANDROID_HOME = $previousAndroidHome }
    if ($null -eq $previousAndroidSdkRoot) { Remove-Item Env:ANDROID_SDK_ROOT -ErrorAction SilentlyContinue } else { $env:ANDROID_SDK_ROOT = $previousAndroidSdkRoot }
    if ($passwordBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordBstr) }
    $password = $null
    $securePassword = $null
}
