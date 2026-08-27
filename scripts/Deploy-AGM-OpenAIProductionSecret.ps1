param(
  [string]$HostAddress = '167.233.237.253',
  [string]$IdentityPath = "$env:USERPROFILE\.ssh\agm_release_operations_hetzner_ed25519",
  [string]$InstallerPath = "$PSScriptRoot\Install-AGM-OpenAIProductionSecret.sh",
  [string]$LocalEnvPath = "$PSScriptRoot\..\.env",
  [string]$DpapiPath = "$env:LOCALAPPDATA\AGM\secrets\openai-production-key.dpapi"
)

$ErrorActionPreference = 'Stop'
$key = [Console]::In.ReadToEnd().Trim()
if ([string]::IsNullOrWhiteSpace($key) -or -not $key.StartsWith('sk-')) { throw 'OPENAI_KEY_INPUT_INVALID' }

try {
  $body = @{ model = 'gpt-4.1-mini'; input = 'Return exactly: AGM_ROTATION_OK'; max_output_tokens = 16 } | ConvertTo-Json -Compress
  $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'https://api.openai.com/v1/responses' -Headers @{ Authorization = "Bearer $key"; 'Content-Type' = 'application/json' } -Body $body -TimeoutSec 30
  if ([int]$response.StatusCode -ne 200) { throw 'NEW_KEY_FUNCTIONAL_TEST_FAILED' }

  $dpapiDirectory = Split-Path -Parent $DpapiPath
  New-Item -ItemType Directory -Path $dpapiDirectory -Force | Out-Null
  $secure = ConvertTo-SecureString $key -AsPlainText -Force
  $encrypted = ConvertFrom-SecureString $secure
  $dpapiTemp = Join-Path $dpapiDirectory ('.openai-key.' + [guid]::NewGuid().ToString('N') + '.tmp')
  [IO.File]::WriteAllText($dpapiTemp, $encrypted, [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $dpapiTemp -Destination $DpapiPath -Force

  & scp.exe -q -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new -i $IdentityPath $InstallerPath "agmops@${HostAddress}:/tmp/agm-install-openai-secret.sh"
  if ($LASTEXITCODE -ne 0) { throw 'INSTALLER_UPLOAD_FAILED' }

  $startInfo = [Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = 'ssh.exe'
  $startInfo.Arguments = "-o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new -i `"$IdentityPath`" agmops@$HostAddress `"sudo -n bash /tmp/agm-install-openai-secret.sh; rc=`$?; rm -f /tmp/agm-install-openai-secret.sh; exit `$rc`""
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.CreateNoWindow = $true
  $process = [Diagnostics.Process]::Start($startInfo)
  $process.StandardInput.Write($key)
  $process.StandardInput.Close()
  $safeRemoteOutput = $process.StandardOutput.ReadToEnd().Trim()
  $remoteError = $process.StandardError.ReadToEnd().Trim()
  $process.WaitForExit(30000) | Out-Null
  if ($process.ExitCode -ne 0) { throw "REMOTE_SECRET_INSTALL_FAILED: $remoteError" }

  if (Test-Path -LiteralPath $LocalEnvPath) {
    $remaining = Get-Content -LiteralPath $LocalEnvPath | Where-Object { $_ -notmatch '^OPENAI_API_KEY=' }
    [IO.File]::WriteAllLines($LocalEnvPath, [string[]]$remaining, [Text.UTF8Encoding]::new($false))
  }

  & ssh.exe -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new -i $IdentityPath "agmops@$HostAddress" "sudo -n systemctl reload agm-production-api.service"
  if ($LASTEXITCODE -ne 0) { throw 'CONTROLLED_RELOAD_FAILED' }

  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Seconds 2
    try {
      $health = Invoke-WebRequest -UseBasicParsing -Uri 'https://api.agmcockpit.com/api/v1/health/ready' -TimeoutSec 8
      if ([int]$health.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
  }
  if (-not $ready) { throw 'PRODUCTION_READY_FAILED_AFTER_ROTATION' }

  [ordered]@{
    newKeyFunctionalHttp = 200
    dpapiCustody = 'CONFIGURED'
    remoteInstall = $safeRemoteOutput
    localEnvSecretRemoved = -not ((Get-Content -LiteralPath $LocalEnvPath -ErrorAction SilentlyContinue) -match '^OPENAI_API_KEY=')
    controlledReload = 'EXECUTED'
    productionReadyHttp = 200
  } | ConvertTo-Json
} finally {
  $key = $null
  if ($secure) { $secure.Dispose() }
  if ($dpapiTemp -and (Test-Path -LiteralPath $dpapiTemp)) { Remove-Item -LiteralPath $dpapiTemp -Force }
}
