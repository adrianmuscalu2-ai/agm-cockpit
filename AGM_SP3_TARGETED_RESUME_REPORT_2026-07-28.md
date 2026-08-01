# AGM Production — targeted SP3 resume report

Date: 2026-07-28  
Mandate: targeted deployment resume from SP3  
Verdict: **NO-GO / CONTROLLED STOP / SAFE STATE RESTORED**

## Administrator path

- The ordinary Codex execution token is a Medium integrity token. Membership in
  `BUILTIN\Administrators` is present only as `deny only`.
- A read-only UAC helper was accepted successfully and proved:
  - identity: `DESKTOP-2MU7PHH\adria`;
  - elevated Administrator token: true;
  - exact service: `Cloudflared` / `Cloudflared agent`;
  - initial state: Running;
  - `CanStop`: true.
- The later UAC prompt required for the actual SP3 controlled stop was not accepted
  within the operational interval. The helper produced no stop proof and the
  Windows service remained Running.

## New freeze and dump

- PC fallback before freeze: ready; database available.
- New write-freeze: PASS.
- Source migration state: `4 complete / 0 incomplete`.
- New final dump:
  - `agm-pc-production-final-sp3-20260728T120336Z.dump`
  - size: `47981` bytes
  - SHA-256:
    `03B396B40D912F51C87A817A2329931905027D7B7489E0380A4A9302BFCE3A4E`
  - archive integrity/listing: PASS
  - transferred checksum: MATCH
  - Hetzner evidence permissions: `root:root / 0600`

## Target restore and validation

- Pre-change target backup: PASS:
  - `agm-postgres-20260728T120457Z.dump`
  - SHA-256:
    `0bc0f1ddea544c2e5d642b2813a3e5a227a22153321329f87e2bdb56a6588f66`
- Initial `pg_restore --clean` stopped because migration-5 foreign keys depended on
  baseline primary keys.
- With the target API stopped and the verified dump available, the CCC reset only
  the unpublished target's `public` schema, restored the new dump cleanly, and
  reapplied migration 4→5.
- Final migration state: `5 complete / 0 incomplete`.
- Migration idempotence: PASS.
- Baseline table row-count reconciliation: exact match.
- Additive tables:
  - `PreDepartureSession`: 0
  - `PreDepartureAnswer`: 0
- API local start:
  - approved Image ID and OCI revision: PASS;
  - live: PASS;
  - ready: PASS;
  - database dependency: available;
  - no pending migration.

## SP3 enforcement

The single-active rule was enforced. Because no elevated stop proof existed and the
Windows Production connector was still Running:

- the Hetzner Production connector was not started;
- no public traffic was switched;
- no overlap of Production connectors occurred;
- no dual-write occurred.

## Restored safe state

- Windows Production `Cloudflared`: Running.
- PC database write-freeze: removed; source is read-write.
- Public Production fallback: ready; database available.
- Hetzner Production API: stopped and conserved.
- Hetzner target database: conserved at `5 complete / 0 incomplete`.
- Hetzner Validation API: healthy.
- Hetzner Validation connector: active.
- No DNS, Cloudflare, tunnel configuration, image, or source-code modification.

Because PC writes were reopened, the dump from this attempt is evidence only and
must not be used for a later cutover.

## Required condition for another attempt

The operator must be present to accept both UAC prompts during the cutover window:

1. the controlled Windows `Cloudflared` stop at SP3;
2. the controlled Windows `Cloudflared` start if rollback is required.

The next attempt again requires a fresh write-freeze and a new final dump.
