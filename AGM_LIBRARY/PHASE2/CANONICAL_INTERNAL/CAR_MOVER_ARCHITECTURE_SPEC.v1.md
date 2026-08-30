# Car Mover canonical architecture specification — review candidate

Document ID: `AGM-CM-ARCH-001`
Version: `1.0.0-review-candidate`
Status: `DRAFT / HUMAN REVIEW REQUIRED`
Owner: `AGM Product Owner / Car Mover Steward`
Jurisdiction: `AGM_INTERNAL`

## Boundary

Car Mover is a distinct functional component inside AGM Premium. It is not a
separate AGM product or project. This specification does not rewrite historical
documents that used older wording.

## Current contract consolidated from implementation

- Default vehicle profile: `PASSENGER_CAR`.
- An `UNKNOWN` classification requires human confirmation. It is not zero,
  safe, or PASS.
- Standard routing uses the existing CORE path (`TOM` / TomTom and cache).
- Extended routing is selected only for a confirmed non-passenger profile.
- HERE and TollGuru are inactive, non-required and cannot be invoked
  automatically without a separate Owner authorization.
- Valhalla/OSM and AGM Toll Library are registered but not runtime-ready.
- Field measurements are evidence about operational behavior; they do not
  become an external provider specification or an official toll rule.

## Governance

This document is an internal consolidation candidate. It cannot become
`CURRENT` until the Product Owner and Architecture Inspector review the cited
implementation and evidence. No runtime behavior is changed by this document.

## Source evidence

- `apps/api/src/car-mover/car-mover.contract.ts`
- `apps/api/src/car-mover/car-mover-routing.policy.ts`
- `apps/api/src/car-mover/car-mover-routing-telemetry.service.ts`
- `evidence/routing-architecture/2026-08-29/IMPLEMENTATION_REPORT.md`
- `evidence/routing-architecture/2026-08-29/FIELD_MEASUREMENT_PROTOCOL.md`
- `AGM_LIBRARY/GOVERNANCE/CAR_MOVER_BOUNDARY_DECISION.md`
