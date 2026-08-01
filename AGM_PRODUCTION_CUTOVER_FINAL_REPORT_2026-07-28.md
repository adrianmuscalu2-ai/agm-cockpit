# AGM Production — final controlled cutover report

Date: 2026-07-28  
Coordination: Crisis Coordination Cell ACTIVE  
Execution verdict: **PASS / PRODUCTION LIVE ON HETZNER**  
Continuity status: **temporary connector lifecycle condition recorded**

## Final artifact

- Image ID:
  `sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`
- OCI revision:
  `9956eb188fdd988bf0d7af93241c3c43962d9b39`
- Container: `agm-production-api`
- Runtime state: running / healthy
- API systemd unit: enabled / active

No image rebuild, source-code modification, DNS change, Cloudflare migration, secret
disclosure, or migration of the PC source database occurred.

## Final data transfer

- PC fallback was confirmed ready before freeze.
- Windows Production connector was Running before the transition.
- PC write-freeze was applied and verified.
- Source migration state before dump: `4 complete / 0 incomplete`.
- Final dump:
  - `agm-pc-production-final-live-20260728T123949Z.dump`
  - size: `47981` bytes
  - SHA-256:
    `8D0B42B4718A1D34B00FCF9DFBEA892BEA78A09EC08197EA82E1C44DD16FCFCA`
  - local archive listing: PASS
  - transferred checksum: MATCH
  - Hetzner permissions: `root:root / 0600`
- Target pre-change backup: PASS.
- Target schema reset and clean restore: PASS.
- Migration 4→5: PASS.
- Migration idempotence: PASS.
- Final target migration state: `5 complete / 0 incomplete`.
- Source/target row-count reconciliation: exact match for every approved baseline
  table.
- Additive migration tables remained empty as expected.

## API validation before routing

- Exact image identity and OCI revision: PASS.
- Local `/api/v1/health/live`: PASS.
- Local `/api/v1/health/ready`: PASS.
- PostgreSQL dependency: available.
- Critical API log scan after final start: no matches.

## Single-active connector transition

- Elevated Administrator helper verified the exact Windows service and executable.
- Windows `Cloudflared` controlled stop:
  `CONTROLLED_STOP_PASS`.
- Windows service after stop: Stopped.
- Windows cloudflared process count after stop: 0.
- Public endpoint during the no-connector interval: HTTP 530.
- This proves that the PC origin was no longer serving Production before the
  Hetzner connector was started.
- Hetzner Production configuration ingress validation: OK.
- Hetzner Production connector unit:
  `agm-production-cloudflared.service`.
- Hetzner connector state: active.
- Registered QUIC tunnel connections: 4.
- No interval with both Production connectors active was observed.

## Public validation

After the Hetzner connector registered:

- five immediate public live/ready checks: PASS;
- six additional soak ready checks: PASS;
- database dependency on every ready check: available;
- API container: running / healthy;
- PostgreSQL container: healthy;
- migration state: `5 complete / 0 incomplete`;
- Windows connector: Stopped, zero processes;
- PC database: retained in read-only mode for rollback;
- no dual-write occurred.

## Validation environment

The Hetzner Validation API and its connector remain intentionally stopped because
Validation and Production currently share `127.0.0.1:3000`. This was the previously
documented port conflict. Production is not routed through the Validation tunnel.

## Temporary continuity condition

The Production connector currently runs as an active **transient systemd unit**.
The approved API unit is persistent and enabled, but the Production tunnel connector
will not survive a Hetzner reboot.

Until a separately approved persistent Production connector unit is created and
validated:

- planned or unplanned Hetzner reboot is an operational abort condition;
- the Windows PC fallback and elevated restart helper must remain available;
- on loss of the Hetzner connector, rollback is to stop the Hetzner API write path,
  start the Windows `Cloudflared` service through UAC, verify public ready, and only
  then remove the PC write-freeze under explicit command.

This condition does not affect the current live request path, data integrity,
single-writer state, image identity, or public health. It is a time-limited
continuity remediation item and must be closed through a separate approved
configuration lifecycle.

## Final state

- Public Production origin: Hetzner.
- Production API: running / healthy.
- Production PostgreSQL: healthy.
- Public live/ready: PASS.
- Windows Production connector: stopped.
- PC fallback: preserved, database read-only.
- Dual-write: absent.
- DNS and Cloudflare records: unchanged.

