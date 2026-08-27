$ErrorActionPreference = 'Stop'
$value = 'agm-p9-windows-powershell-5.1-sha256-regression'
$expected = 'E0B623C20CFA5278397F705A6F6853ECB44EE2787A1C0C52C01C2EE815E7CA19'
$algorithm = [System.Security.Cryptography.SHA256]::Create()
try {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($value)
  $actual = ([BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '').ToUpperInvariant()
} finally {
  $algorithm.Dispose()
}
if ($actual -ne $expected) { throw "WINDOWS_POWERSHELL_51_SHA256_REGRESSION_$actual" }
"WINDOWS POWERSHELL $($PSVersionTable.PSVersion) SHA256 COMPATIBILITY PASS"
