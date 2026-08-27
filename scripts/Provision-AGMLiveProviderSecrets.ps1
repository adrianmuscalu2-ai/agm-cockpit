param(
  [ValidateSet('TomTom','HERE','TollGuru')]
  [string[]]$Provider=@('TomTom','HERE','TollGuru'),
  [string]$SecretPath=(Join-Path $env:LOCALAPPDATA 'AGM\secrets\live-provider-pilot.dpapi')
)
$ErrorActionPreference='Stop'
function Unprotect-Json([string]$Path){
  if(!(Test-Path -LiteralPath $Path)){return @{}}
  $encrypted=[IO.File]::ReadAllText($Path,[Text.Encoding]::UTF8);$secure=ConvertTo-SecureString $encrypted;$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try{$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr);$object=$plain|ConvertFrom-Json;$table=@{};foreach($property in $object.PSObject.Properties){$table[$property.Name]=$property.Value};return $table}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$plain=$null;$secure=$null;$encrypted=$null}
}
function Read-Key([string]$Label){
  $secure=Read-Host "Introduceți cheia $Label (intrare protejată)" -AsSecureString;$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try{$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr);$valid=if($Label-eq'TomTom'){-not[string]::IsNullOrWhiteSpace($plain)-and$plain-match'^[A-Za-z0-9]+$'}else{-not[string]::IsNullOrWhiteSpace($plain)-and$plain.Length-ge 16};if(!$valid){throw "${Label}_KEY_INVALID"};return $plain}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$secure=$null}
}
$bundle=Unprotect-Json $SecretPath
try{
  foreach($item in $Provider){switch($item){'TomTom'{$bundle.TOMTOM_API_KEY=Read-Key 'TomTom'}'HERE'{$bundle.HERE_API_KEY=Read-Key 'HERE'}'TollGuru'{$bundle.TOLLGURU_API_KEY=Read-Key 'TollGuru'}}}
  $json=$bundle|ConvertTo-Json -Compress;$secure=ConvertTo-SecureString -String $json -AsPlainText -Force;$encrypted=ConvertFrom-SecureString $secure
  $directory=Split-Path -Parent $SecretPath;[IO.Directory]::CreateDirectory($directory)|Out-Null;[IO.File]::WriteAllText($SecretPath,$encrypted,[Text.UTF8Encoding]::new($false))
  $acl=Get-Acl -LiteralPath $SecretPath;$acl.SetAccessRuleProtection($true,$false);$acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.WindowsIdentity]::GetCurrent().Name,'FullControl','Allow'));Set-Acl -LiteralPath $SecretPath -AclObject $acl
  [pscustomobject]@{Status='IMPORTED_DPAPI';Providers=$Provider;GuardianReference='guardian:dpapi:live-provider-pilot';SecretDisplayed=$false}|ConvertTo-Json -Compress
}finally{$json=$null;$secure=$null;$encrypted=$null;$bundle=$null}
