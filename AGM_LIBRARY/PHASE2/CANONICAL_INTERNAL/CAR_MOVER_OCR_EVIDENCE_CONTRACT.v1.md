# Car Mover OCR, document and evidence contract — review candidate

Document ID: `AGM-CM-OCR-001`
Version: `1.0.0-review-candidate`
Status: `DRAFT / HUMAN REVIEW REQUIRED`
Owner: `Inspector / Evidence Custody`
Jurisdiction: `AGM_INTERNAL`

## Scope

This candidate specializes the existing AGM evidence rules for Car Mover. It
does not change the OCR runtime.

## Provenance rules

- Preserve the original document or image and its original checksum where the
  acquisition path supports it.
- Record acquisition time, source channel, job identifier, uploader/actor and
  OCR engine/version where available.
- Store OCR output as a derived representation, never as a replacement for the
  original.
- Mark confidence and human-confirmation state for extracted operational
  values.
- An unreadable, absent or low-confidence value remains `UNKNOWN`; it must not
  be inferred, invented or converted to a safe/PASS value.
- Redaction or transformation creates another evidence-linked derivative and
  must not overwrite historical evidence.

## Retention and access

Retention follows the governing AGM evidence policy and applicable legal/data
protection review. A fixed legal retention period is not asserted here because
the applicable document class and jurisdiction must first be identified.
Deletion requires the authorized retention workflow; domain views never copy
or delete the canonical source.

## Review status

Evidence Custody, Product Owner and data-protection/legal review are required
before this candidate may become `CURRENT`. Runtime OCR remains unchanged.

## Source evidence

- `AGM_OCR_ARCHIVE_CONTRACT_V1.md`
- `apps/web/src/ocr-translator.ts`
- `apps/api/src/car-mover/`
- `CAR_MOVER/OCR_DOCUMENTS/`
- `CAR_MOVER/EVIDENCE/`
