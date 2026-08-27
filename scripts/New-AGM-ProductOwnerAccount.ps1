param(
  [string]$Email = 'agm.transporte.logistik@gmail.com',
  [string]$HostAddress = '167.233.237.253',
  [string]$IdentityPath = "$env:USERPROFILE\.ssh\agm_release_operations_hetzner_ed25519",
  [Parameter(Mandatory = $true)]
  [switch]$Age18Confirmed
)

$ErrorActionPreference = 'Stop'
if (-not $Age18Confirmed) { throw 'AGE_18_CONFIRMATION_REQUIRED_BEFORE_ACCOUNT_ACTIVATION' }
$Host.UI.RawUI.WindowTitle = 'AGM - SECURE PRODUCT OWNER PASSWORD'

if (-not (Test-Path -LiteralPath $IdentityPath)) { throw 'Identitatea SSH aprobată nu este disponibilă.' }
if ($Email -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw 'Adresa de e-mail nu este validă.' }

function Read-PlainTextFromSecureString([Security.SecureString]$SecureValue) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Invoke-NodeBcrypt([string]$PlainText) {
  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = 'node.exe'
  $start.WorkingDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..\apps\api')).Path
  $start.Arguments = 'scripts/hash-password-stdin.cjs'
  $start.UseShellExecute = $false
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $start.CreateNoWindow = $true
  $process = [Diagnostics.Process]::Start($start)
  try {
    $process.StandardInput.Write($PlainText)
    $process.StandardInput.Close()
    $hash = $process.StandardOutput.ReadToEnd()
    $errorText = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($process.ExitCode -ne 0 -or $hash -notmatch '^\$2[aby]\$12\$') { throw "Hashing failed. $errorText" }
    return $hash
  } finally { $process.Dispose() }
}

$passwordHash = $null
while (-not $passwordHash) {
  Write-Host ''
  Write-Host '1. INTRODUCETI PAROLA NOUA - MINIMUM 14 CARACTERE' -ForegroundColor Cyan
  $firstSecure = Read-Host 'Parolă nouă (introducere mascată)' -AsSecureString
  Write-Host '2. CONFIRMATI PAROLA NOUA' -ForegroundColor Cyan
  $secondSecure = Read-Host 'Confirmare (introducere mascată)' -AsSecureString
  $first = Read-PlainTextFromSecureString $firstSecure
  $second = Read-PlainTextFromSecureString $secondSecure
  try {
    if ($first.Length -lt 14) { Write-Warning 'RESPINSA: sunt necesare minimum 14 caractere. Reincepeti in promptul mascat.'; continue }
    if ($first -cne $second) { Write-Warning 'RESPINSA: cele doua introduceri nu coincid. Reincepeti in promptul mascat.'; continue }
    $classes = 0
    if ($first -cmatch '[a-z]') { $classes++ }
    if ($first -cmatch '[A-Z]') { $classes++ }
    if ($first -match '[0-9]') { $classes++ }
    if ($first -match '[^a-zA-Z0-9]') { $classes++ }
    if ($classes -lt 3) { Write-Warning 'RESPINSA: utilizati cel putin trei categorii (litere mici, majuscule, cifre, simboluri).'; continue }
    if ($first -match '(?i)parola|password|agmtransporte|adrianmuscalu|(.)\1{5,}') { Write-Warning 'RESPINSA: parola contine un model previzibil. Alegeti una complet diferita.'; continue }
    $passwordHash = Invoke-NodeBcrypt $first
  } finally {
    $first = $null
    $second = $null
    $firstSecure.Dispose()
    $secondSecure.Dispose()
  }
}

$userId = [guid]::NewGuid().ToString()
$ownerUserRoleId = [guid]::NewGuid().ToString()
$premiumUserRoleId = [guid]::NewGuid().ToString()
$escapedEmail = $Email.Replace("'", "''").ToLowerInvariant()
$escapedHash = $passwordHash.Replace("'", "''")

$sql = @"
BEGIN;
DO `$account`$
DECLARE target_company uuid; owner_role uuid; premium_role uuid; existing_count integer;
BEGIN
  SELECT count(*) INTO existing_count FROM "User" WHERE lower(email)=lower('$escapedEmail');
  IF existing_count <> 0 THEN RAISE EXCEPTION 'PRODUCT_OWNER_EMAIL_ALREADY_EXISTS'; END IF;
  SELECT DISTINCT u."companyId" INTO target_company FROM "User" u JOIN "UserRole" ur ON ur."userId"=u.id JOIN "Role" r ON r.id=ur."roleId" WHERE u.status='Active' AND r.code='company_owner' AND r."isActive"=true;
  IF target_company IS NULL THEN RAISE EXCEPTION 'OWNER_COMPANY_NOT_FOUND'; END IF;
  SELECT id INTO owner_role FROM "Role" WHERE "companyId"=target_company AND code='company_owner' AND "isActive"=true;
  SELECT id INTO premium_role FROM "Role" WHERE "companyId"=target_company AND code='PREMIUM_ACCESS' AND "isActive"=true;
  IF owner_role IS NULL OR premium_role IS NULL THEN RAISE EXCEPTION 'REQUIRED_ACTIVE_ROLE_NOT_FOUND'; END IF;
  INSERT INTO "User"(id,"companyId","displayName",email,"passwordHash",status,"personalDataStatus","createdAt","updatedAt") VALUES('$userId',target_company,'AGM Product Owner','$escapedEmail','$escapedHash','Active','Active',now(),now());
  INSERT INTO "UserRole"(id,"companyId","userId","roleId","assignedByUserId","assignedAt") VALUES('$ownerUserRoleId',target_company,'$userId',owner_role,'$userId',now());
  INSERT INTO "UserRole"(id,"companyId","userId","roleId","assignedByUserId","assignedAt") VALUES('$premiumUserRoleId',target_company,'$userId',premium_role,'$userId',now());
END `$account`$;
COMMIT;
SELECT json_build_object('account_active',count(DISTINCT u.id)=1,'owner_active',count(DISTINCT u.id) FILTER (WHERE r.code='company_owner' AND r."isActive"=true)=1,'premium_active',count(DISTINCT u.id) FILTER (WHERE r.code='PREMIUM_ACCESS' AND r."isActive"=true)=1) FROM "User" u LEFT JOIN "UserRole" ur ON ur."userId"=u.id LEFT JOIN "Role" r ON r.id=ur."roleId" WHERE u.id='$userId' AND u.status='Active';
"@

$ssh = [Diagnostics.ProcessStartInfo]::new()
$ssh.FileName = 'ssh.exe'
$ssh.Arguments = "-o BatchMode=yes -o ConnectTimeout=10 -i `"$IdentityPath`" agmops@$HostAddress sudo -n docker exec -i agm-postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" -At'"
$ssh.UseShellExecute = $false
$ssh.RedirectStandardInput = $true
$ssh.RedirectStandardOutput = $true
$ssh.RedirectStandardError = $true
$ssh.CreateNoWindow = $true
$resultPath = Join-Path $PSScriptRoot '..\evidence\governance\PRODUCT_OWNER_PRODUCTION_CREATION_RESULT.json'
$process = [Diagnostics.Process]::Start($ssh)
try {
  $process.StandardInput.Write($sql)
  $process.StandardInput.Close()
  $result = $process.StandardOutput.ReadToEnd()
  $errorText = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw "Crearea contului a eșuat; tranzacția a fost anulată. $errorText" }
  $safeResult = ($result -split "`r?`n" | Where-Object { $_ -match '^\{' } | Select-Object -Last 1)
  if (-not $safeResult) { throw 'Răspunsul de validare Production lipsește.' }
  $validated = $safeResult | ConvertFrom-Json
  if (-not ($validated.account_active -and $validated.owner_active -and $validated.premium_active)) {
    throw 'Final account and role validation failed.'
  }
  [ordered]@{
    status = 'COMPLETED'
    email = $Email
    account_active = [bool]$validated.account_active
    owner_active = [bool]$validated.owner_active
    premium_active = [bool]$validated.premium_active
    age_18_confirmed = $true
    age_confirmation_method = 'administrative-attestation-no-birth-date-collected'
    verified_at = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json | Set-Content -LiteralPath $resultPath -Encoding UTF8
  Write-Host $safeResult
  Write-Host 'PRODUCT OWNER ACCOUNT CREATION - COMPLETE' -ForegroundColor Green
  Read-Host 'Apăsați Enter pentru închiderea sigură a ferestrei' | Out-Null
} catch {
  [ordered]@{
    status = 'FAILED'
    email = $Email
    reason = 'Production transaction or validation failed. No password, hash, token, or SQL was recorded.'
    verified_at = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json | Set-Content -LiteralPath $resultPath -Encoding UTF8
  Write-Host ''
  Write-Host 'PRODUCT OWNER ACCOUNT CREATION - FAILED' -ForegroundColor Red
  Write-Host 'Transaction rolled back. No password or hash was recorded.' -ForegroundColor Yellow
  Read-Host 'Press Enter to close this secure window' | Out-Null
  throw
} finally {
  $passwordHash = $null
  $escapedHash = $null
  $sql = $null
  $process.Dispose()
}
