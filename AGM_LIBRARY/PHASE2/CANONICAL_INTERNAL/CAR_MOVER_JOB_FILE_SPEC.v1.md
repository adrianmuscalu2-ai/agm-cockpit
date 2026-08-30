# Car Mover Job File specification — review candidate

Document ID: `AGM-CM-JOB-001`
Version: `1.0.0-review-candidate`
Status: `DRAFT / HUMAN REVIEW REQUIRED`
Owner: `AGM Product Owner / Car Mover Steward`
Jurisdiction: `AGM_INTERNAL`

## Canonical aggregate boundary

The Job File is the consolidated read model for one Car Mover job inside AGM
Premium. The current implementation joins the job, vehicle, lifecycle,
evidence and audit references, financial entries, invoices, communications and
analysis for the same job identifier.

## Lifecycle

The implemented states are:

`DRAFT → READY → ASSIGNED → ACCEPTED → IN_PROGRESS → ARRIVED → HANDOVER_PENDING → COMPLETED`

The implemented terminal or exceptional states also include `CANCELLED`,
`BLOCKED` and `ESCALATED`. Only transitions permitted by the implementation
contract are valid. Completion requires the recorded handover protocol.

## Ownership and provenance

- The job aggregate owns operational identity and lifecycle.
- Vehicle data remains associated with the same job; unknown vehicle class
  cannot silently become `PASSENGER_CAR` after an ambiguous classification.
- Evidence and audit items remain references to their preserved originals.
- Communications, invoices and financial entries remain separately traceable;
  their presence in the Job File does not transfer authority to this document.
- Every imported or OCR-derived value must retain its source/evidence link and
  confirmation state.

## Review status

This is a consolidated internal candidate, not an automatic replacement for
the implementation contract. Product Owner and Car Mover Steward review is
required before `CURRENT`.

## Source evidence

- `apps/api/src/car-mover/car-mover.contract.ts`
- `apps/api/src/car-mover/car-mover.service.ts`
- `apps/api/src/car-mover/dto/`
- `CAR_MOVER/API/`
- `CAR_MOVER/JOB_FILE/`
- `CAR_MOVER/LIFECYCLE/`
