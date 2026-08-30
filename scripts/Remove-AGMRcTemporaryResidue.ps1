param(
  [string]$Workspace = 'C:\Users\adria\Documents\AGM',
  [string]$AuditPath = 'C:\Users\adria\Documents\AGM\evidence\production-release\tmp-deletion-audit.json'
)
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath $Workspace).Path.TrimEnd('\')
$target = (Resolve-Path -LiteralPath (Join-Path $root '.tmp')).Path.TrimEnd('\')
$expected = (Join-Path $root '.tmp').TrimEnd('\')
$library = (Join-Path $root 'AGM_LIBRARY').TrimEnd('\')
$evidence = (Join-Path $root 'evidence').TrimEnd('\')

if ($target -cne $expected) { throw "TMP_CANONICAL_PATH_MISMATCH:$target" }
if ($target -ceq $root) { throw 'TMP_TARGET_IS_REPOSITORY_ROOT' }
if ($target -ceq $library) { throw 'TMP_TARGET_IS_AGM_LIBRARY' }
if ($target -ceq $evidence) { throw 'TMP_TARGET_IS_EVIDENCE' }

function Get-Inventory([string]$Path) {
  [long]$files = 0
  [long]$bytes = 0
  [long]$directories = 0
  $reparsePoints = [Collections.Generic.List[string]]::new()
  $failures = [Collections.Generic.List[string]]::new()
  $pending = [Collections.Generic.Stack[IO.DirectoryInfo]]::new()
  $pending.Push([IO.DirectoryInfo]::new($Path))
  while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    try {
      foreach ($entry in $directory.EnumerateFileSystemInfos()) {
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
          $reparsePoints.Add($entry.FullName)
          continue
        }
        if ($entry -is [IO.DirectoryInfo]) {
          $directories++
          $pending.Push($entry)
        } elseif ($entry -is [IO.FileInfo]) {
          $files++
          $bytes += $entry.Length
        }
      }
    } catch {
      $failures.Add("$($directory.FullName):$($_.Exception.GetType().Name)")
    }
  }
  return [ordered]@{
    files = $files
    directories = $directories
    bytes = $bytes
    reparsePoints = @($reparsePoints)
    enumerationFailures = @($failures)
  }
}

$before = Get-Inventory $target
$topLevel = @(Get-ChildItem -LiteralPath $target -Force).Count
$escapingReparsePoints = [Collections.Generic.List[object]]::new()
$unresolvedReparsePoints = [Collections.Generic.List[string]]::new()
foreach ($linkPath in $before.reparsePoints) {
  try {
    $link = Get-Item -LiteralPath $linkPath -Force -ErrorAction Stop
    $linkTargets = @($link.Target)
    if ($linkTargets.Count -eq 0) {
      $unresolvedReparsePoints.Add($linkPath)
      continue
    }
    foreach ($rawTarget in $linkTargets) {
      if ([string]::IsNullOrWhiteSpace([string]$rawTarget)) {
        $unresolvedReparsePoints.Add($linkPath)
        continue
      }
      $resolvedTarget = if ([IO.Path]::IsPathRooted([string]$rawTarget)) {
        [IO.Path]::GetFullPath([string]$rawTarget).TrimEnd('\')
      } else {
        [IO.Path]::GetFullPath((Join-Path $link.DirectoryName ([string]$rawTarget))).TrimEnd('\')
      }
      $inside = $resolvedTarget -ceq $target -or $resolvedTarget.StartsWith("$target\", [StringComparison]::OrdinalIgnoreCase)
      if (-not $inside) {
        $escapingReparsePoints.Add([ordered]@{ link = $linkPath; target = $resolvedTarget })
      }
    }
  } catch {
    $unresolvedReparsePoints.Add($linkPath)
  }
}
$preflight = [ordered]@{
  schemaVersion = 1
  operation = 'AUTHORIZED_EXACT_TMP_CLEANUP'
  authorizedTarget = 'C:\Users\adria\Documents\AGM\.tmp'
  resolvedCanonicalPath = $target
  repositoryRoot = $root
  targetIsRepositoryRoot = ($target -ceq $root)
  targetIsAgmLibrary = ($target -ceq $library)
  targetIsCanonicalEvidence = ($target -ceq $evidence)
  topLevelItems = $topLevel
  before = $before
  reparseValidation = [ordered]@{
    total = $before.reparsePoints.Count
    escaping = @($escapingReparsePoints)
    unresolved = @($unresolvedReparsePoints)
  }
  deleted = $false
  deletionFailures = @()
  recordedAt = (Get-Date).ToUniversalTime().ToString('o')
}

$auditDirectory = Split-Path -Parent $AuditPath
[IO.Directory]::CreateDirectory($auditDirectory) | Out-Null
[IO.File]::WriteAllText($AuditPath, ($preflight | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))

if ($escapingReparsePoints.Count -ne 0) { throw 'TMP_REPARSE_POINT_ESCAPES_TARGET_DELETE_REFUSED' }
if ($unresolvedReparsePoints.Count -ne 0) { throw 'TMP_REPARSE_POINT_UNRESOLVED_DELETE_REFUSED' }

$deletionFailures = [Collections.Generic.List[string]]::new()
# Remove validated in-tree links first, deepest path first. This prevents
# recursive deletion from traversing pnpm junction graphs or observing a link
# after its internal target has already been removed.
foreach ($linkPath in @($before.reparsePoints | Sort-Object Length -Descending)) {
  try {
    $link = Get-Item -LiteralPath $linkPath -Force -ErrorAction SilentlyContinue
    if ($null -eq $link) { continue }
    if (($link.Attributes -band [IO.FileAttributes]::Directory) -ne 0) {
      [IO.Directory]::Delete($link.FullName, $false)
    } else {
      [IO.File]::Delete($link.FullName)
    }
  } catch {
    $deletionFailures.Add("${linkPath}:$($_.Exception.GetType().Name)")
  }
}
foreach ($entry in @(Get-ChildItem -LiteralPath $target -Force)) {
  try {
    Remove-Item -LiteralPath $entry.FullName -Recurse -Force -ErrorAction Stop
  } catch {
    try {
      $extendedPath = "\\?\$($entry.FullName)"
      if ($entry -is [IO.DirectoryInfo]) {
        [IO.Directory]::Delete($extendedPath, $true)
      } else {
        [IO.File]::Delete($extendedPath)
      }
    } catch {
      $deletionFailures.Add("$($entry.FullName):$($_.Exception.GetType().Name)")
    }
  }
}

$after = Get-Inventory $target
$result = [ordered]@{
  schemaVersion = 1
  operation = 'AUTHORIZED_EXACT_TMP_CLEANUP'
  authorizedTarget = 'C:\Users\adria\Documents\AGM\.tmp'
  resolvedCanonicalPath = $target
  repositoryRoot = $root
  targetIsRepositoryRoot = $false
  targetIsAgmLibrary = $false
  targetIsCanonicalEvidence = $false
  topLevelItemsDeleted = $topLevel
  deletedFiles = $before.files
  deletedDirectories = $before.directories
  deletedBytes = $before.bytes
  reparsePointsDetected = $before.reparsePoints.Count
  escapingReparsePoints = $escapingReparsePoints.Count
  unresolvedReparsePoints = $unresolvedReparsePoints.Count
  inventoryEnumerationFailures = $before.enumerationFailures.Count
  deletionFailures = @($deletionFailures)
  remaining = $after
  temporaryReleaseResidue = if ($after.files -eq 0 -and $after.directories -eq 0 -and $deletionFailures.Count -eq 0) { 0 } else { 1 }
  deleted = ($after.files -eq 0 -and $after.directories -eq 0 -and $deletionFailures.Count -eq 0)
  completedAt = (Get-Date).ToUniversalTime().ToString('o')
  recovery = 'NOT_RECOVERABLE_FROM_LOCAL_TMP'
}
[IO.File]::WriteAllText($AuditPath, ($result | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
$result | ConvertTo-Json -Depth 8
if (-not $result.deleted) { exit 1 }
