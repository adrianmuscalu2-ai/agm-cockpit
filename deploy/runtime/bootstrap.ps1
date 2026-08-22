param([switch]$IndependentReadOnlyValidation)

$ErrorActionPreference = 'Stop'

if ($IndependentReadOnlyValidation) {
  $taskName = 'AGM Persistent Runtime Bootstrap'
  $task = Get-ScheduledTask -TaskName $taskName -TaskPath '\' -ErrorAction Stop
  $info = Get-ScheduledTaskInfo -TaskName $taskName -TaskPath '\' -ErrorAction Stop
  if (-not $task.Settings.Enabled) { throw 'TASK_VALIDATION_FAILED:disabled' }
  if ($task.Principal.UserId -ne "$env:USERDOMAIN\adria") { throw 'TASK_VALIDATION_FAILED:principal' }
  if ($task.Actions.Count -ne 1 -or $task.Actions[0].Execute -notmatch '(^|\\)powershell\.exe$') { throw 'TASK_VALIDATION_FAILED:action' }
  if ($task.Actions[0].Arguments -match 'cmd\.exe|ExecutionPolicy\s+Bypass|WindowStyle\s+Hidden|AGM_SECRET_REF_|AGM_SECRET_VALUE') { throw 'TASK_VALIDATION_FAILED:unsafe-action' }
  Write-Output ("TASK_VALIDATION_PASS:{0}:{1}" -f $info.LastRunTime,$info.LastTaskResult)
  exit 0
}

& (Join-Path $PSScriptRoot 'runtime.ps1') bootstrap
