param(
  [string]$BaseUrl='https://validation-api.agmcockpit.com',
  [string]$BundlePath=(Join-Path $PSScriptRoot '..\.tmp\field-test-backend\field-access.dpapi'),
  [string]$AdbPath='C:\Users\adria\AppData\Local\Android\Sdk\platform-tools\adb.exe',
  [switch]$RecordInitialPendingObservation
)

$ErrorActionPreference='Stop'

function Read-AccessBundle([string]$Path){
  if(!(Test-Path -LiteralPath $Path)){throw 'FIELD_ACCESS_BUNDLE_NOT_FOUND'}
  $secure=ConvertTo-SecureString ((Get-Content -LiteralPath $Path -Raw).Trim())
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try{return @([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)|ConvertFrom-Json)}
  finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$secure.Dispose()}
}

function Invoke-DeviceRequest([string]$Method,[string]$Url,[string]$Token,[string]$Body=''){
  if($Token -notmatch '^[A-Za-z0-9_-]+$'){throw 'FIELD_TOKEN_CONTAINS_UNSAFE_SHELL_CHARACTERS'}
  if($Url -notmatch '^https://[A-Za-z0-9./_-]+$'){throw 'FIELD_URL_CONTAINS_UNSAFE_SHELL_CHARACTERS'}
  $inputPrefix='';$bodyArguments=''
  if($Body){
    $encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Body))
    $inputPrefix="printf '%s' '$encoded' | base64 -d | "
    $bodyArguments=" --header 'Content-Type: application/json' --data-binary @-"
  }
  $command="$inputPrefix`curl --silent --show-error --connect-timeout 20 --max-time 60 --request $Method --header 'Authorization: Bearer $Token'$bodyArguments --write-out '\n%{http_code}' '$Url'"
  $raw=@(& $AdbPath shell $command)
  if($LASTEXITCODE -ne 0){throw "ANDROID_CURL_FAILED_$LASTEXITCODE"}
  if($raw.Count -lt 1){throw 'ANDROID_CURL_EMPTY_RESPONSE'}
  $status=[int]$raw[-1]
  $body=($raw[0..([Math]::Max(0,$raw.Count-2))] -join "`n")
  return [pscustomobject]@{Status=$status;Body=$body}
}

if(!(Test-Path -LiteralPath $AdbPath)){throw 'ADB_NOT_FOUND'}
$devices=@(& $AdbPath devices |Select-Object -Skip 1|Where-Object{$_ -match '\sdevice$'})
if($devices.Count -ne 1){throw "EXPECTED_ONE_AUTHORIZED_ANDROID_DEVICE_GOT_$($devices.Count)"}
$model=(& $AdbPath shell getprop ro.product.model).Trim()
$fingerprint=(& $AdbPath shell getprop ro.build.fingerprint).Trim()
$serial=(& $AdbPath get-serialno).Trim()
$sha=[Security.Cryptography.SHA256]::Create()
try{$serialHash=-join($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($serial))|ForEach-Object{$_.ToString('x2')})}finally{$sha.Dispose()}

$access=Read-AccessBundle $BundlePath
$tester=$access|Where-Object id -eq 'FIELD-TESTER-01'
$owner=$access|Where-Object id -eq 'FIELD-OWNER'
if(!$tester -or !$owner){throw 'REQUIRED_FIELD_IDENTITIES_MISSING'}
$protocolUri="$BaseUrl/api/v1/car-mover/routing/field-protocol"
$telemetryUri="$BaseUrl/api/v1/car-mover/routing/telemetry"
$observationUri="$BaseUrl/api/v1/car-mover/routing/observations"

$testerAssignments=[ordered]@{}
foreach($testerIdentity in @($access|Where-Object access -eq 'TESTER')){
  $assignmentResponse=Invoke-DeviceRequest 'GET' $protocolUri $testerIdentity.token
  if($assignmentResponse.Status -ne 200){throw "ANDROID_PROTOCOL_$($testerIdentity.id)_EXPECTED_200_GOT_$($assignmentResponse.Status)"}
  $assignmentProtocol=($assignmentResponse.Body|ConvertFrom-Json).data
  $testerAssignments[$testerIdentity.id]=@($assignmentProtocol.assignedCases).Count
  if($testerAssignments[$testerIdentity.id] -ne 40){throw "TESTER_CASE_ASSIGNMENT_COUNT_MISMATCH_$($testerIdentity.id)"}
}
$protocolResponse=Invoke-DeviceRequest 'GET' $protocolUri $tester.token
$telemetryResponse=Invoke-DeviceRequest 'GET' $telemetryUri $owner.token
$testerTelemetry=Invoke-DeviceRequest 'GET' $telemetryUri $tester.token
$ownerObservation=Invoke-DeviceRequest 'POST' $observationUri $owner.token
if($protocolResponse.Status -ne 200){throw "ANDROID_PROTOCOL_EXPECTED_200_GOT_$($protocolResponse.Status)"}
if($telemetryResponse.Status -ne 200){throw "ANDROID_TELEMETRY_EXPECTED_200_GOT_$($telemetryResponse.Status)"}
if($testerTelemetry.Status -ne 403){throw "ANDROID_TESTER_TELEMETRY_EXPECTED_403_GOT_$($testerTelemetry.Status)"}
if($ownerObservation.Status -ne 403){throw "ANDROID_OWNER_OBSERVATION_EXPECTED_403_GOT_$($ownerObservation.Status)"}
$protocol=($protocolResponse.Body|ConvertFrom-Json).data
$telemetry=($telemetryResponse.Body|ConvertFrom-Json).data
if($protocol.defaultVehicleProfile -ne 'PASSENGER_CAR'){throw 'DEFAULT_PROFILE_POLICY_MISMATCH'}
if($protocol.unknownPolicy -ne 'HUMAN_CONFIRMATION_REQUIRED'){throw 'UNKNOWN_POLICY_MISMATCH'}
if(@($protocol.assignedCases).Count -ne 40){throw 'TESTER_CASE_ASSIGNMENT_COUNT_MISMATCH'}
if($telemetry.fieldValidation -notin @('INSUFFICIENT_DATA_NO_FIELD_DATA','INSUFFICIENT_DATA')){throw 'FIELD_RESULT_GOVERNANCE_MISMATCH'}

$observationStatus='NOT_RECORDED'
$observationIdHash='NOT_RECORDED'
$currentFieldValidation=$telemetry.fieldValidation
if($RecordInitialPendingObservation){
  if($telemetry.measured.rawObservations -ne 0){throw 'INITIAL_OBSERVATION_REQUIRES_EMPTY_FIELD_DATASET'}
  $initialObservation=[ordered]@{
    entityType='JOB';entityId=$protocol.assignedCases[0].id;vehicleClass='PASSENGER_CAR';routeSource='UNKNOWN';
    cacheState='NOT_APPLICABLE';tollStatus='UNKNOWN';fallbackReason='NONE';coreAvailability='UNKNOWN';
    externalProviderAssessment='UNKNOWN';manualConfirmation=$false;externalPaidLookup=$false;finalRouteDecision='PENDING'
  }|ConvertTo-Json -Compress
  $recorded=Invoke-DeviceRequest 'POST' $observationUri $tester.token $initialObservation
  if($recorded.Status -ne 201){throw "ANDROID_OBSERVATION_EXPECTED_201_GOT_$($recorded.Status)_BODY_$($recorded.Body)"}
  $recordData=($recorded.Body|ConvertFrom-Json).data
  if(!$recordData.recorded -or $recordData.measurementStatus -ne 'MEASURED_NOT_PREDECLARED'){throw 'ANDROID_OBSERVATION_RECORD_CONTRACT_MISMATCH'}
  $updatedResponse=Invoke-DeviceRequest 'GET' $telemetryUri $owner.token
  if($updatedResponse.Status -ne 200){throw "ANDROID_UPDATED_TELEMETRY_EXPECTED_200_GOT_$($updatedResponse.Status)"}
  $updated=($updatedResponse.Body|ConvertFrom-Json).data
  if($updated.fieldValidation -ne 'INSUFFICIENT_DATA' -or $updated.measured.rawObservations -ne 1 -or $updated.measured.uniqueCases -ne 1 -or $updated.measured.finalizedCases -ne 0 -or $updated.measured.pending -ne 1){throw 'PARTIAL_FIELD_DATA_GOVERNANCE_MISMATCH'}
  if($null -ne $updated.measured.latencyMs.p50 -or $updated.measured.paidExternalLookupCount -ne 0){throw 'UNKNOWN_LATENCY_OR_EXTERNAL_LOOKUP_POLICY_MISMATCH'}
  $currentFieldValidation=$updated.fieldValidation
  $idSha=[Security.Cryptography.SHA256]::Create()
  try{$observationIdHash=-join($idSha.ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$recordData.observationId))|ForEach-Object{$_.ToString('x2')})}finally{$idSha.Dispose()}
  $observationStatus='RECORDED_PENDING_NON_CONCLUSIVE'
}

Write-Output 'PHYSICAL_ANDROID_FIELD_CONNECTIVITY=PASS'
Write-Output "DEVICE_MODEL=$model"
Write-Output "DEVICE_SERIAL_SHA256=$serialHash"
Write-Output "DEVICE_BUILD_FINGERPRINT=$fingerprint"
Write-Output "PROTOCOL_STATUS=$($protocolResponse.Status)"
Write-Output "TELEMETRY_STATUS=$($telemetryResponse.Status)"
Write-Output "TESTER_ASSIGNED_CASES=$(@($protocol.assignedCases).Count)"
foreach($assignment in $testerAssignments.GetEnumerator()){Write-Output "ASSIGNED_CASES_$($assignment.Key)=$($assignment.Value)"}
Write-Output "TESTER_TELEMETRY_BLOCKED=$($testerTelemetry.Status)"
Write-Output "OWNER_OBSERVATION_BLOCKED=$($ownerObservation.Status)"
Write-Output "DEFAULT_PROFILE=$($protocol.defaultVehicleProfile)"
Write-Output "UNKNOWN_POLICY=$($protocol.unknownPolicy)"
Write-Output "HERE=$($protocol.runtimeReadiness.here)"
Write-Output "TOLLGURU=$($protocol.runtimeReadiness.tollGuru)"
Write-Output "FIELD_VALIDATION_BEFORE_REQUEST=$($telemetry.fieldValidation)"
Write-Output "FIELD_VALIDATION_CURRENT=$currentFieldValidation"
Write-Output "RAW_OBSERVATIONS=$($telemetry.measured.rawObservations)"
Write-Output "UNIQUE_CASES=$($telemetry.measured.uniqueCases)"
Write-Output "FINALIZED_CASES=$($telemetry.measured.finalizedCases)"
Write-Output "PENDING_CASES=$($telemetry.measured.pending)"
Write-Output "LATENCY_P50=$($telemetry.measured.latencyMs.p50)"
Write-Output "PAID_EXTERNAL_LOOKUPS=$($telemetry.measured.paidExternalLookupCount)"
Write-Output "SAMPLE_SUFFICIENT=$($telemetry.sampleStatus.sufficient)"
Write-Output "SAMPLE_REASONS=$(@($telemetry.sampleStatus.reasons) -join ',')"
Write-Output "FIRST_OBSERVATION=$observationStatus"
Write-Output "FIRST_OBSERVATION_ID_SHA256=$observationIdHash"
Write-Output 'PLAINTEXT_TOKENS_DISPLAYED=false'
