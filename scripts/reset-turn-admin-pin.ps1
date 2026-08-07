$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'

if (-not (Test-Path -LiteralPath $envFile)) {
  throw 'Fișierul local .env nu a fost găsit.'
}

$databaseLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $databaseLine) {
  throw 'DATABASE_URL nu este configurat în .env.'
}
$env:DATABASE_URL = $databaseLine.Substring('DATABASE_URL='.Length).Trim().Trim('"').Trim("'")

$first = Read-Host 'Introduceți noul PIN AGM' -AsSecureString
$second = Read-Host 'Confirmați noul PIN AGM' -AsSecureString
$firstPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
$secondPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
try {
  $firstText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPtr)
  $secondText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPtr)
  if ($firstText -cne $secondText) { throw 'PIN-urile introduse nu coincid.' }
  $result = $firstText | node (Join-Path $PSScriptRoot 'reset-turn-admin-pin.mjs')
  if ($result -ne 'PIN_RESET_OK') { throw 'Resetarea PIN-ului nu a fost confirmată.' }
  Write-Host 'PIN-ul AGM a fost resetat. Puteți închide această fereastră.' -ForegroundColor Green
} finally {
  if ($firstPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPtr) }
  if ($secondPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPtr) }
  $firstText = $null
  $secondText = $null
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}

Read-Host 'Apăsați Enter pentru închidere'
