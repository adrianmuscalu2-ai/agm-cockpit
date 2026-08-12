param(
  [string]$DownloadsPath = (Join-Path $env:USERPROFILE 'Downloads'),
  [string]$SecretPath = (Join-Path $env:LOCALAPPDATA 'AGM\secrets\gmail-oauth-client.dpapi')
)
$ErrorActionPreference='Stop'
$candidate=Get-ChildItem -LiteralPath $DownloadsPath -File -Filter 'client_secret_*.apps.googleusercontent.com.json' |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if(!$candidate){throw 'GMAIL_OAUTH_CLIENT_JSON_NOT_FOUND'}
$raw=[IO.File]::ReadAllText($candidate.FullName,[Text.Encoding]::UTF8)
try{
  $json=$raw|ConvertFrom-Json
  $installed=$json.installed
  if(!$installed -or [string]::IsNullOrWhiteSpace($installed.client_id) -or [string]::IsNullOrWhiteSpace($installed.client_secret)){throw 'GMAIL_OAUTH_DESKTOP_CLIENT_INVALID'}
  if($installed.client_id -notmatch '\.apps\.googleusercontent\.com$'){throw 'GMAIL_OAUTH_CLIENT_ID_INVALID'}
  if($installed.auth_uri -ne 'https://accounts.google.com/o/oauth2/auth' -and $installed.auth_uri -ne 'https://accounts.google.com/o/oauth2/v2/auth'){throw 'GMAIL_OAUTH_AUTHORITY_INVALID'}
  if($installed.token_uri -ne 'https://oauth2.googleapis.com/token'){throw 'GMAIL_OAUTH_TOKEN_ENDPOINT_INVALID'}
  $directory=Split-Path -Parent $SecretPath
  [IO.Directory]::CreateDirectory($directory)|Out-Null
  $secure=ConvertTo-SecureString -String $raw -AsPlainText -Force
  $encrypted=ConvertFrom-SecureString -SecureString $secure
  [IO.File]::WriteAllText($SecretPath,$encrypted,[Text.UTF8Encoding]::new($false))
  $acl=Get-Acl -LiteralPath $SecretPath
  $acl.SetAccessRuleProtection($true,$false)
  $rule=[Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.WindowsIdentity]::GetCurrent().Name,'FullControl','Allow')
  $acl.SetAccessRule($rule);Set-Acl -LiteralPath $SecretPath -AclObject $acl
  [pscustomobject]@{Status='IMPORTED_DPAPI';ClientId=$installed.client_id;ProjectId=$installed.project_id;ClientType='Desktop';SourceFile=$candidate.Name;SourceLastWrite=$candidate.LastWriteTime.ToString('o');SecretPath=$SecretPath;SecretDisplayed=$false}|ConvertTo-Json -Compress
}finally{$raw=$null;$json=$null;$installed=$null;$secure=$null;$encrypted=$null}
