$ErrorActionPreference = 'Stop'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('agm-dpapi-custody-' + [guid]::NewGuid().ToString('N'))
$secretPath = Join-Path $testRoot 'hcloud-token.dpapi'
$fakeValue = 'AGM_TEST_TOKEN_NOT_VALID_' + ('x' * 40)
$secure = ConvertTo-SecureString -String $fakeValue -AsPlainText -Force
try {
  & "$PSScriptRoot\Set-AGM-HcloudToken.ps1" -Token $secure -SecretPath $secretPath
  if (!(Test-Path -LiteralPath $secretPath)) { throw 'DPAPI_FILE_MISSING' }
  $stored = [IO.File]::ReadAllText($secretPath, [Text.Encoding]::UTF8)
  if ($stored.Contains($fakeValue)) { throw 'PLAINTEXT_SECRET_PERSISTED' }
  & "$PSScriptRoot\Invoke-AGM-WithHcloudToken.ps1" -Operation CustodyProbe -SecretPath $secretPath
  if (![string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable('HCLOUD_TOKEN', 'Process'))) { throw 'PROCESS_ENV_NOT_CLEARED' }
  & "$PSScriptRoot\Remove-AGM-HcloudToken.ps1" -SecretPath $secretPath
  if (Test-Path -LiteralPath $secretPath) { throw 'DPAPI_FILE_NOT_REMOVED' }
  'DPAPI custody lifecycle: PASS'
} finally {
  $fakeValue = $null
  $secure = $null
  [Environment]::SetEnvironmentVariable('HCLOUD_TOKEN', $null, 'Process')
  if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
