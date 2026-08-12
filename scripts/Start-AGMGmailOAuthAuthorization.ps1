param(
  [string]$SecretPath = (Join-Path $env:LOCALAPPDATA 'AGM\secrets\gmail-oauth-client.dpapi'),
  [string]$TokenPath = (Join-Path $env:LOCALAPPDATA 'AGM\secrets\gmail-oauth-token.dpapi'),
  [string]$StatusPath = (Join-Path $env:LOCALAPPDATA 'AGM\state\gmail-oauth-status.json')
)
$ErrorActionPreference='Stop'
$redirect='http://127.0.0.1:53682/oauth2/callback'
$scopes=@('https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/gmail.readonly')
function B64Url([byte[]]$bytes){[Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')}
function Write-Status([hashtable]$value){$dir=Split-Path -Parent $StatusPath;[IO.Directory]::CreateDirectory($dir)|Out-Null;[IO.File]::WriteAllText($StatusPath,($value|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))}
if(!(Test-Path -LiteralPath $SecretPath)){throw 'GMAIL_OAUTH_DPAPI_CLIENT_MISSING'}
$encrypted=[IO.File]::ReadAllText($SecretPath,[Text.Encoding]::UTF8)
$secure=ConvertTo-SecureString $encrypted
$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try{$raw=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr);$client=($raw|ConvertFrom-Json).installed}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$raw=$null;$secure=$null;$encrypted=$null}
$listener=[Net.HttpListener]::new();$listener.Prefixes.Add('http://127.0.0.1:53682/');$listener.Start()
Write-Status @{State='CALLBACK_LISTENER_READY';Pid=$PID;RedirectUri=$redirect;Scopes=$scopes;StartedAt=(Get-Date).ToString('o');SecretDisplayed=$false}
$state=$null;$verifier=$null
try{
  while($true){
    $context=$listener.GetContext();$request=$context.Request;$response=$context.Response
    if($request.Url.AbsolutePath -eq '/health'){
      $health=[Text.Encoding]::UTF8.GetBytes('READY');$response.StatusCode=200;$response.ContentLength64=$health.Length;$response.OutputStream.Write($health,0,$health.Length);$response.Close();$context=$null
      continue
    }
    if($request.Url.AbsolutePath -eq '/prepare'){
      $rng=[Security.Cryptography.RandomNumberGenerator]::Create();$stateBytes=New-Object byte[] 32;$verifierBytes=New-Object byte[] 64;$rng.GetBytes($stateBytes);$rng.GetBytes($verifierBytes);$rng.Dispose()
      $state=B64Url $stateBytes;$verifier=B64Url $verifierBytes
      $sha=[Security.Cryptography.SHA256]::Create();$challenge=B64Url ($sha.ComputeHash([Text.Encoding]::ASCII.GetBytes($verifier)));$sha.Dispose()
      $query=@{client_id=$client.client_id;redirect_uri=$redirect;response_type='code';scope=($scopes -join ' ');access_type='offline';prompt='consent';include_granted_scopes='true';login_hint='agm.transporte.logistik@gmail.com';state=$state;code_challenge=$challenge;code_challenge_method='S256'}
      $encoded=($query.GetEnumerator()|ForEach-Object{"$([uri]::EscapeDataString($_.Key))=$([uri]::EscapeDataString([string]$_.Value))"}) -join '&';$url="https://accounts.google.com/o/oauth2/v2/auth?$encoded"
      Write-Status @{State='AUTHORIZATION_READY';Pid=$PID;Authority='accounts.google.com';AuthorizationUrl=$url;RedirectUri=$redirect;Scopes=$scopes;PreparedAt=(Get-Date).ToString('o');SecretDisplayed=$false}
      $prepared=[Text.Encoding]::UTF8.GetBytes('PREPARED');$response.StatusCode=200;$response.ContentLength64=$prepared.Length;$response.OutputStream.Write($prepared,0,$prepared.Length);$response.Close();continue
    }
    if($request.Url.AbsolutePath -ne '/oauth2/callback'){$response.StatusCode=404;$response.Close();continue}
    if([string]::IsNullOrWhiteSpace($state) -or $request.QueryString['state'] -ne $state){
      $stale=[Text.Encoding]::UTF8.GetBytes('Expired OAuth request ignored. Use the newest AGM authorization tab.');$response.StatusCode=409;$response.ContentLength64=$stale.Length;$response.OutputStream.Write($stale,0,$stale.Length);$response.Close();continue
    }
    if($request.QueryString['error']){throw 'GMAIL_OAUTH_CURRENT_REQUEST_DENIED'}
    break
  }
  $code=$request.QueryString['code'];if([string]::IsNullOrWhiteSpace($code)){throw 'GMAIL_OAUTH_CODE_MISSING'}
  $body=@{client_id=$client.client_id;client_secret=$client.client_secret;code=$code;code_verifier=$verifier;grant_type='authorization_code';redirect_uri=$redirect}
  $received='<html><body><h1>AGM Gmail authorization received</h1><p>Secure local setup is completing. You may close this tab.</p></body></html>'
  $receivedBytes=[Text.Encoding]::UTF8.GetBytes($received);$response.ContentType='text/html; charset=utf-8';$response.ContentLength64=$receivedBytes.Length;$response.OutputStream.Write($receivedBytes,0,$receivedBytes.Length);$response.Close()
  $token=Invoke-RestMethod -Method Post -Uri 'https://oauth2.googleapis.com/token' -Body $body -ContentType 'application/x-www-form-urlencoded'
  if([string]::IsNullOrWhiteSpace($token.refresh_token)){throw 'GMAIL_OAUTH_REFRESH_TOKEN_MISSING'}
  $bundle=@{client_id=$client.client_id;client_secret=$client.client_secret;refresh_token=$token.refresh_token;from_address='agm.transporte.logistik@gmail.com'}|ConvertTo-Json -Compress
  $tokenSecure=ConvertTo-SecureString -String $bundle -AsPlainText -Force;$tokenEncrypted=ConvertFrom-SecureString $tokenSecure
  $tokenDir=Split-Path -Parent $TokenPath;[IO.Directory]::CreateDirectory($tokenDir)|Out-Null;[IO.File]::WriteAllText($TokenPath,$tokenEncrypted,[Text.UTF8Encoding]::new($false))
  try{$acl=Get-Acl -LiteralPath $TokenPath;$acl.SetAccessRuleProtection($true,$false);$acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.WindowsIdentity]::GetCurrent().Name,'FullControl','Allow'));Set-Acl -LiteralPath $TokenPath -AclObject $acl}catch{if(!(Test-Path -LiteralPath $TokenPath)){throw}}
  Write-Status @{State='AUTHORIZED';Authority='accounts.google.com';RedirectUri=$redirect;Scopes=$scopes;CompletedAt=(Get-Date).ToString('o');TokenStoredDpapi=$true;SecretDisplayed=$false}
}catch{Write-Status @{State='FAILED';ErrorClass='LOCAL_OAUTH_FLOW_FAILED';At=(Get-Date).ToString('o');SecretDisplayed=$false};throw}finally{$listener.Stop();$listener.Close();$client=$null;$verifier=$null;$state=$null;$body=$null;$token=$null;$bundle=$null;$tokenSecure=$null;$tokenEncrypted=$null}
