[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$aabPath = Join-Path $repoRoot 'apps\web\android\app\build\outputs\bundle\release\app-release.aab'
$runnerSource = Join-Path $repoRoot 'apps\web\android\tools\SecureBundletoolRunner.java'
$gradleRoot = Join-Path $repoRoot 'apps\web\android'
$gradleWrapper = Join-Path $gradleRoot 'gradlew.bat'
$gradleInitScript = Join-Path $gradleRoot 'tools\secure-bundletool.init.gradle'
$keystorePath = Join-Path $env:LOCALAPPDATA 'AGM\secrets\android\agm-release.p12'
$artifactRoot = Join-Path $env:LOCALAPPDATA 'AGM\artifacts\android-release-device'
$classesRoot = Join-Path $env:LOCALAPPDATA 'AGM\tools\secure-bundletool\classes'
$statusPath = Join-Path $env:LOCALAPPDATA 'AGM\state\secure-bundletool-status.json'
$apksPath = Join-Path $artifactRoot 'agm-1.4.0-22-production.apks'
$aapt2Path = Join-Path $env:LOCALAPPDATA 'Android\Sdk\build-tools\36.1.0\aapt2.exe'
$expectedFingerprint = '6E:18:2B:67:BD:A9:E4:C4:F6:EE:93:D7:95:F6:19:AF:06:88:D3:96:7F:9B:74:B5:37:9A:42:FE:67:AC:C8:C1'
$alias = 'agm-release'
$javaHome = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { 'C:\Program Files\Android\Android Studio\jbr' }
$javac = Join-Path $javaHome 'bin\javac.exe'

function Write-SanitizedStatus {
    param(
        [Parameter(Mandatory)][string]$State,
        [Parameter(Mandatory)][string]$ErrorCode
    )

    $status = [ordered]@{
        state = $State
        error = $ErrorCode
        secretsPrinted = $false
        keystoreMutation = 'NONE'
        aabMutation = 'NONE'
    }
    $status | ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding UTF8
}

$bundletoolJar = Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE '.gradle\caches\modules-2\files-2.1\com.android.tools.build\bundletool') -Recurse -File -Filter 'bundletool-*.jar' |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $bundletoolJar) { throw 'SECURE_BUNDLETOOL_JAR_NOT_FOUND' }
if (-not (Test-Path -LiteralPath $aabPath -PathType Leaf)) { throw 'SECURE_BUNDLETOOL_AAB_NOT_FOUND' }
if (-not (Test-Path -LiteralPath $runnerSource -PathType Leaf)) { throw 'SECURE_BUNDLETOOL_RUNNER_NOT_FOUND' }
if (-not (Test-Path -LiteralPath $gradleWrapper -PathType Leaf)) { throw 'SECURE_BUNDLETOOL_GRADLE_WRAPPER_NOT_FOUND' }
if (-not (Test-Path -LiteralPath $gradleInitScript -PathType Leaf)) { throw 'SECURE_BUNDLETOOL_GRADLE_INIT_NOT_FOUND' }
if (-not (Test-Path -LiteralPath $javac -PathType Leaf)) { throw 'SECURE_BUNDLETOOL_JAVAC_NOT_FOUND' }
if (-not (Test-Path -LiteralPath $aapt2Path -PathType Leaf)) { throw 'SECURE_BUNDLETOOL_AAPT2_NOT_FOUND' }
if (-not (Test-Path -LiteralPath $keystorePath -PathType Leaf)) { throw 'SECURE_BUNDLETOOL_KEYSTORE_NOT_FOUND' }

New-Item -ItemType Directory -Force -Path $artifactRoot, $classesRoot, (Split-Path -Parent $statusPath) | Out-Null
Write-SanitizedStatus -State 'AWAITING_LOCAL_SECRET_INPUT' -ErrorCode 'NONE'

$storeBstr = [IntPtr]::Zero
$keyBstr = [IntPtr]::Zero
$storeSecure = $null
$keySecure = $null
$storePassword = $null
$keyPassword = $null

try {
    $storeSecure = Read-Host 'AGM Production PKCS12 keystore/key password (same configured value)' -AsSecureString
    $storeBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($storeSecure)
    $storePassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($storeBstr)
    $keyPassword = $storePassword

    $env:AGM_ANDROID_RELEASE_STORE_PASSWORD = $storePassword
    $env:AGM_ANDROID_RELEASE_KEY_PASSWORD = $keyPassword
    $env:AGM_SECURE_BUNDLETOOL_CLASSES = $classesRoot
    $env:AGM_SECURE_BUNDLE_PATH = $aabPath
    $env:AGM_SECURE_BUNDLE_OUTPUT = $apksPath
    $env:AGM_SECURE_BUNDLETOOL_KEYSTORE = $keystorePath
    $env:AGM_SECURE_BUNDLETOOL_ALIAS = $alias
    $env:AGM_SECURE_BUNDLETOOL_FINGERPRINT = $expectedFingerprint
    $env:AGM_SECURE_BUNDLETOOL_STATUS = $statusPath
    $env:AGM_SECURE_BUNDLETOOL_AAPT2 = $aapt2Path

    & $javac -encoding UTF-8 -cp $bundletoolJar -d $classesRoot $runnerSource
    if ($LASTEXITCODE -ne 0) { throw 'SECURE_BUNDLETOOL_RUNNER_COMPILE_FAILED' }

    Push-Location $gradleRoot
    try {
        & $gradleWrapper --no-daemon --console=plain -q -I $gradleInitScript secureBundletoolRun
        if ($LASTEXITCODE -ne 0) { throw 'SECURE_BUNDLETOOL_EXECUTION_FAILED' }
    }
    finally {
        Pop-Location
    }

    Write-Host 'SECURE_BUNDLETOOL=PASS'
    Write-Host "APK_SET=$apksPath"
    Write-Host 'SECRETS_PRINTED=false'
}
finally {
    Remove-Item Env:AGM_ANDROID_RELEASE_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:AGM_ANDROID_RELEASE_KEY_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:AGM_SECURE_BUNDLETOOL_CLASSES -ErrorAction SilentlyContinue
    Remove-Item Env:AGM_SECURE_BUNDLE_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:AGM_SECURE_BUNDLE_OUTPUT -ErrorAction SilentlyContinue
    Remove-Item Env:AGM_SECURE_BUNDLETOOL_KEYSTORE -ErrorAction SilentlyContinue
    Remove-Item Env:AGM_SECURE_BUNDLETOOL_ALIAS -ErrorAction SilentlyContinue
    Remove-Item Env:AGM_SECURE_BUNDLETOOL_FINGERPRINT -ErrorAction SilentlyContinue
    Remove-Item Env:AGM_SECURE_BUNDLETOOL_STATUS -ErrorAction SilentlyContinue
    Remove-Item Env:AGM_SECURE_BUNDLETOOL_AAPT2 -ErrorAction SilentlyContinue

    if ($storeBstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($storeBstr)
    }
    if ($keyBstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyBstr)
    }

    $storePassword = $null
    $keyPassword = $null
    $storeSecure = $null
    $keySecure = $null
}
