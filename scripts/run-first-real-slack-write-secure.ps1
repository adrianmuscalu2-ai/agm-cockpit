$ErrorActionPreference = 'Stop'
$secureToken = $null
$tokenPointer = [IntPtr]::Zero
$plainToken = $null
try {
  $secureToken = Read-Host 'Introdu noul SLACK_BOT_TOKEN (mascat)' -AsSecureString
  $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
  $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  if ($plainToken -notmatch '^xoxb-[A-Za-z0-9-]+$' -or $plainToken -match '[\r\n\s]') { throw 'SLACK_TOKEN_FORMAT_REJECTED' }
  $env:SLACK_BOT_TOKEN = $plainToken
  Write-Host 'GUARDIAN - SECRET PRESENT'
  & 'C:\Program Files\nodejs\pnpm.CMD' --filter '@agm/web' exec tsx scripts/run-first-real-slack-write.ts
  if ($LASTEXITCODE -ne 0) { throw "REAL_WRITE_GATE_EXIT_$LASTEXITCODE" }
  Write-Host 'GUARDIAN - REAL WRITE GATE COMPLETE'
} catch {
  $safeCause = $_.Exception.Message -replace 'xox[baprs]-[A-Za-z0-9-]+', '[REDACTED]'
  Write-Host "GUARDIAN - WRITE GATE FAILED / $safeCause" -ForegroundColor Red
} finally {
  Remove-Item Env:SLACK_BOT_TOKEN -ErrorAction SilentlyContinue
  $plainToken = $null
  if ($tokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer) }
  if ($null -ne $secureToken) { $secureToken.Dispose() }
}
Read-Host 'Proces finalizat. Apasa Enter pentru inchidere'
