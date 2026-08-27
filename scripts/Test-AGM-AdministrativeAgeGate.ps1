$ErrorActionPreference = 'Stop'

$targets = @(
  (Join-Path $PSScriptRoot 'New-AGM-ProductOwnerAccount.ps1'),
  (Join-Path $PSScriptRoot 'New-AGM-LocalProductOwner.ps1')
)

foreach ($target in $targets) {
  $tokens = $null
  $errors = $null
  $ast = [Management.Automation.Language.Parser]::ParseFile($target, [ref]$tokens, [ref]$errors)
  if ($errors.Count -ne 0) { throw "POWERSHELL_PARSE_FAILED: $target" }
  $parameter = $ast.ParamBlock.Parameters | Where-Object { $_.Name.VariablePath.UserPath -eq 'Age18Confirmed' }
  if (-not $parameter) { throw "AGE_GATE_PARAMETER_MISSING: $target" }
  $source = Get-Content -Raw -LiteralPath $target
  if ($source -notmatch 'AGE_18_CONFIRMATION_REQUIRED_BEFORE_ACCOUNT_ACTIVATION') { throw "AGE_GATE_FAIL_CLOSED_MISSING: $target" }
  if ($source -match '(?i)dateofbirth|birthdate|geburtsdatum') { throw "FULL_BIRTH_DATE_COLLECTION_FORBIDDEN: $target" }
}

'Administrative 18+ gate: PASS'
