param(
  [string]$HostAddress = '167.233.237.253',
  [string]$IdentityPath = "$env:USERPROFILE\.ssh\agm_release_operations_hetzner_ed25519",
  [string]$PublicApi = 'https://api.agmcockpit.com/api/v1',
  [string]$OutputPath = "$PSScriptRoot\..\.tmp\production-preflight.latest.json"
)

$ErrorActionPreference = 'SilentlyContinue'
$checkedAt = (Get-Date).ToUniversalTime().ToString('o')
$checks = [System.Collections.Generic.List[object]]::new()
function Add-Check([string]$Id, [string]$Status, [string]$Detail) {
  $checks.Add([ordered]@{ id = $Id; status = $Status; checkedAt = $checkedAt; safeDetail = $Detail })
}

$identityExists = Test-Path -LiteralPath $IdentityPath
Add-Check 'ssh-identity' $(if($identityExists){'PASS'}else{'FAIL'}) $(if($identityExists){'Identitatea dedicată Release & Operations există.'}else{'Identitatea dedicată Release & Operations lipsește.'})

$agent = Get-Service ssh-agent
$agentReady = $agent -and $agent.Status -eq 'Running'
$identityIsolationReady = $identityExists
Add-Check 'ssh-agent' $(if($agentReady -or $identityIsolationReady){'PASS'}else{'NOT CONFIGURED'}) $(if($agentReady){'Agentul SSH este pornit.'}elseif($identityIsolationReady){'Identitatea dedicată este izolată și utilizată explicit; serviciul ssh-agent nu este necesar.'}else{'Nu este disponibil niciun mecanism local de identitate SSH.'})

$tcp = [System.Net.Sockets.TcpClient]::new()
try {
  $connect = $tcp.ConnectAsync($HostAddress, 22)
  $sshReachable = $connect.Wait(5000) -and $tcp.Connected
} catch { $sshReachable = $false } finally { $tcp.Dispose() }
Add-Check 'ssh-connectivity' $(if($sshReachable){'PASS'}else{'FAIL'}) $(if($sshReachable){'Portul SSH Production răspunde.'}else{'Portul SSH Production nu răspunde.'})

$sshAuthorized = $false
if ($identityExists -and $sshReachable) {
  & ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new -i $IdentityPath "agmops@$HostAddress" true 2>$null
  $sshAuthorized = $LASTEXITCODE -eq 0
}
Add-Check 'ssh-authentication' $(if($sshAuthorized){'PASS'}else{'FAIL'}) $(if($sshAuthorized){'Autentificarea agmops cu identitatea aprobată reușește.'}else{'Identitatea aprobată nu este încă autorizată pentru agmops.'})

$recoveryDocument = Test-Path -LiteralPath "$PSScriptRoot\..\deploy\production\SSH_ACCESS_RECOVERY.md"
$automationReportPath = "$PSScriptRoot\..\.tmp\hetzner-automation-channel.latest.json"
$automationReady = $false
if (Test-Path -LiteralPath $automationReportPath) {
  try { $automationReady = (Get-Content -LiteralPath $automationReportPath -Raw | ConvertFrom-Json).overallStatus -eq 'PASS' } catch { $automationReady = $false }
}
Add-Check 'console-rescue' $(if($automationReady){'PASS'}else{'NOT CONFIGURED'}) $(if($automationReady){'Canalul Hetzner API/Rescue automatizat este validat.'}else{'Canalul Hetzner API/Rescue automatizat nu este încă validat.'})

try { $live = Invoke-WebRequest -UseBasicParsing -Uri "$PublicApi/health/live" -TimeoutSec 8; $apiReady = $live.StatusCode -eq 200 } catch { $apiReady = $false }
Add-Check 'production-api' $(if($apiReady){'PASS'}else{'FAIL'}) $(if($apiReady){'API public live răspunde HTTP 200.'}else{'API public live nu răspunde HTTP 200.'})

$guardianStatus = $null
try {
  $guardian = Invoke-WebRequest -UseBasicParsing -Uri "$PublicApi/security/secrets/health" -TimeoutSec 8
  $guardianStatus = [int]$guardian.StatusCode
} catch {
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
    $guardianStatus = [int]$_.Exception.Response.StatusCode
  }
}
$guardianReady = $guardianStatus -in @(200, 401)
Add-Check 'guardian-telemetry' $(if($guardianReady){'PASS'}else{'FAIL'}) $(if($guardianStatus -eq 200){'Endpointul Guardian răspunde HTTP 200.'}elseif($guardianStatus -eq 401){'Endpointul Guardian există și refuză corect accesul neautentificat cu HTTP 401.'}else{'Endpointul Guardian nu răspunde cu un status sigur 200/401.'})

$recoveryReady = $recoveryDocument -and ($sshAuthorized -or $automationReady)
Add-Check 'recovery-procedure' $(if($recoveryReady){'PASS'}else{'FAIL'}) $(if($recoveryReady){'Există un canal automat și recuperabil validat.'}else{'Mecanismul automat de recuperare este incomplet.'})

$snapshot = [ordered]@{ contract = 'agm-production-preflight.v1'; environment = 'production'; checkedAt = $checkedAt; overallStatus = $(if(($checks | Where-Object status -ne 'PASS').Count -eq 0){'READY'}else{'ATTENTION'}); checks = $checks }
$directory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$snapshot | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
"Production preflight: $($snapshot.overallStatus)"
