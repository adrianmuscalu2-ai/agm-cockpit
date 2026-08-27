$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'p9-pilot-exit-code-contract.psm1') -Force
$cases = @(
  @{ name='exit-code-zero'; actual=(Resolve-P9RunnerExitOutcome -ProcessCompleted $true -ExitCode 0 -ResultArtifactValid $true); pass=$true; code='EXIT_CODE_ZERO'; exitCode=0 },
  @{ name='nullable-valid-result'; actual=(Resolve-P9RunnerExitOutcome -ProcessCompleted $true -ExitCode $null -ResultArtifactValid $true); pass=$true; code='NULL_EXIT_CODE_WITH_VALID_COMPLETION_EVIDENCE'; exitCode=$null },
  @{ name='nonzero-exact'; actual=(Resolve-P9RunnerExitOutcome -ProcessCompleted $true -ExitCode 23 -ResultArtifactValid $false); pass=$false; code='P9_INTERNAL_RUNNER_EXIT_23'; exitCode=23 },
  @{ name='absent-without-result'; actual=(Resolve-P9RunnerExitOutcome -ProcessCompleted $true -ExitCode $null -ResultArtifactValid $false); pass=$false; code='P9_INTERNAL_RUNNER_EXIT_CODE_ABSENT_WITHOUT_VALID_RESULT'; exitCode=$null }
)
foreach ($case in $cases) {
  if ($case.actual.pass -ne $case.pass -or $case.actual.code -ne $case.code -or $case.actual.exitCode -ne $case.exitCode) { throw "EXIT_CODE_CASE_FAILED_$($case.name)" }
  Write-Output "PASS $($case.name)"
}
$temporary = Join-Path ([System.IO.Path]::GetTempPath()) "p9-exit-contract-$PID.json"
try {
  '{"contract":"agm-p9-internal-pilot-evidence.v2","pid":123,"results":[],"metrics":{"completed":0},"cleanup":{}}' | Set-Content -LiteralPath $temporary -Encoding UTF8
  if (-not (Test-P9RunnerResultArtifact -Path $temporary)) { throw 'VALID_RESULT_REJECTED' }
  '{}' | Set-Content -LiteralPath $temporary -Encoding UTF8
  if (Test-P9RunnerResultArtifact -Path $temporary) { throw 'INCOMPLETE_RESULT_ACCEPTED' }
  Write-Output 'PASS result-artifact-valid-vs-incomplete'
} finally { Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue }
$launcherPass = Resolve-P9LauncherInvocationOutcome -LauncherSummary ([pscustomobject]@{ verdict='PASS'; failure=$null })
$launcherFail = Resolve-P9LauncherInvocationOutcome -LauncherSummary ([pscustomobject]@{ verdict='FAIL'; failure='EXACT_FAILURE' })
if (-not $launcherPass.pass -or $launcherPass.numericExitRequired -or $launcherFail.pass -or $launcherFail.code -ne 'EXACT_FAILURE') { throw 'LAUNCHER_RESULT_CONTRACT_FAILED' }
Write-Output 'PASS launcher-summary-result-contract-ignores-raw-last-exit-code'
Write-Output "P9 RUNNER EXIT CODE CONTRACT PASS $($cases.Count)/$($cases.Count)"
