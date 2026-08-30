param(
  [string]$OutputRoot = (Join-Path $PSScriptRoot '..\.tmp\field-test-backend')
)

$ErrorActionPreference='Stop'
$companyId='f1000000-0000-4000-8000-000000000001'
$identities=@(
  [ordered]@{id='FIELD-TESTER-01';userId='f3000000-0000-4000-8000-000000000001';access='TESTER'},
  [ordered]@{id='FIELD-TESTER-02';userId='f3000000-0000-4000-8000-000000000002';access='TESTER'},
  [ordered]@{id='FIELD-TESTER-03';userId='f3000000-0000-4000-8000-000000000003';access='TESTER'},
  [ordered]@{id='FIELD-OWNER';userId='f3000000-0000-4000-8000-00000000000f';access='OWNER'}
)

function New-Token([string]$Id){
  $bytes=[byte[]]::new(32);$rng=[Security.Cryptography.RandomNumberGenerator]::Create();try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
  $random=[Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  "agm_field_$($Id.ToLowerInvariant().Replace('-','_'))_$random"
}
function Hash([string]$Value){$sha=[Security.Cryptography.SHA256]::Create();try{-join($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value))|ForEach-Object{$_.ToString('x2')})}finally{$sha.Dispose()}}

$resolved=[IO.Path]::GetFullPath($OutputRoot)
if(Test-Path -LiteralPath $resolved){throw 'FIELD_TEST_SECRET_OUTPUT_ALREADY_EXISTS'}
New-Item -ItemType Directory -Path $resolved | Out-Null
$access=@();$safe=@();$runtime=@()
foreach($identity in $identities){
  $token=New-Token $identity.id
  $access+=[ordered]@{id=$identity.id;token=$token;access=$identity.access;userId=$identity.userId;companyId=$companyId}
  $safe+=[ordered]@{id=$identity.id;access=$identity.access;userId=$identity.userId;companyId=$companyId;tokenHash=Hash $token}
  $runtime+=[ordered]@{id=$identity.id;access=$identity.access;userId=$identity.userId;companyId=$companyId;tokenHash=Hash $token}
}
$utf8NoBom=[Text.UTF8Encoding]::new($false)
$accessJson=$access|ConvertTo-Json -Depth 4 -Compress
$encrypted=ConvertFrom-SecureString (ConvertTo-SecureString $accessJson -AsPlainText -Force)
$encrypted|Set-Content -LiteralPath (Join-Path $resolved 'field-access.dpapi') -Encoding ascii
$safeJson=$safe|ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $resolved 'authorized-testers.safe.json'),$safeJson,$utf8NoBom)
$accessJson=$null;$encrypted=$null;$access=$null;$safeJson=$null
Write-Output "FIELD_SECRET_BUNDLE_CREATED=$resolved"
Write-Output 'PLAINTEXT_TOKENS_NOT_DISPLAYED=true'
Write-Output 'AUTHORIZED_IDENTITIES=4'
