# Car Mover controlled field tester runbook — review candidate

Document ID: `AGM-CM-FIELD-001`
Version: `1.0.0-review-candidate`
Status: `DRAFT / HUMAN REVIEW REQUIRED`
Owner: `AGM Field Validation Owner`
Jurisdiction: `AGM_INTERNAL`

## Purpose and separation

This runbook consolidates the controlled field-measurement contract. It is not
Production authorization, a provider specification or measured field outcome.

## Controlled surface

- `GET /api/v1/car-mover/routing/field-protocol`
- `POST /api/v1/car-mover/routing/observations`
- `GET /api/v1/car-mover/routing/telemetry` (Owner only)

Tester access is restricted to the assigned tester identity. Repeated records
for the same case are deduplicated by `entityType + entityId`; the latest case
state is used for aggregate reporting.

## Safety and routing policy

- Default profile: `PASSENGER_CAR`.
- `UNKNOWN` requires human confirmation.
- HERE and TollGuru remain inactive and non-required.
- Valhalla/OSM and AGM Toll Library remain
  `REGISTERED_NOT_RUNTIME_READY`.
- No incomplete or unknown route, toll, CORE availability or provider need may
  be accepted without the explicit confirmation required by the runtime
  contract.

## Measurement gate

Conclusive evaluation requires all of:

- 100 finalized cases;
- 3 distinct testers;
- 14 active field days;
- 30 elapsed calendar days.

Before all thresholds are met, output is `PARTIAL FIELD DATA — NON-CONCLUSIVE`
or `NO_FIELD_DATA`. The 2–5% and 0–1% ranges remain hypotheses; ≤3% remains a
target, never an inferred verdict.

## Source evidence

- `evidence/routing-architecture/2026-08-29/FIELD_MEASUREMENT_PROTOCOL.md`
- `evidence/routing-architecture/2026-08-29/FIELD_MEASUREMENT_REPORT.md`
- `evidence/field-test-backend/2026-08-29/PREPARATION_REPORT.md`
- `evidence/field-test-backend/2026-08-29/AUTHORIZED_TESTERS.md`
- `apps/api/src/car-mover/car-mover-routing-telemetry.service.ts`
