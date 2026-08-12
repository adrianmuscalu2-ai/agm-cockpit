param([string]$Email = 'agm.transporte.logistik@gmail.com')
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'AGM LOCAL - PRODUCT OWNER PASSWORD'
$stage = 'START'
$safeStatusPath = Join-Path $PSScriptRoot '..\evidence\governance\LOCAL_PREMIUM_PROVISIONING_STATUS.txt'
if ($Email -ne 'agm.transporte.logistik@gmail.com') { throw 'LOCAL_OWNER_EMAIL_NOT_APPROVED' }

function Read-Plain([Security.SecureString]$Value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
function New-Hash([string]$Value) {
  $start = [Diagnostics.ProcessStartInfo]::new('node.exe')
  $start.WorkingDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..\apps\api')).Path
  $start.Arguments = 'scripts/hash-password-stdin.cjs'
  $start.UseShellExecute=$false;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.CreateNoWindow=$true
  $process=[Diagnostics.Process]::Start($start)
  try {$process.StandardInput.Write($Value);$process.StandardInput.Close();$hash=$process.StandardOutput.ReadToEnd();$errorText=$process.StandardError.ReadToEnd();$process.WaitForExit();if($process.ExitCode-ne 0-or $hash-notmatch '^\$2[aby]\$12\$'){throw "HASH_FAILED $errorText"};$hash} finally {$process.Dispose()}
}

$hash=$null
while(-not $hash){
  $stage = 'PASSWORD_PROMPT'
  Write-Host 'INTRODUCEȚI PAROLA LOCALĂ NOUĂ — MINIMUM 14 CARACTERE' -ForegroundColor Cyan
  $a=Read-Host 'Parolă (mascat)' -AsSecureString
  Write-Host 'CONFIRMAȚI PAROLA LOCALĂ NOUĂ' -ForegroundColor Cyan
  $b=Read-Host 'Confirmare (mascat)' -AsSecureString
  $plainA=Read-Plain $a;$plainB=Read-Plain $b
  try {
    if($plainA.Length-lt 14){Write-Warning 'Minimum 14 caractere.';continue}
    if($plainA-cne $plainB){Write-Warning 'Introducerile nu coincid.';continue}
    $classes=@([bool]($plainA-cmatch '[a-z]'),[bool]($plainA-cmatch '[A-Z]'),[bool]($plainA-match '\d'),[bool]($plainA-match '[^a-zA-Z0-9]')).Where({$_}).Count
    if($classes-lt 3){Write-Warning 'Sunt necesare cel puțin trei categorii de caractere.';continue}
    $stage = 'HASH'
    $hash=New-Hash $plainA
  } finally {$plainA=$null;$plainB=$null;$a.Dispose();$b.Dispose()}
}

$userId=[guid]::NewGuid();$ownerAssignment=[guid]::NewGuid();$premiumAssignment=[guid]::NewGuid();$premiumRoleId=[guid]::NewGuid();$safeHash=$hash.Replace("'","''")
$sql=@"
BEGIN;
DO `$local_owner`$
DECLARE company_id uuid; owner_role uuid; premium_role uuid; target_user_id uuid;
BEGIN
 SELECT "companyId" INTO company_id FROM "User" WHERE email='owner@agm.local' AND status='Active';
 SELECT id INTO owner_role FROM "Role" WHERE "companyId"=company_id AND code='company_owner' AND "isActive"=true;
 INSERT INTO "Role"(id,"companyId",code,"displayName","description","isActive","createdAt") VALUES('$premiumRoleId',company_id,'PREMIUM_ACCESS','Premium Access','Local validation entitlement',true,now()) ON CONFLICT ("companyId",code) DO UPDATE SET "isActive"=true;
 SELECT id INTO premium_role FROM "Role" WHERE "companyId"=company_id AND code='PREMIUM_ACCESS' AND "isActive"=true;
 IF company_id IS NULL OR owner_role IS NULL OR premium_role IS NULL THEN RAISE EXCEPTION 'LOCAL_REQUIRED_ROLE_MISSING'; END IF;
 INSERT INTO "User"(id,"companyId","displayName",email,"passwordHash",status,"personalDataStatus","createdAt","updatedAt")
 VALUES('$userId',company_id,'AGM Product Owner','$Email','$safeHash','Active','Active',now(),now())
 ON CONFLICT ("companyId",email) DO UPDATE SET "passwordHash"=EXCLUDED."passwordHash",status='Active',"personalDataStatus"='Active',"updatedAt"=now()
 RETURNING id INTO target_user_id;
 INSERT INTO "UserRole"(id,"companyId","userId","roleId","assignedByUserId","assignedAt") VALUES('$ownerAssignment',company_id,target_user_id,owner_role,target_user_id,now()) ON CONFLICT ("userId","roleId") DO NOTHING;
 INSERT INTO "UserRole"(id,"companyId","userId","roleId","assignedByUserId","assignedAt") VALUES('$premiumAssignment',company_id,target_user_id,premium_role,target_user_id,now()) ON CONFLICT ("userId","roleId") DO NOTHING;
END `$local_owner`$;
COMMIT;
"@
try {
  $stage = 'DATABASE_PREPARE'
  $root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $dbLine=Get-Content (Join-Path $root '.env')|Where-Object{$_-match '^DATABASE_URL='}|Select-Object -First 1
  if(-not $dbLine){throw 'DATABASE_URL_NOT_FOUND'}
  $dbUrl=$dbLine.Substring(13).Trim('"');$separator=if($dbUrl.Contains('?')){'&'}else{'?'};$env:DATABASE_URL=$dbUrl+$separator+'options=-c%20default_transaction_read_only%3Doff'
  $stage = 'DATABASE_EXECUTE'
  Push-Location $root
  try { $sql | & pnpm.cmd exec prisma db execute --stdin --schema prisma/schema.prisma }
  finally { Pop-Location }
  if($LASTEXITCODE-ne 0){throw 'LOCAL_OWNER_TRANSACTION_FAILED'}
  $stage = 'COMPLETE'
  Set-Content -LiteralPath $safeStatusPath -Value 'COMPLETE' -Encoding ascii
  Write-Host 'LOCAL PRODUCT OWNER ACCOUNT — CREATED' -ForegroundColor Green
  Write-Host 'Parola nu a fost afișată sau salvată în text clar.'
  Read-Host 'Apăsați Enter pentru închiderea ferestrei'|Out-Null
} catch {
  Set-Content -LiteralPath $safeStatusPath -Value ("FAILED_STAGE=" + $stage + "`nERROR_TYPE=" + $_.Exception.GetType().Name) -Encoding ascii
  Write-Host "FLUX OPRIT SIGUR LA ETAPA: $stage" -ForegroundColor Red
  Write-Host 'Nicio parolă sau valoare secretă nu a fost înregistrată.'
  Read-Host 'Apăsați Enter pentru închiderea ferestrei'|Out-Null
  throw
} finally {$hash=$null;$safeHash=$null;$sql=$null;$env:DATABASE_URL=$null}
