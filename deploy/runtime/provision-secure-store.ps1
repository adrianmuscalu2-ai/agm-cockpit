$ErrorActionPreference='Stop'
$store=Join-Path $env:LOCALAPPDATA 'AGM\runtime-secrets'
New-Item -ItemType Directory -Force $store | Out-Null
foreach($name in 'GUARDIAN','RELEASE','VALIDATOR') {
  $bytes=New-Object byte[] 48; $rng=New-Object Security.Cryptography.RNGCryptoServiceProvider; $rng.GetBytes($bytes); $rng.Dispose()
  $value=[Convert]::ToBase64String($bytes); $secure=ConvertTo-SecureString $value -AsPlainText -Force
  ConvertFrom-SecureString $secure | Set-Content (Join-Path $store "$name.dpapi") -Encoding ascii
  [Array]::Clear($bytes,0,$bytes.Length); $value=$null; $secure=$null
}
Set-Content (Join-Path $store 'manifest.json') '{"schemaVersion":"agm-secure-store.v1","bindings":{"AGM_SECRET_REF_GUARDIAN":"GUARDIAN.dpapi","AGM_SECRET_REF_RELEASE":"RELEASE.dpapi","AGM_SECRET_REF_VALIDATOR":"VALIDATOR.dpapi"},"valuesRecorded":false}' -Encoding utf8
Write-Output 'SECURE_STORE_PROVISIONED=PASS'
