param(
  [switch]$RunOnce
)

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$LogDirectory = Join-Path $Root '.tmp\services'
$SupervisorLog = Join-Path $LogDirectory 'supervisor.log'
$ApiStandardOutput = Join-Path $LogDirectory 'api.stdout.log'
$ApiStandardError = Join-Path $LogDirectory 'api.stderr.log'
$ApiHealthUrl = 'http://127.0.0.1:3000/api/v1/health/live'
$ApiReadinessUrl = 'http://127.0.0.1:3000/api/v1/health/ready'
$DockerTimeoutSeconds = 180
$DatabaseTimeoutSeconds = 90
$PollSeconds = 10

New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null

function Write-ServiceLog {
  param([string]$Message)
  $line = "$(Get-Date -Format o) $Message"
  Add-Content -LiteralPath $SupervisorLog -Value $line
}

function Test-DockerEngine {
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & docker info *> $null
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  return $exitCode -eq 0
}

function Start-DockerDesktopIfNeeded {
  if (Test-DockerEngine) {
    return
  }

  $paths = @(
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
  )
  $executable = $paths | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  if (-not $executable) {
    throw 'Docker Desktop was not found.'
  }

  Write-ServiceLog 'Starting Docker Desktop.'
  Start-Process -FilePath $executable -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds($DockerTimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    if (Test-DockerEngine) {
      Write-ServiceLog 'Docker Engine is ready.'
      return
    }
  }

  throw "Docker Engine did not become ready within $DockerTimeoutSeconds seconds."
}

function Ensure-Postgres {
  Set-Location $Root
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & docker compose --env-file docker-compose.env up -d postgres *> $null
  $exitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorPreference
  if ($exitCode -ne 0) {
    throw 'docker compose could not start PostgreSQL.'
  }

  $deadline = (Get-Date).AddSeconds($DatabaseTimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $containerId = (& docker compose --env-file docker-compose.env ps -q postgres 2>$null | Select-Object -First 1)
    $ErrorActionPreference = $previousErrorPreference
    if ($containerId) {
      $health = (& docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $containerId 2>$null)
      if ($health -eq 'healthy' -or $health -eq 'running') {
        return
      }
    }
    Start-Sleep -Seconds 2
  }

  throw "PostgreSQL did not become ready within $DatabaseTimeoutSeconds seconds."
}

function Test-Endpoint {
  param([string]$Uri)
  try {
    $response = Invoke-RestMethod -Uri $Uri -TimeoutSec 5
    return $response.data.status -in @('ok', 'ready')
  } catch {
    return $false
  }
}

function Start-ApiIfNeeded {
  if (Test-Endpoint -Uri $ApiHealthUrl) {
    return $null
  }

  Write-ServiceLog 'Starting AGM API.'
  return Start-Process -FilePath 'pnpm.cmd' `
    -ArgumentList '--filter', '@agm/api', 'start' `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $ApiStandardOutput `
    -RedirectStandardError $ApiStandardError `
    -PassThru
}

$mutex = New-Object Threading.Mutex($false, 'Local\AGM-Service-Supervisor')
if (-not $mutex.WaitOne(0, $false)) {
  Write-ServiceLog 'A supervisor instance is already running. Exiting duplicate task.'
  exit 0
}

try {
  Write-ServiceLog 'AGM service supervisor started.'
  $lastStatus = 'starting'

  do {
    try {
      Start-DockerDesktopIfNeeded
      Ensure-Postgres
      $apiProcess = Start-ApiIfNeeded

      $deadline = (Get-Date).AddSeconds(60)
      while (-not (Test-Endpoint -Uri $ApiHealthUrl) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 2
      }

      if (-not (Test-Endpoint -Uri $ApiHealthUrl)) {
        throw 'AGM API did not pass its liveness check.'
      }

      if (-not (Test-Endpoint -Uri $ApiReadinessUrl)) {
        if ($lastStatus -ne 'degraded') {
          Write-ServiceLog 'AGM API is live but readiness is not yet available.'
        }
        $lastStatus = 'degraded'
      } else {
        if ($lastStatus -ne 'ready') {
          Write-ServiceLog 'AGM API and PostgreSQL are ready.'
        }
        $lastStatus = 'ready'
      }
    } catch {
      if ($lastStatus -ne 'failed') {
        Write-ServiceLog "Recovery cycle failed: $($_.Exception.Message)"
      }
      $lastStatus = 'failed'
    }

    if (-not $RunOnce) {
      Start-Sleep -Seconds $PollSeconds
    }
  } while (-not $RunOnce)
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
  Write-ServiceLog 'AGM service supervisor stopped.'
}
