$ErrorActionPreference = 'Stop'
$samples = Get-Counter -Counter '\Processor(_Total)\% Processor Time','\System\Processor Queue Length' -MaxSamples 2 -SampleInterval 1 |
  Select-Object -ExpandProperty CounterSamples
if (@($samples).Count -ne 4 -or @($samples | Where-Object { $_.Status -ne 0 }).Count -ne 0) { throw 'TELEMETRY_UNAVAILABLE' }
$cpu = @($samples | Where-Object { $_.Path -match '(?i)processor\(_total\).*% processor time' } | ForEach-Object CookedValue)
$queue = @($samples | Where-Object { $_.Path -match '(?i)processor queue length' } | ForEach-Object CookedValue)
if ($cpu.Count -ne 2 -or $queue.Count -ne 2 -or @($cpu + $queue | Where-Object { $null -eq $_ -or [double]::IsNaN([double]$_) }).Count) { throw 'TELEMETRY_UNAVAILABLE' }
[pscustomobject]@{ contract='agm-p9-windows-host-counters.v1'; powershell=$PSVersionTable.PSVersion.ToString(); cpuSamples=$cpu.Count; queueSamples=$queue.Count; status='PASS' } | ConvertTo-Json -Compress
