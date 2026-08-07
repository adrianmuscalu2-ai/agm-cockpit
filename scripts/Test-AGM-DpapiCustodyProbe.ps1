$ErrorActionPreference = 'Stop'
$token = [Environment]::GetEnvironmentVariable('HCLOUD_TOKEN', 'Process')
if ([string]::IsNullOrWhiteSpace($token)) { throw 'TEMPORARY_INJECTION_MISSING' }
if ($token.Length -lt 32) { throw 'TEMPORARY_INJECTION_INVALID' }
'Temporary HCLOUD_TOKEN injection: PASS'
$token = $null
