# AGM Production Cloudflare connector cutover and rollback plan

Status: procedure validated by Gate 6C tabletop only. Execution requires a separate
deployment/routing mandate and completed pre-change record.

## Authoritative topology

- Production tunnel name: `agm-api-production`
- Production tunnel ID: `1c7d88b4-f2bb-40bb-82b0-37da35ee30a9`
- Production hostname: `api.agmcockpit.com`
- Current fallback connector: Windows service `Cloudflared`
- Current fallback origin: `http://127.0.0.1:3000` on the PC
- Prepared Hetzner configuration: `/etc/cloudflared/config-production.yml`
- Prepared Hetzner origin: `http://127.0.0.1:3000`
- Validation tunnel: `agm-api-validation-rotated-20260725`
- Validation hostname: `validation-api.agmcockpit.com`

The PC fallback and Hetzner target are connectors for the same Production tunnel.
Cutover changes the active connector/origin, not the public hostname or tunnel
identity. DNS modification and Cloudflare tunnel migration are not part of this
procedure.

Running both Production connectors concurrently is prohibited because Cloudflare may
distribute traffic between them, creating mixed-origin or dual-writer behavior.

## Role ownership

| Activity | Accountable role |
|---|---|
| Open/close window; GO/HOLD/NO-GO; authorize rollback | Command Lead — Turn Command Center |
| Verify evidence and issue independent verdict | Independent Validator — AGM Inspector |
| Preserve and operate the approved PC fallback | Fallback Responsible — Release & Operations / PC Fallback Custodian |
| Execute authorized Hetzner/connector rollback commands | Rollback Responsible — Atlas/Codex Technical Executor |

The on-duty identities and distinct sessions must be recorded in the approved
change-window record before execution.

## Mandatory pre-change evidence

Complete `PRE_CHANGE_CHECKLIST.md` before any connector action:

1. record the Production tunnel ID, Windows connector identity/architecture and
   connector start time;
2. checksum the protected Windows `cloudflared` configuration without copying
   credentials into evidence;
3. record the Windows service state and exact non-secret launch path;
4. confirm the fallback API, database and Production tunnel are healthy;
5. record a unique public request reaching only the fallback API logs;
6. record the Hetzner Production configuration checksum and ingress validation;
7. confirm `agm-production-api` is the approved image and healthy locally;
8. confirm Gate 6D data/write-freeze conditions;
9. record the on-duty role identities and acknowledgement;
10. establish the STOP channel and rollback command sequence.

Any missing item is an automatic NO-GO.

## Stop points

### SP0 — before the change window

STOP unless Gate 6 final audit is GO / READY and a distinct deployment mandate exists.

### SP1 — before fallback connector stop

STOP unless the fallback evidence bundle, route identity, health checks, configuration
checksum and role acknowledgements are complete.

### SP2 — after write freeze, before connector transition

STOP unless Gate 6D single-writer controls and final data checksum pass. If they fail,
remove the write freeze only under Command Lead direction; do not change routing.

### SP3 — after fallback connector stop

Start the Hetzner Production connector only after the Fallback Responsible confirms
the Windows Production connector is stopped. If this cannot be proven within the
approved interval, restart the Windows connector and abort.

### SP4 — after Hetzner connector start

STOP and rollback unless exactly one Production connector is active and a unique
correlation request reaches only `agm-production-api`.

### SP5 — before acceptance

STOP and rollback on any live, ready, database, migration, authentication,
translation, Turn Admin, Pre-departure, CORS, logging or image-identity failure.

## Controlled connector transition

Only under a separate approved deployment window:

1. Command Lead freezes routing/connector changes.
2. Fallback Responsible completes and signs the fallback evidence.
3. Gate 6D write freeze and final data procedure complete.
4. Fallback Responsible stops the Windows `Cloudflared` Production connector.
5. Independent Validator confirms the Production tunnel has no active Windows
   connector.
6. Rollback Responsible starts the prepared Hetzner Production connector only through
   the approved lifecycle command.
7. Independent Validator confirms exactly one Production connector and verifies a
   unique request reaches only `agm-production-api`.
8. Execute the approved post-deployment checklist.
9. Command Lead declares GO, HOLD or NO-GO.

The Validation tunnel and hostname remain separate and unchanged.

## Abort triggers

Immediate abort and rollback are mandatory for:

- both Windows and Hetzner Production connectors active simultaneously;
- zero Production connectors beyond the approved transition interval;
- unexpected tunnel ID, hostname, connector architecture or origin;
- public request reaching Validation, Legacy or both Production origins;
- image ID or OCI revision mismatch;
- live/ready/database/migration failure;
- authentication, translation, Turn Admin or Pre-departure failure;
- write-freeze or single-writer breach;
- missing evidence, lost STOP channel or role conflict;
- suspected secret or data exposure.

## Immediate rollback

1. Command Lead declares NO-GO and authorizes rollback.
2. Rollback Responsible stops the Hetzner Production connector/API write path without
   deleting containers, volumes or evidence.
3. Independent Validator confirms no active Hetzner Production connector/write path.
4. Fallback Responsible restarts the approved Windows `Cloudflared` connector using
   its preserved configuration.
5. Independent Validator confirms exactly one `windows_amd64` connector on
   `agm-api-production`.
6. Verify a unique request reaches only the Windows fallback API log.
7. Verify public live, ready, authentication and one controlled translation.
8. Apply the Gate 6D database reconciliation decision before reopening writes.
9. Preserve Cloudflare, API, database and command evidence.
10. Command Lead records the final NO-GO; no same-window retry without new approval.

Target rollback time: 10–20 minutes. Exceeding 20 minutes triggers incident
escalation.

## Post-rollback PASS

- exactly one approved Windows Production connector is active;
- `api.agmcockpit.com` reaches only the approved fallback origin;
- live, ready, database, authentication and translation checks pass;
- no new writes reach the failed Hetzner target;
- Gate 6D reconciliation requirements are satisfied;
- evidence and database state are preserved;
- Independent Validator issues PASS and Command Lead closes the window.

## Prohibited actions

- no DNS change;
- no Cloudflare tunnel migration;
- no deletion or rotation of tunnel credentials during the window;
- no concurrent Production connectors;
- no reuse of the Validation tunnel as Production;
- no unrecorded dashboard or local configuration change;
- no retry after rollback without new approval.
