# Field Test — safe fallback scenarios

Run before departure or while parked. Telemetry observes; it never blocks Car Mover.

## Required controlled scenario

Use the already-approved software state transition:

1. Record the current TomTom/HERE states.
2. Suspend TomTom through the pilot state control with reason `FIELD_TEST_CONTROLLED_FALLBACK`.
3. Request one new route while parked.
4. Expect HERE with `PRIMARY_PROVIDER_UNAVAILABLE_SECONDARY_USED`.
5. Restore TomTom `ACTIVE` immediately.
6. Capture a `FALLBACK` checkpoint.

## Additional safe evidence

- Timeout: controlled adapter fault injection; do not wait for a real timeout while driving.
- Rate limit: controlled adapter fault injection; never exhaust a commercial quota intentionally.
- Stale cache: expire a controlled test cache entry and verify an explicit stale warning.
- Manual fallback: suspend providers in controlled software, verify manual route/Car Mover remains available, then restore them.
- Connectivity: observe naturally occurring weak signal; do not intentionally disable mobile data in a critical moment.

Stop the controlled scenario and restore provider state if the operation differs from the expected bounded behavior. An incident is never created artificially and `Incident ≠ Job Block`.

