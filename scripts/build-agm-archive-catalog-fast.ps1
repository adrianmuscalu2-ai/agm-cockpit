$ErrorActionPreference = 'Stop'
$repo = (Get-Location).Path
$documents = Split-Path -Parent $repo
$roots = @('AGM','AGM-phase1-5-boundary','AGM-CANONICAL-CANDIDATE-20261022','AGM-TURN-INTEGRATION-20261029','AGM-TURN-GITHUB-PROMOTION-20261028','AGM-TURN-RELEASE-PROMOTION-20261028') | ForEach-Object { Join-Path $documents $_ } | Where-Object { Test-Path $_ }
$out = Join-Path $repo 'release/turn-20261028/archive/AGM_ARCHIVE_20261030'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$signal = '(?i)(journal|incident|canonical|manifest|release|evidence|version|checkpoint|shutdown|report|log|environment|governance|handoff|changelog|rollback|preflight|validation|rescue)'
$secret = '(?i)(secret|token|jwt|credential|password|private-key|\.env)'
$records = foreach ($root in $roots) {
  $top = (& git -C $root rev-parse --show-toplevel 2>$null)
  if ($LASTEXITCODE -ne 0) { continue }
  $paths = & git -C $root ls-files --cached --others --exclude-standard 2>$null
  foreach ($path in $paths) {
    if ($path -notmatch $signal -or $path -match '(?i)(node_modules|dist|build|coverage|\.git)' -or $path -notmatch '(?i)\.(md|json|jsonl|txt|log|yml|yaml|csv|xml|ps1|sh)$') { continue }
    $label = if ($path -match '(?i)turn') { 'TURN' } elseif ($path -match '(?i)governance') { 'GOVERNANCE' } elseif ($path -match '(?i)incident') { 'INCIDENTS' } elseif ($path -match '(?i)canonical') { 'CANONICAL_SOURCES' } elseif ($path -match '(?i)release|preflight|deploy') { 'RELEASES' } elseif ($path -match '(?i)browser') { 'BROWSER_EVIDENCE' } elseif ($path -match '(?i)machine|runtime|environment') { 'RUNTIME_ENVIRONMENTS' } else { 'GENERAL_EVIDENCE' }
    $kind = if ($path -match '(?i)journal|log|changelog|handoff') { 'JOURNAL' } elseif ($path -match '(?i)incident') { 'INCIDENT' } elseif ($path -match '(?i)manifest|canonical') { 'CANONICAL_OR_MANIFEST' } elseif ($path -match '(?i)version|release') { 'VERSION_OR_RELEASE' } elseif ($path -match '(?i)checkpoint|shutdown|preflight|validation|report|rescue') { 'CHECKPOINT_OR_REPORT' } elseif ($path -match '(?i)environment') { 'ENVIRONMENT' } else { 'EVIDENCE' }
    [pscustomobject]@{ label=$label; kind=$kind; root=$root; path=$path; absolutePath=(Join-Path $root $path); sensitive=($path -match $secret); sourceTracked=$true; archiveMode='PATH_INDEX_ONLY_ORIGINAL_PRESERVED' }
  }
}
$records = @($records | Sort-Object label,kind,root,path -Unique)
$records | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $out 'records.json') -Encoding UTF8
$records | ForEach-Object { '{0}`t{1}`t{2}`t{3}' -f $_.label,$_.kind,$_.root,$_.path } | Set-Content (Join-Path $out 'search-index.tsv') -Encoding UTF8
$roots | ConvertTo-Json | Set-Content (Join-Path $out 'roots.json') -Encoding UTF8
$history = foreach ($root in $roots) { git -C $root log --all --date=iso-strict --pretty=format:'{"root":"' + $root.Replace('\','/') + '","commit":"%H","parent":"%P","author":"%an","date":"%aI","subject":"%s"}' 2>$null }
$history | Set-Content (Join-Path $out 'commit-history.jsonl') -Encoding UTF8
$wt = git -C $repo worktree list --porcelain 2>$null
$wt | Set-Content (Join-Path $out 'git-worktrees.txt') -Encoding UTF8
$statusRows = foreach ($root in $roots) { [pscustomobject]@{ root=$root; status=((& git -C $root status --short --branch 2>$null) -join ' | '); head=((& git -C $root rev-parse HEAD 2>$null) -join '') } }
$statusRows | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $out 'worktree-status.json') -Encoding UTF8
$docker = docker ps --format '{{.Names}}`t{{.Image}}`t{{.Ports}}' 2>$null
@('Generated UTC: ' + (Get-Date).ToUniversalTime().ToString('o'), 'Docker metadata (no environment values):') + @($docker) | Set-Content (Join-Path $out 'environment-inventory.txt') -Encoding UTF8
[pscustomobject]@{generatedAtUtc=(Get-Date).ToUniversalTime().ToString('o'); roots=$roots; recordCount=$records.Count; sensitivePathCount=@($records | Where-Object sensitive).Count; note='Non-destructive path catalog. Original files and worktrees preserved; content is not copied.'} | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $out 'catalog-summary.json') -Encoding UTF8
@'
# AGM archive catalog — 2026-10-30

Non-destructive path catalog for journals, incidents, canonical sources,
versions, release manifests, commits, environments and evidence. Original
files and worktrees remain unchanged. Search `records.json` or
`search-index.tsv` by `label`, `kind`, `root` or `path`.

Libraries:
- `TURN`: Turn UI, spatial models and visual evidence.
- `INCIDENTS`: incidents, journals, resolutions and handoffs.
- `CANONICAL_SOURCES`: canonical registries, manifests and digests.
- `RELEASES`: release, deploy, preflight and rollback records.
- `GOVERNANCE`: governance contracts, activation packages and validation.
- `RUNTIME_ENVIRONMENTS`: Machine, Production, local environments and lifecycle.
- `BROWSER_EVIDENCE`: browser reports and visual validation records.

Sensitive-looking paths are indexed by metadata only and are not copied or
printed. This catalog is an archive index, not a claim that every historical
record is current or authoritative.
'@ | Set-Content (Join-Path $out 'README.md') -Encoding UTF8
Write-Output (Join-Path $out 'catalog-summary.json')
