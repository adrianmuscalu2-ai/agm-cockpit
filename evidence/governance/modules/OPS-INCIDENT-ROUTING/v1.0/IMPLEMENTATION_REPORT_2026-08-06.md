# Executable incident routing and Production preflight

Date: 2026-08-06

## Mandate

Operationalize the approved organizational architecture without changing its authority boundaries.

## Implemented chain

`Monitoring event → executable route → automatic read-only activations → explicit authorization gate → privileged recovery → Production preflight → Incident Journal → independent/human validation`

## Components

- `apps/web/src/incident-routing.registry.ts` — machine-readable owner, executor, guardian, validator, monitors and consulted roles.
- `apps/web/src/monitoring/monitoring-event.contract.ts` — applies routing and records activations in incident history.
- `scripts/Test-AGM-ProductionPreflight.ps1` — real operator-side checks with safe metadata only.
- `apps/api/src/production-preflight/*` — allowlisted report ingestion and API endpoint.
- `apps/web/src/production-preflight.ts` — Turn panel and Incident Journal reconciliation.
- `deploy/production/SSH_ACCESS_RECOVERY.md` — recovery procedure without credentials.

## Authority preservation

Detection, routing, monitors, owner, validator and Architecture consultation activate automatically in read-only mode. Executor and Secret & Credentials Guardian remain `AWAITING AUTHORIZATION` until an explicit Turn authorization record is supplied. Recovery never auto-validates or auto-closes an incident.

## Controlled scenario

`SSH lost → detected → routed → agents activated → authorization required and supplied → recovered preflight → ready-test → independent evidence → validated`

Result: PASS in `apps/web/scripts/test-production-incident-routing.ts`.

## Current real Production preflight

- SSH identity: PASS.
- SSH agent: NOT CONFIGURED; Windows service is disabled and changing it requires an elevated Administrator session. Explicit `ssh -i` remains available.
- SSH network connectivity: PASS.
- SSH authentication as `agmops`: FAIL; the approved public key is not installed on the server.
- Hetzner Console/Rescue procedure: PASS.
- Public API live: PASS.
- Public Guardian telemetry: FAIL; current Production build does not contain the new endpoint.
- Recovery procedure: FAIL until SSH authentication passes.

## Security statement

No private key, password, token, PIN, hash or secret value is included in the report, API response, UI, logs or Git. The preflight communicates only allowlisted statuses and safe descriptions.

## Verdict

`EXECUTABLE ROUTING — PASS`

`CONTROLLED RECOVERY SCENARIO — PASS`

`REAL PRODUCTION RECOVERY — ATTENTION / SSH AUTHORIZATION PENDING`

`PUBLIC GUARDIAN TELEMETRY — FAIL / DEPLOYMENT PENDING`
