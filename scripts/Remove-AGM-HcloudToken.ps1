param([string]$SecretPath = "$env:LOCALAPPDATA\AGM\secrets\hcloud-token.dpapi")

$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $SecretPath) {
  Remove-Item -LiteralPath $SecretPath -Force
  'HCLOUD_TOKEN custody: REMOVED'
} else {
  'HCLOUD_TOKEN custody: ALREADY MISSING'
}
