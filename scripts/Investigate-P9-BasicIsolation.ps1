param([int]$Rounds = 3)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'evidence/governance/copilot-v1.2/p9/root-cause/runtime'
New-Item -ItemType Directory -Path $out -Force | Out-Null
$results = @()

function Snapshot-Resources {
  $counters = Get-Counter '\Processor(_Total)\% Processor Time','\Memory\Available MBytes','\PhysicalDisk(_Total)\Avg. Disk Queue Length' -MaxSamples 1
  $cpu = ($counters.CounterSamples | Where-Object Path -like '*processor(_total)*').CookedValue
  $memory = ($counters.CounterSamples | Where-Object Path -like '*memory*available mbytes').CookedValue
  $disk = ($counters.CounterSamples | Where-Object Path -like '*physicaldisk(_total)*').CookedValue
  [ordered]@{
    at = (Get-Date).ToUniversalTime().ToString('o')
    cpuPercent = [math]::Round($cpu, 2)
    availableMemoryMB = [math]::Round($memory, 2)
    diskQueue = [math]::Round($disk, 3)
    nodeProcesses = @(Get-Process node -ErrorAction SilentlyContinue).Count
    nodeWorkingSetMB = [math]::Round((@(Get-Process node -ErrorAction SilentlyContinue) | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 2)
  }
}

Push-Location $root
try {
  foreach ($mode in @('P9_OFF','P9_ON')) {
    for ($i = 1; $i -le $Rounds; $i++) {
      $before = Snapshot-Resources
      $p9 = $null
      if ($mode -eq 'P9_ON') {
        $p9 = Start-Process -FilePath 'cmd.exe' -ArgumentList '/d','/s','/c','pnpm.cmd exec tsx scripts/test-copilot-v1-2-p9-pilot.ts >nul 2>&1' -WindowStyle Hidden -PassThru
      }
      & node scripts/test-copilot-v1-2-p0-fault-isolation.mjs | Out-Null
      $exitCode = $LASTEXITCODE
      if ($p9) { $p9.WaitForExit(60000) | Out-Null }
      $report = Get-Content -Raw 'evidence/governance/copilot-v1.2/p0/runtime/basic-isolation-fault-injection-report.json' | ConvertFrom-Json
      $after = Snapshot-Resources
      $failed = @($report.failures | ForEach-Object { [ordered]@{ target=$_.target; phase=$_.phase; iteration=$_.iteration; latencyMs=$_.latencyMs; error=$_.error } })
      $record = [ordered]@{ mode=$mode; round=$i; exitCode=$exitCode; generatedAt=$report.generatedAt; availabilityPercent=$report.availabilityPercent; p95Ms=$report.latencyMs.p95; maxMs=$report.latencyMs.max; failures=$failed; before=$before; after=$after }
      $results += [pscustomobject]$record
      $record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $out "$($mode.ToLower())-$i.json") -Encoding utf8
    }
  }
} finally { Pop-Location }

$summary = [ordered]@{
  contract='agm-copilot-v1.2-p9-basic-isolation-controlled-comparison.v1'
  generatedAt=(Get-Date).ToUniversalTime().ToString('o')
  roundsPerMode=$Rounds
  results=$results
  aggregate=@{
    p9OffFailures=@($results | Where-Object {$_.mode -eq 'P9_OFF' -and $_.exitCode -ne 0}).Count
    p9OnFailures=@($results | Where-Object {$_.mode -eq 'P9_ON' -and $_.exitCode -ne 0}).Count
    p9OffMaxMs=($results | Where-Object {$_.mode -eq 'P9_OFF'} | Measure-Object maxMs -Maximum).Maximum
    p9OnMaxMs=($results | Where-Object {$_.mode -eq 'P9_ON'} | Measure-Object maxMs -Maximum).Maximum
  }
}
$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $out 'controlled-comparison.json') -Encoding utf8
Write-Output "P9 BASIC ISOLATION CONTROLLED COMPARISON - COMPLETE"
