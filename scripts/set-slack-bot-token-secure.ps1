$ErrorActionPreference = 'Stop'
$completed = $false
$secureToken = $null
$tokenPointer = [IntPtr]::Zero
$plainToken = $null
try {
  $secureToken = Read-Host 'Introdu SLACK_BOT_TOKEN (valoarea ramane mascata)' -AsSecureString
  $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
  $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  if ([string]::IsNullOrWhiteSpace($plainToken)) {
    throw 'Secretul nu poate fi gol.'
  }
  if ($plainToken -notmatch '^xoxb-[A-Za-z0-9-]+$') {
    throw 'SLACK_TOKEN_FORMAT_REJECTED_NON_ASCII_OR_EXTRA_CHARACTERS'
  }
  if ($plainToken -match '[\r\n\s]') {
    throw 'SLACK_TOKEN_FORMAT_REJECTED_WHITESPACE'
  }
  $env:SLACK_BOT_TOKEN = $plainToken
  Write-Host 'GUARDIAN LOCAL CHANNEL - SECRET PRESENT'
  do {
    & 'C:\Program Files\nodejs\pnpm.CMD' --filter '@agm/web' test:agma-slack-readonly:real
    if ($LASTEXITCODE -eq 0) {
      $completed = $true
      Write-Host 'GUARDIAN LOCAL CHANNEL - REAL PROBE COMPLETE'
      break
    }
    Write-Host "GUARDIAN LOCAL CHANNEL - PROBE FAILED / EXIT_$LASTEXITCODE" -ForegroundColor Red
    $retry = Read-Host 'Secretul ramane activ. Apasa R pentru rerun dupa fix sau Q pentru inchidere'
  } while ($retry -match '^[Rr]$')
} catch {
  $safeCause = $_.Exception.Message -replace 'xox[baprs]-[A-Za-z0-9-]+', '[REDACTED]'
  Write-Host "GUARDIAN LOCAL CHANNEL - PROBE FAILED / $safeCause" -ForegroundColor Red
} finally {
  if ($tokenPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
  }
  $plainToken = $null
  Remove-Item Env:SLACK_BOT_TOKEN -ErrorAction SilentlyContinue
  if ($null -ne $secureToken) {
    $secureToken.Dispose()
  }
}
if ($completed) {
  Read-Host 'Proba s-a terminat. Apasa Enter pentru inchidere'
} else {
  Read-Host 'Procesul ramane activ dupa eroare. Noteaza cauza sanitizata si apasa Enter pentru inchidere'
}
