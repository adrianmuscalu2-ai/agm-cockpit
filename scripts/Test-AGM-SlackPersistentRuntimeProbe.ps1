$ErrorActionPreference='Stop'
$value=[Environment]::GetEnvironmentVariable('SLACK_BOT_TOKEN','Process')
if ([string]::IsNullOrWhiteSpace($value)) { throw 'AUTHORIZED_RUNTIME_SECRET_MISSING' }
if ($value -notmatch '^xoxb-[A-Za-z0-9-]+$') { throw 'AUTHORIZED_RUNTIME_SECRET_INVALID' }
'AUTHORIZED AGM RUNTIME READ - PASS'
$value=$null
