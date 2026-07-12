param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$FrontendUrl = "http://localhost:5173"
$ApiPort = 3000
$WebPort = 5173

function Write-Step {
  param([string]$Message)
  Write-Host "[AGM] $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Fail {
  param([string]$Message)
  Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Read-EnvFile {
  param([string]$Path)

  $values = @{}

  if (-not (Test-Path $Path)) {
    return $values
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()

    if (-not $line -or $line.StartsWith("#") -or $line -notmatch "=") {
      return
    }

    $parts = $line -split "=", 2
    $values[$parts[0].Trim()] = $parts[1].Trim()
  }

  return $values
}

function Get-AgmEnvironment {
  param([hashtable]$EnvValues)

  $databaseUrl = $EnvValues["DATABASE_URL"]

  if (-not $databaseUrl) {
    throw "DATABASE_URL is missing from .env. Cannot detect Docker or Neon startup mode."
  }

  if ($databaseUrl -match "neon\.tech|neon\.com|pooler|sslmode=require") {
    return "LaptopNeon"
  }

  if ($databaseUrl -match "localhost|127\.0\.0\.1|host\.docker\.internal") {
    return "PcDocker"
  }

  throw "DATABASE_URL does not clearly identify Docker or Neon. Use a local PostgreSQL URL for PC or a Neon URL for laptop."
}

function Test-PortListening {
  param([int]$Port)

  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $connection
}

function Test-CommandExists {
  param([string]$Command)

  return $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Start-CmdWindow {
  param(
    [string]$Title,
    [string]$Command
  )

  if ($DryRun) {
    Write-Step "Dry run: would start '$Title' with command: $Command"
    return
  }

  Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "title $Title && cd /d `"$Root`" && $Command"
}

function Start-DockerDesktop {
  $dockerDesktopPaths = @(
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
  )

  foreach ($path in $dockerDesktopPaths) {
    if ($path -and (Test-Path $path)) {
      Write-Step "Starting Docker Desktop..."

      if (-not $DryRun) {
        Start-Process -FilePath $path
      }

      return
    }
  }

  throw "Docker Desktop was not found. Start Docker Desktop manually or install it."
}

function Test-DockerEngine {
  if (-not (Test-CommandExists "docker")) {
    throw "Docker CLI was not found. Install Docker Desktop and try again."
  }

  docker info *> $null
  return $LASTEXITCODE -eq 0
}

function Wait-DockerEngine {
  $timeoutSeconds = 120
  $startedAt = Get-Date

  while (((Get-Date) - $startedAt).TotalSeconds -lt $timeoutSeconds) {
    if (Test-DockerEngine) {
      Write-Ok "Docker Engine is available."
      return
    }

    Start-Sleep -Seconds 3
  }

  throw "Docker Engine did not become available within $timeoutSeconds seconds."
}

function Ensure-DockerReady {
  if ($DryRun) {
    Write-Step "Dry run: would check Docker Engine and start Docker Desktop if needed."
    return
  }

  if (Test-DockerEngine) {
    Write-Ok "Docker Engine is already available."
    return
  }

  Start-DockerDesktop
  Wait-DockerEngine
}

function Test-PostgresContainerRunning {
  if (-not (Test-CommandExists "docker")) {
    return $false
  }

  $containerId = docker compose ps -q postgres 2>$null

  if (-not $containerId) {
    return $false
  }

  $status = docker inspect -f "{{.State.Running}}" $containerId 2>$null
  return $status -eq "true"
}

function Start-DatabaseIfNeeded {
  if ($DryRun) {
    Write-Step "Dry run: would start PostgreSQL with docker compose up if it is not already running."
    return
  }

  if (Test-PostgresContainerRunning) {
    Write-Ok "PostgreSQL container is already running."
    return
  }

  Start-CmdWindow -Title "AGM PostgreSQL" -Command "docker compose up"
}

function Start-ApiIfNeeded {
  if (Test-PortListening -Port $ApiPort) {
    Write-Ok "API already appears to be running on port $ApiPort."
    return
  }

  Start-CmdWindow -Title "AGM API" -Command "pnpm api:dev"
}

function Start-WebIfNeeded {
  if (Test-PortListening -Port $WebPort) {
    Write-Ok "Frontend already appears to be running on port $WebPort."
    return
  }

  Start-CmdWindow -Title "AGM Frontend" -Command "pnpm dev"
}

function Open-Frontend {
  if ($DryRun) {
    Write-Step "Dry run: would open $FrontendUrl"
    return
  }

  Start-Process $FrontendUrl
}

function Wait-Port {
  param(
    [int]$Port,
    [string]$Name,
    [int]$TimeoutSeconds = 90
  )

  if ($DryRun) {
    Write-Step "Dry run: would wait for $Name on port $Port"
    return
  }

  $startedAt = Get-Date

  while (((Get-Date) - $startedAt).TotalSeconds -lt $TimeoutSeconds) {
    if (Test-PortListening -Port $Port) {
      Write-Ok "$Name is listening on port $Port."
      return
    }

    Start-Sleep -Seconds 2
  }

  Write-Warn "$Name did not open port $Port within $TimeoutSeconds seconds. Continuing startup flow."
}

try {
  Set-Location $Root
  Write-Step "Starting AGM from $Root"

  if (-not (Test-CommandExists "pnpm")) {
    throw "pnpm was not found. Enable Corepack or install pnpm, then try again."
  }

  $envValues = Read-EnvFile -Path (Join-Path $Root ".env")
  $mode = Get-AgmEnvironment -EnvValues $envValues
  Write-Ok "Detected startup mode: $mode"

  if ($mode -eq "PcDocker") {
    Ensure-DockerReady
    Start-DatabaseIfNeeded
  } else {
    Write-Ok "Neon configuration detected. Docker will not be started."
  }

  Start-ApiIfNeeded
  Start-WebIfNeeded
  Wait-Port -Port $ApiPort -Name "API"
  Wait-Port -Port $WebPort -Name "Frontend"
  Open-Frontend

  Write-Ok "AGM startup flow completed. Open $FrontendUrl if the browser did not open automatically."
}
catch {
  Write-Fail $_.Exception.Message
  exit 1
}
