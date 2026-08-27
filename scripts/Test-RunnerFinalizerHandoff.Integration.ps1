$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) "agm-handoff-integration-$([Guid]::NewGuid().ToString('N'))"
[IO.Directory]::CreateDirectory($temporaryRoot) | Out-Null
function Write-Seed([string]$Name, [string]$Contract) {
  $value=[ordered]@{contract=$Contract;runId=(Split-Path -Leaf $temporaryRoot);generatedAt=[DateTimeOffset]::UtcNow.ToString('o');integrationOnly=$true;trafficGenerated=$false;processChanges=0}
  [IO.File]::WriteAllText((Join-Path $temporaryRoot $Name),"$(($value|ConvertTo-Json))$([Environment]::NewLine)",[Text.UTF8Encoding]::new($false))
}
try {
  Write-Seed 'window.json' 'agm-handoff-integration-window.v1'
  Write-Seed 'shutdown.json' 'agm-handoff-integration-shutdown.v1'
  Write-Seed 'managed-process-roots.json' 'agm-handoff-integration-managed-roots.v1'
  Write-Seed 'managed-process-tree-before-shutdown.json' 'agm-handoff-integration-prior-inventory.v1'
  Write-Seed 'known-protected-background.json' 'agm-handoff-integration-known-background.v1'
  $runner=Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $root 'scripts/Invoke-InstrumentationLifecycleClosure.ps1'),'-OutputRoot',$temporaryRoot,'-HandoffIntegrationProducer') -WindowStyle Hidden -PassThru -Wait
  if($runner.ExitCode-ne 0){throw "REAL_RUNNER_INTEGRATION_FAILED_$($runner.ExitCode)"}
  if(-not(Test-Path (Join-Path $temporaryRoot 'closure-intent.json'))){throw 'REAL_RUNNER_INTENT_MISSING'}
  $finalizer=Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $root 'scripts/Invoke-InstrumentationLifecycleExternalFinalizer.ps1'),'-OutputRoot',$temporaryRoot,'-HandoffIntegrationMode') -WindowStyle Hidden -PassThru -Wait
  if($finalizer.ExitCode-ne 0){throw "REAL_FINALIZER_INTEGRATION_FAILED_$($finalizer.ExitCode)"}
  foreach($name in 'external-finalizer-identity.json','external-finalizer-runner-exit.json','process-inventory-after.json','instrumentation-lifecycle-analysis.json','external-finalizer-verdict.json','external-finalizer-lifecycle.json','SHA256SUMS.json'){if(-not(Test-Path (Join-Path $temporaryRoot $name))){throw "INTEGRATION_OUTPUT_MISSING_$name"}}
  & node (Join-Path $root 'scripts/hash-instrumentation-lifecycle-evidence.mjs') $temporaryRoot --verify
  if($LASTEXITCODE-ne 0){throw 'INTEGRATION_MANIFEST_VERIFY_FAILED'}
  $intent=Get-Content -Raw (Join-Path $temporaryRoot 'closure-intent.json')|ConvertFrom-Json
  $inventory=Get-Content -Raw (Join-Path $temporaryRoot 'process-inventory-after.json')|ConvertFrom-Json
  $verdict=Get-Content -Raw (Join-Path $temporaryRoot 'external-finalizer-verdict.json')|ConvertFrom-Json
  if($intent.externalFinalizerSource.path -ne 'scripts/Invoke-InstrumentationLifecycleExternalFinalizer.ps1' -or $inventory.runnerPidAbsent-ne $true -or $verdict.verdict-ne 'PASS'){throw 'INTEGRATION_CONTRACT_ASSERTION_FAILED'}
  Write-Output 'RUNNER_FINALIZER_REAL_HANDOFF_INTEGRATION_OK runner=EXITED finalizer=EXITED inventory=CAPTURED analyzer=PASS manifest=VERIFIED'
} finally {
  $resolved=[IO.Path]::GetFullPath($temporaryRoot);$temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath());if($resolved.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase)-and(Test-Path $resolved)){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
