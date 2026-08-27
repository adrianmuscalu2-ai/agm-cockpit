# AGM Production release recovery journal — AGM-PROD-20260824-WEB-API-01

Checked: 2026-08-24

## Frozen evidence

- Previously accepted Car Mover navigation and Android visual evidence remained frozen.
- No existing PASS was reclassified because of a recoverable release-tool or packaging failure.
- Guardian state and provider credentials remained outside the release mutations and evidence payloads.

## Recovery sequence

### Candidate scope

- A broad dirty-worktree release was rejected before deployment because it mixed unrelated changes.
- Classification: `DEFECT DE CONFIGURARE / RELEASE CANDIDATE TOO BROAD`.
- Recovery: created an isolated minimal worktree and staged only Web Car Mover/Premium, Turn/Android telemetry, Authority API, the required authority migration and release infrastructure.
- Result: minimal commit `d3f8c0644077dedc2ba83b09e2354092f47a74c3`; user changes outside scope preserved.

### Web container publication

- First release run `32774755461`: verification and API publication passed; Web publication failed because the Web Dockerfile did not copy `config/operations-health.json`.
- Classification: `DEFECT DE CONFIGURARE`.
- Recovery: added the missing deterministic copy to `deploy/cloud/web.Dockerfile`; no application architecture change.
- Minimal retest: Web build and final release workflow.
- Result: fix commit `11cd7501561b8287515181b09abf1406a46191c6`; run `32775531288` passed publication and deployment.

### Controlled Browser audit

- Integrated Browser attachment was absent.
- Classification: `OPȚIONAL / PLATFORM LIMITATION`; it did not block the official controlled runner.
- The controlled runner initially encountered an authentication-mock race and then a service-worker interception of the mocked boundary.
- Classification: `DEFECT DE RUNTIME/SESIUNE` in the test harness.
- Recovery: stabilized only the test harness with the approved auth refresh mock, safe request tracing and blocked service workers.
- Minimal retest: Production Car Mover navigation only.
- Result: `PASS`, 15 checkpoints, report `evidence/car-mover/navigation-path/2026-08-24T21-05-10-929Z/report.json`.

### Android Premium and heartbeat

- Android Premium previously observed the old API contract as `404` and showed `NO TELEMETRY`.
- After release, the physical-device probe received HTTP `200`, Control Plane `PASS`, 25 canonical records and rendered 24 orbit nodes around the separate Control Plane center.
- A second CDP heartbeat script exceeded its controlled timeout.
- Classification: `DEFECT DE RUNTIME/SESIUNE` for that probe, not an Android product failure.
- Recovery: used the approved persistent-store evidence path and ran only the Android heartbeat query.
- Result: Android heartbeat `ONLINE`, freshness `LIVE`, observed age `18s`; no secret-bearing payload recorded.

### Turn visual boundary

- Production `/turn` is HTTP-accessible and renders the protected administrative entry.
- The audit Chrome session was not unlocked and required the legitimate Turn PIN.
- No credential or hidden browser state was inspected or bypassed.
- Runtime Android status and the Turn telemetry source contract are confirmed `PASS`; unlocked-card appearance remains a protected visual refresh check.

## Closure

- Release recovery: `PASS`.
- Production rollback: `READY / NOT INVOKED`.
- Web + API Production: `PASS`.
- Android Premium runtime: `PASS`.
- Android persistent telemetry: `PASS`.
- Handoff: refresh the protected Turn panel after legitimate PIN unlock; if the Android card still shows the old red snapshot, use the visible `Actualizează` action once while Android remains foreground.
