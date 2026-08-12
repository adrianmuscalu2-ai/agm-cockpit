param(
  [string]$TokenPath=(Join-Path $env:LOCALAPPDATA 'AGM\secrets\gmail-oauth-token.dpapi'),
  [string]$StatusPath=(Join-Path $env:LOCALAPPDATA 'AGM\state\gmail-oauth-status.json')
)
$ErrorActionPreference='Stop'
if(!(Test-Path -LiteralPath $TokenPath)){throw 'GMAIL_OAUTH_DPAPI_TOKEN_MISSING'}
$encrypted=[IO.File]::ReadAllText($TokenPath,[Text.Encoding]::UTF8);$secure=ConvertTo-SecureString $encrypted;$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try{$raw=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr);$bundle=$raw|ConvertFrom-Json;if([string]::IsNullOrWhiteSpace($bundle.client_id)-or[string]::IsNullOrWhiteSpace($bundle.client_secret)-or[string]::IsNullOrWhiteSpace($bundle.refresh_token)-or$bundle.from_address-ne'agm.transporte.logistik@gmail.com'){throw 'GMAIL_OAUTH_DPAPI_BUNDLE_INVALID'}}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$raw=$null;$bundle=$null;$secure=$null;$encrypted=$null}
$dir=Split-Path -Parent $StatusPath;[IO.Directory]::CreateDirectory($dir)|Out-Null
$safe=@{State='AUTHORIZED';Authority='accounts.google.com';RedirectUri='http://127.0.0.1:53682/oauth2/callback';Scopes=@('https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/gmail.readonly');TokenStoredDpapi=$true;CustodyValidated=$true;CompletedAt=(Get-Date).ToString('o');SecretDisplayed=$false}
[IO.File]::WriteAllText($StatusPath,($safe|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
[pscustomobject]@{State='AUTHORIZED';TokenStoredDpapi=$true;CustodyValidated=$true;SecretDisplayed=$false}|ConvertTo-Json -Compress
