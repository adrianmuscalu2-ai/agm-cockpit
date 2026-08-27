[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('DryRun','AuthorizedStart')][string]$Mode,
  [Parameter(Mandatory)][string]$SoakIdentity,
  [string]$ThresholdsPath = 'config/copilot-v1.2/p9-official-soak-readiness-thresholds.json',
  [string]$StatePath = 'evidence/governance/copilot-v1.2/p9/soak/soak-state.json',
  [string]$MaterialFailurePath = 'evidence/governance/copilot-v1.2/p9/official-soak-restart-readiness/material-failure-analysis.json'
)
$ErrorActionPreference='Stop';$root=Split-Path -Parent $PSScriptRoot
foreach($relative in @($ThresholdsPath,$StatePath,$MaterialFailurePath)){if(-not(Test-Path (Join-Path $root $relative)-PathType Leaf)){throw 'SOAK_READINESS_REQUIRED_ARTIFACT_MISSING'}}
$thresholds=Get-Content -Raw (Join-Path $root $ThresholdsPath)|ConvertFrom-Json;$state=Get-Content -Raw (Join-Path $root $StatePath)|ConvertFrom-Json;$failure=Get-Content -Raw (Join-Path $root $MaterialFailurePath)|ConvertFrom-Json
if($SoakIdentity -notmatch '^p9-soak-[0-9]{8}-[a-z0-9-]{8,64}$'){throw 'SOAK_IDENTITY_INVALID'}
$identityMatches=@(Get-ChildItem (Join-Path $root 'evidence/governance/copilot-v1.2/p9') -Recurse -File -ErrorAction SilentlyContinue|Select-String -SimpleMatch $SoakIdentity)
if($identityMatches.Count-ne0){throw 'SOAK_IDENTITY_NOT_UNIQUE'}
$gates=[ordered]@{stateIsStopped=($state.status-eq'STOP_IMMEDIATE');materialFailureExplained=($failure.cause.failureSignature-eq'ONE_HEALTH_TIMEOUT / AVAILABILITY_AND_MAXIMUM_SLO_BREACH');materialFailureClosed=($failure.closureEvidenceAvailable-eq$true);thresholdsApproved=($thresholds.approvalState-eq'APPROVED');explicitResultContract=$true;rawLastExitCodeUsed=$false;workloadExecuted=$false;trafficGenerated=0}
$ready=$gates.stateIsStopped-and$gates.materialFailureExplained-and$gates.materialFailureClosed-and$gates.thresholdsApproved
$plan=[ordered]@{contract='agm-p9-official-soak-orchestrator-plan.v1';mode=$Mode;soakIdentity=$SoakIdentity;gates=$gates;ready=$ready;currentDecision=if($ready){'READY_FOR_SEPARATE_EXECUTION_AUTHORIZATION'}else{'NOT_READY'};atomicStopCriteria=@('THRESHOLD_FAILURE','EVIDENCE_INCOMPLETE','IDENTITY_OR_FENCE_FAILURE','WORKER_REMAINING','KILL_SWITCH_FAILURE');reconciliation='EXPLICIT_SUMMARY_CONTRACT / RAW_LASTEXITCODE_FORBIDDEN'}
$plan|ConvertTo-Json -Depth 8
if($Mode-eq'AuthorizedStart'){throw 'OFFICIAL_SOAK_START_NOT_AUTHORIZED_BY_READINESS_REMEDIATION'}
if(-not$ready){exit 2}
