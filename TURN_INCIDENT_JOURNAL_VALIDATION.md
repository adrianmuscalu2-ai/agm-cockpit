# Turn — Incident and Applied Solutions Journal validation

## Integrity rule

An incident may become **Validated** only when the applied solution, post-remediation
tests, and human validation are all recorded. Confirm that the form rejects Validated
status when any one of these fields is empty.

## Core flow

1. Open Turn Command Center and confirm the official Maintenance, Quality and Evolution
   Department charter, its five directors, authority boundaries, and mandatory workflow.
2. Switch RO/DE/EN and confirm the department structure remains complete and readable.
3. Locate the permanent incident journal.
4. Confirm that the 12 historical AGM incidents are present.
5. Create a new incident and complete every field, including at least one environment.
6. Move it through New, In analysis, In remediation, and Ready for test.
7. Add the applied solution, automated/real tests, and human validation, then mark it
   Validated and reusable.
8. Reopen it with a reason and confirm that every previous history entry remains.
9. Archive only after validation, then confirm that any return must use Reopened.

## Search and operational memory

1. Search by keyword, module, severity, status, and category.
2. Filter separately by occurrence dates and version/commit.
3. Open related incident links and confirm navigation to the matching record.
4. Confirm unresolved records appear under Known issues.
5. Confirm validated reusable records appear under Validated quick solutions.
6. Restart AGM and confirm that newly entered incidents, status history, and filters'
   source data remain available.

## Audit export and regression

1. Export the JSON audit report and verify timestamp, total count, all 16 operational
   fields, related IDs, reusable flag, and complete history.
2. Confirm there is no delete control and old history cannot be removed from the UI.
3. Retest Translator, Camera/OCR, dictation, Email Assistant, Message Library, HTTPS,
   and service autostart. The journal must not change their behavior.

The module passes only after the complete lifecycle, persistence, export, mobile layout,
and regression checks succeed on a real device.
