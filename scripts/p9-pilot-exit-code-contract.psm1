function Resolve-P9RunnerExitOutcome {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][bool]$ProcessCompleted,
    [AllowNull()][Nullable[int]]$ExitCode,
    [Parameter(Mandatory)][bool]$ResultArtifactValid
  )
  if (-not $ProcessCompleted) { return [pscustomobject]@{ pass=$false; code='P9_INTERNAL_RUNNER_NOT_COMPLETED'; exitCode=$null } }
  if ($null -ne $ExitCode) {
    if ([int]$ExitCode -eq 0) { return [pscustomobject]@{ pass=$true; code='EXIT_CODE_ZERO'; exitCode=0 } }
    return [pscustomobject]@{ pass=$false; code="P9_INTERNAL_RUNNER_EXIT_$([int]$ExitCode)"; exitCode=[int]$ExitCode }
  }
  if ($ResultArtifactValid) { return [pscustomobject]@{ pass=$true; code='NULL_EXIT_CODE_WITH_VALID_COMPLETION_EVIDENCE'; exitCode=$null } }
  return [pscustomobject]@{ pass=$false; code='P9_INTERNAL_RUNNER_EXIT_CODE_ABSENT_WITHOUT_VALID_RESULT'; exitCode=$null }
}
function Test-P9RunnerResultArtifact {
  [CmdletBinding()]
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
  try { $value = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json -ErrorAction Stop } catch { return $false }
  if ($value.contract -ne 'agm-p9-internal-pilot-evidence.v2' -or [int]$value.pid -lt 1) { return $false }
  if ($null -eq $value.results -or $null -eq $value.metrics -or $null -eq $value.cleanup) { return $false }
  if ([int]$value.metrics.completed -ne @($value.results).Count) { return $false }
  return $true
}
function Resolve-P9LauncherInvocationOutcome {
  [CmdletBinding()]
  param([Parameter(Mandatory)][object]$LauncherSummary)
  if ($LauncherSummary.verdict -eq 'PASS' -and $null -eq $LauncherSummary.failure) { return [pscustomobject]@{ pass=$true; code='LAUNCHER_SUMMARY_PASS'; numericExitRequired=$false } }
  $reason = if ($LauncherSummary.failure) { [string]$LauncherSummary.failure } else { 'LAUNCHER_SUMMARY_INVALID' }
  return [pscustomobject]@{ pass=$false; code=$reason; numericExitRequired=$false }
}
Export-ModuleMember -Function Resolve-P9RunnerExitOutcome,Test-P9RunnerResultArtifact,Resolve-P9LauncherInvocationOutcome
