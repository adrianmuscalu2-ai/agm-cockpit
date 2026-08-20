# AGM Post-Incident Runtime / Platform Owner Handoff

Status: HANDOFF READY / AUTOMATION RESTORATION OPEN
Functional incident: CLOSED / PASS
Date: 2026-08-20

## Receiving owner

Runtime / Platform Owner, with Release & Operations, Secret & Credentials Guardian,
Turn Command Lead, and Independent Validator.

The current executor can modify the repository and run local Windows/Android
commands, but has no executable connector to provision the persistent control-plane
runtime or secret store. No local simulation is an acceptable substitute.

## Required components

| Component | Role | Required host/location | Required binding and identity |
|---|---|---|---|
| Secret & Credentials Guardian runtime | Supplies secrets without exposure and audits access | Approved secret store + persistent Guardian runtime | Distinct Guardian service account; read-only scoped bindings for Release and Validator |
| Turn Command Lead | Orchestrates governed handoffs | Persistent Turn runtime/control-plane host | Executor identity may request; cannot self-approve or self-validate |
| Release & Operations runner | Publishes immutable OCI images and deploys by digest | Persistent protected runner / GitHub environment `Production` | Release service account; GHCR publish and Production deploy permissions |
| Independent Validator | Verifies digest, preflight, health, rollback and evidence | Separate runner/runtime from executor | Validator identity distinct from executor and Release |
| Bootstrap/launcher | Reattaches all bindings after restart/new session | Versioned control-plane repository + host scheduler/service | Idempotent startup; no local-only state |
| Telemetry/health | Reports component availability and binding state | Central telemetry sink and health endpoints | No secret values; component IDs, state, timestamps and correlation IDs only |
| Rollback runner | Restores previous approved OCI digest | Release runner and protected Production environment | Release permission with rollback scope; approval and audit required |

## Known-good and required restoration

- Known-good functional release path: canonical branch `agm-canonical-20260820`,
  OCI workflow commits `6b34756`, `795355f`, `5f30538`, `edddb41`, `6ad2231`,
  rate-limit CI fix `7f8e0f0`.
- GitHub repository: `adrianmuscalu2-ai/agm-cockpit`.
- Production environment: `Production`, required reviewer, administrator bypass disabled.
- SSH release identity: `agmops`; host and private key remain Guardian-controlled.
- Production service: `agm-production-api.service`.
- Production accepts an approved OCI image pinned by digest.

## Bootstrap contract

1. Load versioned registry and binding configuration from the canonical repository.
2. Authenticate each service identity through Guardian; never place credentials in Git,
   UI, logs or generated artifacts.
3. Start Guardian, Turn, Release and Validator in dependency order.
4. Register health and telemetry endpoints.
5. Execute a non-production handoff probe.
6. Persist only non-secret binding metadata and correlation IDs.
7. On restart or new session, reconcile desired state idempotently and report drift.

## Required PASS evidence

- Guardian recovery: secret reference resolves through Guardian without value exposure.
- Turn handoff: Turn → Guardian → Release → Validator correlation chain is complete.
- Validator: independent identity signs a distinct validation result.
- Restart recovery: reboot/new session recreates all bindings without manual repair.
- Telemetry/bootstrap: all components report ONLINE with timestamps after recovery.
- Rollback dry-run: previous approved digest is resolved, validated and recoverable in
  a non-Production rehearsal with no live mutation.

## Recovery and rollback

- Preserve the current approved Production digest and deployment evidence.
- Provision and validate the new runtime in an isolated/non-Production target first.
- If bootstrap or validation fails, disable the new binding and restore the prior
  registry/binding snapshot; do not alter application code or live containers.
- Revoke temporary Guardian access after validation and retain only audit metadata.

## Evidence to attach

- `AGM_MAJOR_INCIDENT_REGISTER.md`
- `AGM_CANONICAL_MANIFEST_2026-08-20.md`
- canonical commits listed above
- GitHub Actions workflow `.github/workflows/production-release.yml`
- Production service and rollback runbooks under `deploy/production/`
- Guardian audit record, binding snapshot, validator report and restart recovery log
  (to be produced by the receiving Runtime / Platform Owner)

## Acceptance gates

The receiving owner may close this handoff only after independently attaching:

`GUARDIAN PASS → TURN HANDOFF PASS → VALIDATOR PASS → NEW-SESSION RECOVERY PASS →
TELEMETRY/BOOTSTRAP PASS → ROLLBACK DRY-RUN PASS`.

Until then:

`FINAL INCIDENT VERDICT = PASS`

`POST-INCIDENT AUTOMATION RESTORATION = OPEN`

