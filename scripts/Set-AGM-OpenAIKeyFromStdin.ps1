param(
  [string]$SecretPath = "$env:LOCALAPPDATA\AGM\secrets\openai-production-key.dpapi"
)

$ErrorActionPreference = 'Stop'
$value = [Console]::In.ReadToEnd().Trim()
if ([string]::IsNullOrWhiteSpace($value) -or -not $value.StartsWith('sk-')) {
  throw 'OPENAI_KEY_INPUT_INVALID'
}

$directory = Split-Path -Parent $SecretPath
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$secure = ConvertTo-SecureString $value -AsPlainText -Force
$encrypted = ConvertFrom-SecureString $secure
$temporary = Join-Path $directory ('.openai-key.' + [guid]::NewGuid().ToString('N') + '.tmp')
try {
  [IO.File]::WriteAllText($temporary, $encrypted, [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporary -Destination $SecretPath -Force
} finally {
  if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
  $value = $null
  $secure.Dispose()
}

'OPENAI_DPAPI_CUSTODY_CONFIGURED'
