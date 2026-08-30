param(
  [string]$WorkspaceRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$candidateManifest = Join-Path $WorkspaceRoot 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_ASSESSMENT/PROPOSED_OFFICIAL_SOURCE_CANDIDATES.json'
$evidenceRoot = Join-Path $WorkspaceRoot 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CLOSURE/REMOTE_ARTIFACTS'
$manifestPath = Join-Path $WorkspaceRoot 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CLOSURE/REMOTE_ACQUISITION_MANIFEST.json'

New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null
$input = Get-Content -Raw -LiteralPath $candidateManifest | ConvertFrom-Json
$records = @()
$previousManifest = if (Test-Path -LiteralPath $manifestPath) {
  Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
} else {
  $null
}
$fallbackUrls = @{
  'CS-AT-ASFINAG-GO-TOLL' = 'https://media.asfinag.at/media/p31n1jxq/go-maut-tarife-2026_de.pdf'
  'RT001-PROP-AT-VIGNETTE-SECTION-2026' = 'https://media.asfinag.at/media/1mpjid2j/asf_vignettenfolder_2026_de.pdf'
}

foreach ($candidate in $input.candidates) {
  $safeId = ($candidate.proposalId -replace '[^A-Za-z0-9._-]', '_')
  $temporaryPath = Join-Path $evidenceRoot ($safeId + '.download')
  $previous = if ($previousManifest) { $previousManifest.records | Where-Object proposalId -eq $candidate.proposalId | Select-Object -First 1 } else { $null }
  if ($previous -and $previous.acquisitionStatus -eq 'CAPTURED' -and $previous.localEvidencePath) {
    $previousPath = Join-Path $WorkspaceRoot $previous.localEvidencePath
    if ((Test-Path -LiteralPath $previousPath) -and ((Get-FileHash -Algorithm SHA256 -LiteralPath $previousPath).Hash.ToLower() -eq $previous.sha256)) {
      $records += $previous
      continue
    }
  }
  $downloadUrl = if ($fallbackUrls.ContainsKey($candidate.proposalId)) { $fallbackUrls[$candidate.proposalId] } else { $candidate.officialUrl }
  $record = [ordered]@{
    proposalId = $candidate.proposalId
    requestedUrl = $candidate.officialUrl
    acquisitionStatus = 'FAILED'
    httpStatus = $null
    finalUrl = $null
    mediaType = $null
    canonicalFilename = $null
    localEvidencePath = $null
    byteSize = $null
    sha256 = $null
    etag = $null
    lastModified = $null
    error = $null
  }

  try {
    $response = Invoke-WebRequest `
      -Uri $downloadUrl `
      -MaximumRedirection 10 `
      -UseBasicParsing `
      -Headers @{ 'User-Agent' = 'AGM-Canonical-Integrity-Review/1.0' } `
      -TimeoutSec 45 `
      -OutFile $temporaryPath `
      -PassThru

    $mediaType = [string]$response.Headers['Content-Type']
    if ($mediaType.Contains(';')) { $mediaType = $mediaType.Split(';')[0].Trim() }
    if ([string]::IsNullOrWhiteSpace($mediaType)) { $mediaType = 'application/octet-stream' }
    $extension = switch -Regex ($mediaType) {
      '^application/pdf$' { '.pdf'; break }
      '^text/html$' { '.html'; break }
      '^application/json$' { '.json'; break }
      '^text/plain$' { '.txt'; break }
      default { '.bin' }
    }
    $canonicalFilename = $safeId + '.official' + $extension
    $finalPath = Join-Path $evidenceRoot $canonicalFilename
    Move-Item -Force -LiteralPath $temporaryPath -Destination $finalPath
    $file = Get-Item -LiteralPath $finalPath
    $finalUrl = if ($response.BaseResponse.ResponseUri) { $response.BaseResponse.ResponseUri.AbsoluteUri } else { $candidate.officialUrl }

    $record.acquisitionStatus = 'CAPTURED'
    $record.httpStatus = [int]$response.StatusCode
    $record.finalUrl = $finalUrl
    $record.mediaType = $mediaType
    $record.canonicalFilename = $canonicalFilename
    $record.localEvidencePath = ('AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_CLOSURE/REMOTE_ARTIFACTS/' + $canonicalFilename)
    $record.byteSize = [long]$file.Length
    $record.sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $finalPath).Hash.ToLower()
    $record.etag = [string]$response.Headers['ETag']
    $record.lastModified = [string]$response.Headers['Last-Modified']
  }
  catch {
    if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }
    $record.error = $_.Exception.Message
  }
  $records += [pscustomobject]$record
}

$manifest = [ordered]@{
  schemaVersion = 'agm-routing-toll-001-remote-acquisition.v1'
  acquiredAt = (Get-Date).ToUniversalTime().ToString('o')
  purpose = 'REVIEW_EVIDENCE_ONLY_NOT_CENTRAL_REGISTRY'
  candidateCount = $input.candidates.Count
  capturedCount = @($records | Where-Object acquisitionStatus -eq 'CAPTURED').Count
  failedCount = @($records | Where-Object acquisitionStatus -eq 'FAILED').Count
  records = $records
}

$manifestDirectory = Split-Path -Parent $manifestPath
New-Item -ItemType Directory -Force -Path $manifestDirectory | Out-Null
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
$manifest | ConvertTo-Json -Depth 5
