param([string]$BundlePath=(Join-Path $PSScriptRoot '..\.tmp\field-test-backend\field-access.dpapi'))
$ErrorActionPreference='Stop'
if(!(Test-Path -LiteralPath $BundlePath)){throw 'FIELD_ACCESS_BUNDLE_NOT_FOUND'}
$secure=ConvertTo-SecureString ((Get-Content -LiteralPath $BundlePath -Raw).Trim())
$pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)|ConvertFrom-Json|Format-Table id,access,token -AutoSize}
finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$secure.Dispose()}
