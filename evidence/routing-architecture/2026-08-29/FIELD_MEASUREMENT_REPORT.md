# FIELD_MEASUREMENT_REPORT

Date prepared: 2026-08-29

## Current result

No real field sample was supplied or generated during implementation of the measurement controls.

- Field cases measured: 0 supplied in this mandate.
- Measured fallback percentage: not available.
- Measured paid external percentage: not available.
- Target comparison: `NOT_MEASURED`.
- HERE recommendation: no decision from field evidence.
- TollGuru recommendation: no decision from field evidence.

Planning values remain unchanged:

- `2–5% = HYPOTHESES_NOT_PASS`;
- `0–1% = HYPOTHESES_NOT_PASS`;
- `≤3% = TARGET_NOT_VERDICT`.

## Prepared collection capability

- Per-case telemetry includes vehicle class, source, cache, toll confidence/state, fallback, confirmation, paid lookup, final decision, CORE availability, latency, route error, toll error, and external-provider assessment.
- Reports deduplicate repeated observations by case.
- Percentages use finalized cases instead of messages or retries.
- Exception rows retain the case reference and concrete reason for owner review.
- Runtime readiness remains explicit: Valhalla/OSM and AGM Toll Library are registered but not runtime-ready; HERE/TollGuru remain inactive.

## Local validation

- API lint: PASS.
- API build: PASS.
- API regression: 51/51 suites, 290/290 tests PASS.
- Production deployment: not executed.
- Commit/push: not executed.

## Current verdict

`FIELD VALIDATION = INSUFFICIENT DATA`

`FIELD RESULT = NO_FIELD_DATA`

`PRODUCTION AUTHORIZATION = SEPARATE OWNER DECISION`
