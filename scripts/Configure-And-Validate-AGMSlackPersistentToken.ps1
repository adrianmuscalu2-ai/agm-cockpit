$ErrorActionPreference='Stop'
$secureToken=$null
try {
  $secureToken=Read-Host 'Introdu SLACK_BOT_TOKEN o singura data (masked)' -AsSecureString
  & "$PSScriptRoot\Set-AGM-SlackBotToken.ps1" -Token $secureToken
  $secureToken=$null
  Write-Host 'PERSISTENT GUARDIAN - SECRET CONFIGURED'
  & 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\Invoke-AGM-WithSlackBotToken.ps1" -Operation CustodyProbe
  if ($LASTEXITCODE -ne 0) { throw 'RESTART_CUSTODY_PROBE_FAILED' }
  & 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\Invoke-AGM-WithSlackBotToken.ps1" -Operation SlackReadRegression
  if ($LASTEXITCODE -ne 0) { throw 'PERSISTENT_SLACK_READ_FAILED' }
  & 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\Invoke-AGM-WithSlackBotToken.ps1" -Operation ControlledWrite
  if ($LASTEXITCODE -ne 0) { throw 'PERSISTENT_CONTROLLED_WRITE_FAILED' }
  Write-Host 'PERSISTENT GUARDIAN - REAL VALIDATION COMPLETE'
} catch {
  $safe=$_.Exception.Message -replace 'xox[baprs]-[A-Za-z0-9-]+','[REDACTED]'
  Write-Host "PERSISTENT GUARDIAN - FAILED / $safe" -ForegroundColor Red
} finally {
  if ($null -ne $secureToken) { $secureToken.Dispose() }
  [Environment]::SetEnvironmentVariable('SLACK_BOT_TOKEN',$null,'Process')
}
Read-Host 'Proces finalizat. Apasa Enter pentru inchidere'
