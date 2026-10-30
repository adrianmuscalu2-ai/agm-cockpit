# Turn spatial release dossier — 2026-10-28

Status: CANDIDATE / NOT APPROVED / NOT DEPLOYED

Worktree: `C:\Users\adria\Documents\AGM-CANONICAL-CANDIDATE-20261022`

Branch: `phase3-rc-preparation`

Current HEAD: `SOURCE_COMMIT_PENDING_MANIFEST_FINALIZATION`

## Scope

The candidate contains the Turn spatial presentation and the operational scroll control. The intended release scope is:

- complete spatial agent/organization model derived from `turnOrganizationAgents` and `reportsToId`;
- spatial Basic model retained and verified;
- spatial Premium takeover projection, explicitly demo/non-authoritative;
- spatial orchestrator model derived from the library control-plane domains;
- spatial Inspector/Monitoring model derived from organization and monitor source contracts;
- spatial Duty Execution Truth / Agent Role Accountability model derived from role contracts and validators;
- audit table retained as secondary details, not the primary accountability representation;
- functional `Înapoi sus` control on long Turn pages;
- Governance V2 remains prepared/not activated.

## Secret & Credentials Guardian and Machine responsibilities

These responsibilities are separate from Command Lead approval, Independent Validator assurance and release-executor actions.

- Secret & Credentials Guardian is the sole Production-secret custodian. Its documented role is to validate secret references and lifecycle metadata without exposing secret values. The Turn organization contract assigns it `oversight` access and requires reporting only `CONFIGURED`, `MISSING`, `INVALID` or `ROTATION REQUIRED` states. Sources: `apps/web/src/turn-organization-chart.ts`, `apps/web/src/agent-governance.registry.ts`, `deploy/production/OPERATIONAL_ROLES.md`.
- Secret telemetry is metadata-only. `secret-telemetry.v1` names the Guardian and `monitor-security`, validates configured references, records status/provider/dependent service/environment/timestamp/incident, and never supplies secret values. Source: `apps/api/src/secret-telemetry/secret-telemetry.contract.ts` and `secret-telemetry.service.ts`.
- Machine is not a secret custodian. The Machine Auth contract limits the machine token to `acp:read`, binds access to an active identity, company and credential, uses short-lived access tokens, and requires company-bound read-only authority routes. Sources: `apps/api/src/machine-auth/machine-auth.contract.ts`, `machine-auth.service.ts`, `machine-authority.controller.ts`.
- Machine evidence must contain safe identity/credential references, scope, request/correlation IDs and audit/event correlation; it must not contain raw client secrets, JWTs or secret values. Current candidate preview intentionally has no Machine or Production evidence.
- Guardian approval is required for any Production-secret access, rotation or revocation. Machine provisioning/rotation/revocation requires the existing authorized provisioning path; it is not granted by the release executor or validator.

### Current-release evidence boundary

The 2026-08-05 Guardian report and the 2026-09-03 Machine report are historical evidence only. They are retained with hashes in `RELEASE_MANIFEST.json`, but neither is marked current-release proof.

Evidence is present, but the current-release distinction is explicit. `evidence/governance/modules/OPS-004/operations/AGM-INC-20260805-PRODUCTION-RECOVERY/PRODUCTION_RECOVERY_STATUS_20260806.md` records Guardian `CONFIGURED`, metadata-only telemetry and Production Preflight `READY`, 8/8 checks PASS; its status is also `INCIDENT OPEN / AUTHORIZATION BLOCKED / NO PASS / NO CLOSED`. `evidence/turn-reality/minimal-telemetry/PRODUCTION_VERIFICATION_2026-08-23.md` records Guardian `READY / HEALTHY / LIVE` with metadata-only checks. These are present historical evidence, not a current-release snapshot. Current-release evidence still missing: protected metadata snapshot, current Production/Hetzner telemetry availability, current custody/rotation history and Guardian dual-authorization acknowledgement. Provider: Secret & Credentials Guardian / Release & Operations. Independent Validator must confirm it independently.

Machine is reimplemented in this mandate. No pre-existing current Production Machine snapshot is therefore required as a pre-deploy input. The candidate implementation must be verified from source/tests before release; Production lifecycle, expiry/revocation and connected-Turn audit linkage are post-deploy gates owned by Release & Operations and independently validated after deployment. Earlier evidence remains contextual only: `evidence/turn-reality/p0-agent-runtime-live/PRODUCTION_E2E_2026-08-23.md`, `evidence/rescue/deterministic-release-certification-2026-09-20/RESCUE_JOURNAL.md` and `evidence/agent-accountability/browser/2026-09-27T09-48-49-979Z/report.json`.

## Verification observed in isolated preview

Target: `http://127.0.0.1:5175`

- HTTP: `200`.
- JavaScript errors: `0`.
- External requests: `0`.
- Agents: 34 nodes / 33 links / 0 measured overlaps.
- Basic: existing orbital spatial panel visible.
- Premium: 4 nodes / 3 links / 0 measured overlaps.
- Orchestrators: 5 nodes / 4 links / 0 measured overlaps.
- Monitoring: 13 nodes / 24 links / 0 measured overlaps.
- Accountability: 44 nodes / 43 links / 0 measured overlaps.
- Node selection: verified for each spatial model.
- Back-to-top: hidden at top, visible after scroll, click returned `scrollY=0`.
- Mobile: `scrollWidth=390`, `clientWidth=390`.
- Preview remains API-disconnected and non-authoritative.

Evidence capture: `.tmp/turn-spatial-refresh-2026-10-27/release-candidate-with-back-to-top.png`.

## Change separation

Pre-existing candidate changes are preserved and are not treated as automatically included in this release. They include the earlier Premium Governance, Turn navigation, CSS, shutdown/manifest, registry and Browser evidence changes.

Current mandate additions/continuations are listed in `RELEASE_MANIFEST.json`. Files that contain both pre-existing and current edits must be reviewed line-by-line before any commit; no automatic staging or commit was performed.

## Release state

The candidate is not yet a release commit. The workflow requires a reviewed commit on an allowed release ref, immutable API/Web image digests, a completed pre-change checklist, a separate deployment/routing mandate and separated operational identities. Those values are intentionally blank in the manifest until supplied and independently validated.

No commit, push or deploy was executed.
