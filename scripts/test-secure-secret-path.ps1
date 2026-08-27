$ErrorActionPreference = 'Stop'
$dummyVariable = 'AGM_SECURE_PATH_DUMMY'
$dummyPlain = $null
$dummySecure = $null
$pointer = [IntPtr]::Zero

try {
  # The production input uses Read-Host -AsSecureString. The dummy follows the
  # same SecureString -> process environment -> zeroized cleanup path without
  # requiring or accepting a real Slack credential.
  $dummyPlain = 'dummy-' + [Guid]::NewGuid().ToString('N')
  $dummySecure = ConvertTo-SecureString $dummyPlain -AsPlainText -Force
  if ($dummySecure -isnot [Security.SecureString]) { throw 'MASKED_INPUT_CONTRACT_FAILED' }
  Write-Host 'input masked - PASS'

  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dummySecure)
  $runtimeSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  Set-Item -LiteralPath "Env:$dummyVariable" -Value $runtimeSecret
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($dummyVariable, 'Process'))) {
    throw 'PROCESS_RUNTIME_SECRET_MISSING'
  }
  Write-Host 'runtime present - PASS'

  $childResult = & 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -Command "if ([string]::IsNullOrWhiteSpace(`$env:$dummyVariable)) { exit 7 } else { 'SAME_SESSION_COMMAND - PASS' }"
  if ($LASTEXITCODE -ne 0 -or $childResult -ne 'SAME_SESSION_COMMAND - PASS') {
    throw 'SAME_SESSION_COMMAND_FAILED'
  }
  Write-Host $childResult
  Write-Host 'process active through command completion - PASS'

  $visibleOutput = @('input masked - PASS','runtime present - PASS',$childResult,'process active through command completion - PASS') -join "`n"
  if ($visibleOutput.Contains($dummyPlain)) { throw 'SECRET_OUTPUT_EXPOSURE' }
  Write-Host 'secret output exposure - ZERO / PASS'
} finally {
  Remove-Item -LiteralPath "Env:$dummyVariable" -ErrorAction SilentlyContinue
  $runtimeSecret = $null
  $dummyPlain = $null
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  if ($null -ne $dummySecure) { $dummySecure.Dispose() }
}

if (-not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($dummyVariable, 'Process'))) {
  throw 'SECRET_CLEANUP_FAILED'
}
Write-Host 'process cleanup - PASS'
Write-Host 'SECURE SECRET PATH - PASS / READY FOR REAL TOKEN'
