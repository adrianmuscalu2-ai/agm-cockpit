$ErrorActionPreference='Stop'
$root=Join-Path ([IO.Path]::GetTempPath()) ('agm-slack-custody-'+[guid]::NewGuid().ToString('N'))
$path=Join-Path $root 'slack-bot-token.dpapi'
$dummy1='xoxb-dummy-persistent-'+[guid]::NewGuid().ToString('N')
$dummy2='xoxb-dummy-rotated-'+[guid]::NewGuid().ToString('N')
try {
  & "$PSScriptRoot\Set-AGM-SlackBotToken.ps1" -Token (ConvertTo-SecureString $dummy1 -AsPlainText -Force) -SecretPath $path
  if (!(Test-Path -LiteralPath $path)) { throw 'SAVE_FAILED' }
  if ([IO.File]::ReadAllText($path).Contains($dummy1)) { throw 'PLAINTEXT_PERSISTED' }
  & 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -ExecutionPolicy Bypass -File "$PSScriptRoot\Invoke-AGM-WithSlackBotToken.ps1" -Operation CustodyProbe -SecretPath $path
  if ($LASTEXITCODE -ne 0) { throw 'RESTART_READ_FAILED' }
  if (![string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable('SLACK_BOT_TOKEN','Process'))) { throw 'PARENT_PROCESS_EXPOSED' }
  & "$PSScriptRoot\Set-AGM-SlackBotToken.ps1" -Token (ConvertTo-SecureString $dummy2 -AsPlainText -Force) -SecretPath $path
  if ([IO.File]::ReadAllText($path).Contains($dummy1) -or [IO.File]::ReadAllText($path).Contains($dummy2)) { throw 'ROTATION_PLAINTEXT_EXPOSURE' }
  & "$PSScriptRoot\Invoke-AGM-WithSlackBotToken.ps1" -Operation CustodyProbe -SecretPath $path
  & "$PSScriptRoot\Remove-AGM-SlackBotToken.ps1" -SecretPath $path
  if (Test-Path -LiteralPath $path) { throw 'REVOCATION_FAILED' }
  try { & "$PSScriptRoot\Invoke-AGM-WithSlackBotToken.ps1" -Operation CustodyProbe -SecretPath $path; throw 'MISSING_SECRET_NOT_DENIED' } catch { if ($_.Exception.Message -eq 'MISSING_SECRET_NOT_DENIED') { throw } }
  'PERSISTENT SECRET PATH - PASS'
} finally {
  $dummy1=$null;$dummy2=$null
  [Environment]::SetEnvironmentVariable('SLACK_BOT_TOKEN',$null,'Process')
  if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
