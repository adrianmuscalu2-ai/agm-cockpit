param(
  [string]$BaseUrl='https://validation-api.agmcockpit.com',
  [string]$BundlePath=(Join-Path $PSScriptRoot '..\.tmp\field-test-backend\field-access.dpapi')
)

$ErrorActionPreference='Stop'

function Read-AccessBundle([string]$Path){
  if(!(Test-Path -LiteralPath $Path)){throw 'FIELD_ACCESS_BUNDLE_NOT_FOUND'}
  $secure=ConvertTo-SecureString ((Get-Content -LiteralPath $Path -Raw).Trim())
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try{return @([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)|ConvertFrom-Json)}
  finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$secure.Dispose()}
}

function Invoke-Status([string]$Method,[string]$Url,[string]$Token,[string]$Body=''){
  try{
    $parameters=@{Uri=$Url;Method=$Method;Headers=@{Authorization="Bearer $Token"};UseBasicParsing=$true}
    if($Body){$parameters.Body=$Body;$parameters.ContentType='application/json'}
    return [int](Invoke-WebRequest @parameters).StatusCode
  }catch{
    if($_.Exception.Response){return [int]$_.Exception.Response.StatusCode}
    throw
  }
}

$access=Read-AccessBundle $BundlePath
$tester=$access|Where-Object id -eq 'FIELD-TESTER-01'
$owner=$access|Where-Object id -eq 'FIELD-OWNER'
if(!$tester -or !$owner){throw 'REQUIRED_FIELD_IDENTITIES_MISSING'}
$protocolUri="$BaseUrl/api/v1/car-mover/routing/field-protocol"
$telemetryUri="$BaseUrl/api/v1/car-mover/routing/telemetry"
$observationUri="$BaseUrl/api/v1/car-mover/routing/observations"
$protocol=Invoke-RestMethod -Uri $protocolUri -Headers @{Authorization="Bearer $($tester.token)"} -Method Get
$telemetry=Invoke-RestMethod -Uri $telemetryUri -Headers @{Authorization="Bearer $($owner.token)"} -Method Get

if($protocol.defaultVehicleProfile -ne 'PASSENGER_CAR'){throw 'DEFAULT_PROFILE_POLICY_MISMATCH'}
if($protocol.unknownPolicy -ne 'HUMAN_CONFIRMATION_REQUIRED'){throw 'UNKNOWN_POLICY_MISMATCH'}
if($protocol.runtimeReadiness.here -ne 'INACTIVE_NOT_REQUIRED' -or $protocol.runtimeReadiness.tollGuru -ne 'INACTIVE_NOT_REQUIRED'){throw 'COMMERCIAL_PROVIDER_POLICY_MISMATCH'}
if(@($protocol.assignedCases).Count -ne 40){throw 'TESTER_CASE_ASSIGNMENT_COUNT_MISMATCH'}
if($telemetry.fieldValidation -ne 'INSUFFICIENT_DATA_NO_FIELD_DATA'){throw 'INITIAL_FIELD_RESULT_MISMATCH'}
if($telemetry.planningHypotheses.status -ne 'HYPOTHESES_NOT_PASS' -or $telemetry.target.status -ne 'TARGET_NOT_VERDICT'){throw 'FIELD_GOVERNANCE_MISMATCH'}

$testerTelemetryStatus=Invoke-Status 'GET' $telemetryUri $tester.token
$ownerObservationStatus=Invoke-Status 'POST' $observationUri $owner.token '{}'
if($testerTelemetryStatus -ne 403){throw "TESTER_TELEMETRY_EXPECTED_403_GOT_$testerTelemetryStatus"}
if($ownerObservationStatus -ne 403){throw "OWNER_OBSERVATION_EXPECTED_403_GOT_$ownerObservationStatus"}

Write-Output 'AUTHENTICATED_FIELD_ACCESS=PASS'
Write-Output "TESTER_ASSIGNED_CASES=$(@($protocol.assignedCases).Count)"
Write-Output "DEFAULT_PROFILE=$($protocol.defaultVehicleProfile)"
Write-Output "UNKNOWN_POLICY=$($protocol.unknownPolicy)"
Write-Output "HERE=$($protocol.runtimeReadiness.here)"
Write-Output "TOLLGURU=$($protocol.runtimeReadiness.tollGuru)"
Write-Output "INITIAL_FIELD_RESULT=$($telemetry.fieldValidation)"
Write-Output "TESTER_TELEMETRY_BLOCKED=$testerTelemetryStatus"
Write-Output "OWNER_OBSERVATION_BLOCKED=$ownerObservationStatus"
Write-Output 'PLAINTEXT_TOKENS_DISPLAYED=false'
