[CmdletBinding()]
param(
    [switch]$PersistDpapi
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$keystorePath = Join-Path $env:LOCALAPPDATA 'AGM\secrets\android\agm-release.p12'
$passwordDpapiPath = Join-Path $env:LOCALAPPDATA 'AGM\secrets\android\agm-release-password.dpapi'
$androidSdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$statusPath = Join-Path $env:LOCALAPPDATA 'AGM\state\secure-aab-build-status.json'
$logPath = Join-Path $env:LOCALAPPDATA 'AGM\state\secure-aab-build-sanitized.log'
$alias = 'agm-release'

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $statusPath) | Out-Null
@{
    state = if (Test-Path -LiteralPath $passwordDpapiPath) { 'LOADING_DPAPI_CREDENTIAL' } else { 'AWAITING_LOCAL_SECRET_INPUT' }
    error = 'NONE'
    secretsPrinted = $false
    keystoreMutation = 'NONE'
    credentialCustody = if (Test-Path -LiteralPath $passwordDpapiPath) { 'DPAPI_CONFIGURED' } else { 'PROMPT_REQUIRED' }
} |
    ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding UTF8

$passwordBstr = [IntPtr]::Zero
$securePassword = $null
$password = $null
$encryptedPassword = $null
$dpapiCandidate = $null
$credentialSource = 'PROMPT'
$previousAndroidHome = [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'Process')
$previousAndroidSdkRoot = [Environment]::GetEnvironmentVariable('ANDROID_SDK_ROOT', 'Process')

try {
    if (-not (Test-Path -LiteralPath $keystorePath -PathType Leaf)) { throw 'AGM_RELEASE_KEYSTORE_NOT_FOUND' }
    if (-not (Test-Path -LiteralPath $androidSdkPath -PathType Container)) { throw 'AGM_ANDROID_SDK_NOT_FOUND' }
    if (Test-Path -LiteralPath $passwordDpapiPath -PathType Leaf) {
        $encryptedPassword = [IO.File]::ReadAllText($passwordDpapiPath, [Text.Encoding]::UTF8).Trim()
        if ([string]::IsNullOrWhiteSpace($encryptedPassword)) { throw 'AGM_RELEASE_DPAPI_CREDENTIAL_EMPTY' }
        try {
            $securePassword = ConvertTo-SecureString -String $encryptedPassword -ErrorAction Stop
        }
        catch {
            throw 'AGM_RELEASE_DPAPI_CREDENTIAL_INVALID'
        }
        $credentialSource = 'DPAPI'
    }
    else {
        $securePassword = Read-Host 'AGM Production PKCS12 keystore/key password' -AsSecureString
    }
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
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $buildOutput = & pnpm.cmd --filter '@agm/web' android:aab 2>&1
            $buildExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
        $sanitizedOutput = $buildOutput | ForEach-Object {
            $line = $_.ToString()
            if ($password) { $line = $line.Replace($password, '[REDACTED]') }
            $line
        }
        $sanitizedOutput | Set-Content -LiteralPath $logPath -Encoding UTF8
        $sanitizedOutput | Write-Host
        if ($buildExitCode -ne 0) { throw 'AGM_RELEASE_AAB_BUILD_FAILED' }
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            # Drain Bundletool/Gradle output inside this process. When the secure
            # build is launched from a detached console, forwarding Gradle's
            # live console stream can fill the abandoned pipe after the signed
            # APK set has already been produced and leave the parent status at
            # AWAITING_LOCAL_SECRET_INPUT indefinitely.
            $bundletoolOutput = & (Join-Path $PSScriptRoot 'run-secure-bundletool-local.ps1') -Password $securePassword 2>&1
            $bundletoolExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
        $sanitizedBundletoolOutput = $bundletoolOutput | ForEach-Object {
            $line = $_.ToString()
            if ($password) { $line = $line.Replace($password, '[REDACTED]') }
            $line
        }
        $sanitizedBundletoolOutput | Add-Content -LiteralPath $logPath -Encoding UTF8
        $sanitizedBundletoolOutput | Write-Host
        if ($bundletoolExitCode -ne 0) { throw 'AGM_RELEASE_APK_SET_BUILD_FAILED' }
    }
    finally { Pop-Location }

    if ($PersistDpapi -and $credentialSource -eq 'PROMPT') {
        $dpapiCandidate = $passwordDpapiPath + '.' + [guid]::NewGuid().ToString('N') + '.tmp'
        $encryptedPassword = ConvertFrom-SecureString -SecureString $securePassword
        [IO.File]::WriteAllText($dpapiCandidate, $encryptedPassword, [Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $dpapiCandidate -Destination $passwordDpapiPath -Force
        $dpapiCandidate = $null
        $credentialSource = 'DPAPI_PROVISIONED'
    }

    @{ state = 'PASS'; error = 'NONE'; secretsPrinted = $false; keystoreMutation = 'NONE'; credentialCustody = $credentialSource } |
        ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding UTF8
    Write-Host 'AGM SIGNED AAB BUILD = PASS' -ForegroundColor Green
}
catch {
    if ($dpapiCandidate -and (Test-Path -LiteralPath $dpapiCandidate)) {
        Remove-Item -LiteralPath $dpapiCandidate -Force
    }
    @{ state = 'FAIL'; error = $_.Exception.Message; secretsPrinted = $false; keystoreMutation = 'NONE'; credentialCustody = $credentialSource } |
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
    $encryptedPassword = $null
    $dpapiCandidate = $null
    $securePassword = $null
}
