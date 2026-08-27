param(
  [ValidateSet('Prepare','Start','Capture','Complete')][string]$Action='Prepare',
  [string]$SessionId='',
  [string]$Device='Android AGM Cockpit 1.3.0',
  [ValidateSet('MOBILE','WIFI','DEGRADED','OFFLINE','OPERATOR_NOT_RECORDED')][string]$Connectivity='OPERATOR_NOT_RECORDED',
  [string]$ObservationPath='',
  [switch]$SafetyConfirmed
)
$ErrorActionPreference='Stop'
if($Action-ne'Prepare'-and[string]::IsNullOrWhiteSpace($SessionId)){throw'FIELD_TEST_SESSION_ID_REQUIRED'}
if($Action-eq'Capture'-and[string]::IsNullOrWhiteSpace($ObservationPath)){throw'FIELD_TEST_OBSERVATION_PATH_REQUIRED'}
$env:FIELD_TEST_ACTION=$Action;$env:FIELD_TEST_SESSION_ID=$SessionId;$env:FIELD_TEST_DEVICE=$Device;$env:FIELD_TEST_CONNECTIVITY=$Connectivity;$env:FIELD_TEST_OBSERVATION_PATH=$ObservationPath;$env:FIELD_TEST_SAFETY_CONFIRMED=if($SafetyConfirmed){'true'}else{'false'}
try{& (Join-Path $PSScriptRoot 'Invoke-AGMProviderPilot.ps1') -Action FieldTest;if($LASTEXITCODE-ne 0){exit $LASTEXITCODE}}finally{foreach($name in @('FIELD_TEST_ACTION','FIELD_TEST_SESSION_ID','FIELD_TEST_DEVICE','FIELD_TEST_CONNECTIVITY','FIELD_TEST_OBSERVATION_PATH','FIELD_TEST_SAFETY_CONFIRMED')){Remove-Item "Env:$name" -ErrorAction SilentlyContinue}}
