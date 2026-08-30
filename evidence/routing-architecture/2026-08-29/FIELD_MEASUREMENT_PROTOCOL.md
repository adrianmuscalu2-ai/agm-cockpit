# AGM Car Mover — controlled field measurement protocol

## Frozen routing scope

- Default vehicle profile: `PASSENGER_CAR`.
- Core path: TOM/TomTom and the existing AGM core components.
- `UNKNOWN`: human confirmation is mandatory; it is not zero, safe, or PASS.
- HERE and TollGuru: inactive and not required.
- Valhalla/OSM and AGM Toll Library: registered, but not runtime-ready.
- Production, commercial provider activation, commit, and push are outside this protocol.

The machine-readable protocol is available to authenticated Premium clients at:

`GET /car-mover/routing/field-protocol`

## One measured case

A case is identified by `entityType + entityId`. The same case may be updated as facts become known, but reporting keeps only its latest observation. This prevents retries and status updates from inflating percentages.

Record an observation at:

`POST /car-mover/routing/observations`

Example payload:

```json
{
  "entityType": "JOB",
  "entityId": "<Car Mover job UUID>",
  "vehicleClass": "PASSENGER_CAR",
  "routeSource": "TOM",
  "cacheState": "MISS",
  "tollStatus": "UNKNOWN",
  "fallbackReason": "NONE",
  "coreAvailability": "AVAILABLE",
  "routeLatencyMs": 430,
  "externalProviderAssessment": "NOT_NEEDED",
  "manualConfirmation": true,
  "externalPaidLookup": false,
  "finalRouteDecision": "ACCEPTED",
  "measuredAt": "2026-08-29T10:00:00.000Z"
}
```

When `coreAvailability=UNAVAILABLE`, `routeErrorCode` is mandatory. `tollErrorCode` records a concrete toll-data failure. `externalProviderAssessment=CANDIDATE` requires a concrete fallback reason and is not proof that a paid provider is necessary.

`routeLatencyMs` is measured from starting the route operation until the route outcome is available to AGM. It excludes subsequent human decision time.

## Safety gates

- An accepted unknown vehicle requires manual confirmation.
- An accepted unknown route source is rejected.
- Accepted unknown toll/core availability/external need requires manual confirmation.
- A Valhalla runtime observation is rejected while its adapter is not runtime-ready.
- A paid external lookup cannot be recorded without an explicit authorization reference; this protocol does not grant that authorization.

## Sufficient sample policy

All conditions are mandatory:

- at least 100 finalized unique cases;
- at least 3 distinct authenticated testers;
- at least 14 active measurement days;
- at least 30 elapsed days between the first and last observation.

Before all four conditions are satisfied, `FIELD VALIDATION = INSUFFICIENT DATA` regardless of apparent percentages.

## Report

Owner-only endpoint:

`GET /car-mover/routing/telemetry?from=<ISO timestamp>&to=<ISO timestamp>`

It reports raw observations, deduplicated cases, finalized cases, CORE resolution, human confirmations, external-provider candidates, routing and toll issues, fallback distribution, availability, latency p50/p95, exceptions, target comparison, and field verdict.

The following values remain governance constants, not measurements:

- `2–5% = HYPOTHESES_NOT_PASS`;
- `0–1% = HYPOTHESES_NOT_PASS`;
- `≤3% = TARGET_NOT_VERDICT`.
