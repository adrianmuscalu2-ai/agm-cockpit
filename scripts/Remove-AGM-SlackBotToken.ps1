param([string]$SecretPath = "$env:LOCALAPPDATA\AGM\secrets\slack-bot-token.dpapi")
$ErrorActionPreference='Stop'
if (Test-Path -LiteralPath $SecretPath) { Remove-Item -LiteralPath $SecretPath -Force; 'SLACK BOT TOKEN CUSTODY - REMOVED' }
else { 'SLACK BOT TOKEN CUSTODY - ALREADY MISSING' }
