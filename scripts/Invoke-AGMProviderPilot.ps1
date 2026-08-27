param(
  [ValidateSet('Seed','Probe','Gate','TollGate','FieldTest','Report','State','Api')][string]$Action='Seed',
  [string]$ProviderSecretPath=(Join-Path $env:LOCALAPPDATA 'AGM\secrets\live-provider-pilot.dpapi'),
  [string]$GmailTokenPath=(Join-Path $env:LOCALAPPDATA 'AGM\secrets\gmail-oauth-token.dpapi'),
  [string]$OpenAISecretPath=(Join-Path $env:LOCALAPPDATA 'AGM\secrets\openai-production-key.dpapi'),
  [ValidatePattern('^-?\d+(\.\d+)?$')][string]$OriginLat='48.1351',
  [ValidatePattern('^-?\d+(\.\d+)?$')][string]$OriginLon='11.5820',
  [ValidatePattern('^-?\d+(\.\d+)?$')][string]$DestinationLat='48.5734',
  [ValidatePattern('^-?\d+(\.\d+)?$')][string]$DestinationLon='7.7521',
  [string]$DestinationQuery='Strasbourg, France',
  [ValidateSet('tomtom','here','tollguru','gmail')][string]$Provider='tomtom',
  [ValidateSet('ACTIVE','SUSPENDED','READY')][string]$PilotState='READY',
  [string]$StateReason='OWNER_CONTROLLED_PILOT_CHANGE',
  [ValidateRange(1024,65535)][int]$PilotPort=3001
)
$ErrorActionPreference='Stop'
function Read-Bundle([string]$Path){if(!(Test-Path -LiteralPath $Path)){return $null};$encrypted=[IO.File]::ReadAllText($Path,[Text.Encoding]::UTF8);$secure=ConvertTo-SecureString $encrypted;$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);try{$raw=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr);return $raw|ConvertFrom-Json}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$raw=$null;$secure=$null;$encrypted=$null}}
function Read-Secret([string]$Path){if(!(Test-Path -LiteralPath $Path)){return $null};$encrypted=[IO.File]::ReadAllText($Path,[Text.Encoding]::UTF8);$secure=ConvertTo-SecureString $encrypted;$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);try{return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$secure=$null;$encrypted=$null}}
$providerBundle=Read-Bundle $ProviderSecretPath;$gmailBundle=Read-Bundle $GmailTokenPath
try{
  if($providerBundle){$env:TOMTOM_API_KEY=$providerBundle.TOMTOM_API_KEY;$env:HERE_API_KEY=$providerBundle.HERE_API_KEY;$env:TOLLGURU_API_KEY=$providerBundle.TOLLGURU_API_KEY}
  if($gmailBundle){$env:GMAIL_OAUTH_CLIENT_ID=$gmailBundle.client_id;$env:GMAIL_OAUTH_CLIENT_SECRET=$gmailBundle.client_secret;$env:GMAIL_OAUTH_REFRESH_TOKEN=$gmailBundle.refresh_token;$env:GMAIL_FROM_ADDRESS=$gmailBundle.from_address}
  if($Action-eq'Api'){$openAIKey=Read-Secret $OpenAISecretPath;if([string]::IsNullOrWhiteSpace($openAIKey)){throw'OPENAI_DPAPI_BINDING_MISSING'};$env:OPENAI_API_KEY=$openAIKey}
  $env:PILOT_ORIGIN_LAT=$OriginLat;$env:PILOT_ORIGIN_LON=$OriginLon;$env:PILOT_DESTINATION_LAT=$DestinationLat;$env:PILOT_DESTINATION_LON=$DestinationLon;$env:PILOT_DESTINATION_QUERY=$DestinationQuery
  $env:PILOT_PROVIDER=$Provider;$env:PILOT_STATE=$PilotState;$env:PILOT_STATE_REASON=$StateReason
  switch($Action){
    'Seed'{& pnpm.cmd --filter @agm/api pilot:seed}
    'Probe'{& pnpm.cmd --filter @agm/api exec ts-node --project tsconfig.json scripts/test-provider-pilot-live.ts}
    'Gate'{& pnpm.cmd --filter @agm/api exec ts-node --project tsconfig.json scripts/test-provider-activation-gate.ts}
    'TollGate'{& pnpm.cmd --filter @agm/api exec ts-node --project tsconfig.json scripts/test-tollguru-cache-gate.ts}
    'FieldTest'{& pnpm.cmd --filter @agm/api exec ts-node --project tsconfig.json scripts/field-test-session.ts}
    'Report'{& pnpm.cmd --filter @agm/api pilot:report}
    'State'{& pnpm.cmd --filter @agm/api exec ts-node --project tsconfig.json scripts/set-provider-pilot-state.ts}
    'Api'{$env:PORT=[string]$PilotPort;& pnpm.cmd --filter @agm/api start:dev}
  }
  if($LASTEXITCODE-ne 0){exit $LASTEXITCODE}
}finally{
  foreach($name in @('TOMTOM_API_KEY','HERE_API_KEY','TOLLGURU_API_KEY','GMAIL_OAUTH_CLIENT_ID','GMAIL_OAUTH_CLIENT_SECRET','GMAIL_OAUTH_REFRESH_TOKEN','GMAIL_FROM_ADDRESS','OPENAI_API_KEY','PILOT_ORIGIN_LAT','PILOT_ORIGIN_LON','PILOT_DESTINATION_LAT','PILOT_DESTINATION_LON','PILOT_DESTINATION_QUERY','PILOT_PROVIDER','PILOT_STATE','PILOT_STATE_REASON','PORT')){Remove-Item "Env:$name" -ErrorAction SilentlyContinue}
  $providerBundle=$null;$gmailBundle=$null;$openAIKey=$null
}
