param(
  [Parameter(Mandatory = $true)][long]$ServerId,
  [string]$ExpectedIpv4 = '167.233.237.253',
  [string]$IdentityPath = "$env:USERPROFILE\.ssh\agm_release_operations_hetzner_ed25519",
  [string]$PublicKeyPath = "$env:USERPROFILE\.ssh\agm_release_operations_hetzner_ed25519.pub"
)

$ErrorActionPreference = 'Stop'
$api = 'https://api.hetzner.cloud/v1'
$token = [Environment]::GetEnvironmentVariable('HCLOUD_TOKEN', 'Process')
if ([string]::IsNullOrWhiteSpace($token)) { throw 'HCLOUD_TOKEN_MISSING' }
if (!(Test-Path -LiteralPath $IdentityPath) -or !(Test-Path -LiteralPath $PublicKeyPath)) { throw 'RELEASE_OPERATIONS_IDENTITY_MISSING' }
function Invoke-Hetzner([string]$Method, [string]$Path, [object]$Body = $null) {
  $parameters = @{ Method = $Method; Uri = "$api$Path"; Headers = @{ Authorization = "Bearer $token" }; ContentType = 'application/json' }
  if ($null -ne $Body) { $parameters.Body = ($Body | ConvertTo-Json -Compress) }
  Invoke-RestMethod @parameters
}
function Wait-HetznerAction([long]$ActionId, [int]$TimeoutSeconds = 120) {
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  do {
    Start-Sleep -Seconds 2
    $action = (Invoke-Hetzner 'GET' "/actions/$ActionId").action
    if ($action.status -eq 'success') { return }
    if ($action.status -eq 'error') { throw "HETZNER_ACTION_FAILED_$ActionId" }
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "HETZNER_ACTION_TIMEOUT_$ActionId"
}
function Invoke-HetznerAction([string]$Path, [object]$Body = $null) {
  $response = Invoke-Hetzner 'POST' $Path $Body
  Wait-HetznerAction ([long]$response.action.id)
}

$server = (Invoke-Hetzner 'GET' "/servers/$ServerId").server
if ($server.public_net.ipv4.ip -ne $ExpectedIpv4) { throw 'SERVER_TARGET_MISMATCH' }
$publicKey = (Get-Content -LiteralPath $PublicKeyPath -Raw).Trim()
$fingerprint = (& ssh-keygen -lf $PublicKeyPath).Split(' ')[1]
$existing = (Invoke-Hetzner 'GET' '/ssh_keys').ssh_keys | Where-Object fingerprint -eq $fingerprint | Select-Object -First 1
$createdKey = $false
if (!$existing) {
  $existing = (Invoke-Hetzner 'POST' '/ssh_keys' @{ name = 'agm-release-operations-recovery'; public_key = $publicKey }).ssh_key
  $createdKey = $true
}

try {
  $rescueKnownHosts = Join-Path ([IO.Path]::GetTempPath()) ('.agm-rescue-known-hosts-' + [guid]::NewGuid().ToString('N'))
  Invoke-HetznerAction "/servers/$ServerId/actions/enable_rescue" @{ type = 'linux64'; ssh_keys = @([long]$existing.id) }
  Invoke-HetznerAction "/servers/$ServerId/actions/reboot"
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 5
    $ErrorActionPreference = 'Continue'
    & ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no -o "UserKnownHostsFile=$rescueKnownHosts" -i $IdentityPath "root@$ExpectedIpv4" true 2>$null
    $sshExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($sshExit -eq 0) { $ready = $true; break }
  }
  if (!$ready) { throw 'RESCUE_SSH_UNAVAILABLE' }

  $ErrorActionPreference = 'Continue'
  $installer = "$PSScriptRoot\..\deploy\production\install-agmops-authorized-key.sh"
  & scp -q -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=no -o "UserKnownHostsFile=$rescueKnownHosts" -i $IdentityPath $installer $PublicKeyPath "root@${ExpectedIpv4}:/tmp/"
  $copyExit = $LASTEXITCODE
  if ($copyExit -eq 0) {
    & ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=no -o "UserKnownHostsFile=$rescueKnownHosts" -i $IdentityPath "root@$ExpectedIpv4" "bash /tmp/install-agmops-authorized-key.sh /tmp/agm_release_operations_hetzner_ed25519.pub; rm -f /tmp/install-agmops-authorized-key.sh /tmp/agm_release_operations_hetzner_ed25519.pub"
  }
  $installExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($copyExit -ne 0 -or $installExit -ne 0) { throw 'AUTHORIZED_KEY_INSTALLATION_FAILED' }

  Invoke-HetznerAction "/servers/$ServerId/actions/disable_rescue"
  Invoke-HetznerAction "/servers/$ServerId/actions/reboot"
  Start-Sleep -Seconds 20
  $ErrorActionPreference = 'Continue'
  & ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -i $IdentityPath "agmops@$ExpectedIpv4" true 2>$null
  $validationExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($validationExit -ne 0) { throw 'AGMOPS_VALIDATION_FAILED' }
  'SSH recovery: PASS'
} finally {
  try { Invoke-HetznerAction "/servers/$ServerId/actions/disable_rescue" } catch {}
  if ($createdKey -and $existing.id) { try { Invoke-Hetzner 'DELETE' "/ssh_keys/$($existing.id)" | Out-Null } catch {} }
  if ($rescueKnownHosts -and (Test-Path -LiteralPath $rescueKnownHosts)) { Remove-Item -LiteralPath $rescueKnownHosts -Force }
}
