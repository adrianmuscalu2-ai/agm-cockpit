param()

$ErrorActionPreference = 'Stop'

function Assert-Equal {
  param($Actual, $Expected, [string]$Case)
  if ($null -eq $Expected) {
    if ($null -ne $Actual) { throw "SCHEDULED_AT_TEST_FAILED_${Case}_EXPECTED_NULL" }
    return
  }
  if ([string]$Actual -ne [string]$Expected) {
    throw "SCHEDULED_AT_TEST_FAILED_${Case}_EXPECTED_$Expected`_ACTUAL_$Actual"
  }
}

$samplerPath = Join-Path $PSScriptRoot 'Sample-RealBasicProcesses.ps1'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($samplerPath, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'PROCESS_SAMPLER_AST_INVALID' }

$definitions = @($ast.FindAll({
  param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] `
    -and $node.Name -in @('Convert-ScheduledAtEvidenceValue', 'Convert-CadenceSecondsEvidenceValue')
}, $true))
if ($definitions.Count -ne 2) { throw 'NULLABLE_HELPER_DEFINITION_INVALID' }

# Load only the pure formatter. The sampler body and all runtime processes are
# deliberately excluded from this isolated test.
. ([scriptblock]::Create(($definitions.Extent.Text -join [Environment]::NewLine)))

$present = [DateTimeOffset]::Parse('2026-08-14T19:36:09.9866949+00:00')
Assert-Equal (Convert-ScheduledAtEvidenceValue $present) $present.ToString('o') 'PRESENT'
Assert-Equal (Convert-ScheduledAtEvidenceValue $null) $null 'NULL'

$withoutProperty = [pscustomobject]@{ sampleKind = 'FORMAL_BASELINE' }
Assert-Equal (Convert-ScheduledAtEvidenceValue $withoutProperty.scheduledAt) $null 'ABSENT_PROPERTY'

Assert-Equal (Convert-ScheduledAtEvidenceValue ([pscustomobject]@{ invalid = $true })) 'not_available' 'NON_CONVERTIBLE'

Assert-Equal (Convert-CadenceSecondsEvidenceValue 149.947) 149.947 'CADENCE_PRESENT'
Assert-Equal (Convert-CadenceSecondsEvidenceValue 0) 0 'CADENCE_ZERO'
Assert-Equal (Convert-CadenceSecondsEvidenceValue $null) $null 'CADENCE_NULL'
Assert-Equal (Convert-CadenceSecondsEvidenceValue $withoutProperty.cadenceSeconds) $null 'CADENCE_ABSENT_PROPERTY'
Assert-Equal (Convert-CadenceSecondsEvidenceValue 'not-a-number') 'not_available' 'CADENCE_NON_CONVERTIBLE'

'PROCESS_SAMPLER_NULLABLE_STATIC_TESTS_OK scheduledAtCases=4 cadenceCases=5 ast=PASS runtimeProcesses=0'
