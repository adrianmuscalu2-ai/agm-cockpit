# AGM Production — controlled deployment resume report

Date: 2026-07-28  
Execution authority: explicit controlled deployment resume mandate  
Coordination: Crisis Coordination Cell ACTIVE  
Final execution verdict: **CONTROLLED STOP / NO-GO AT SP3**

## Scope and conservation

- No Docker image rebuild, source-code change, DNS change, Cloudflare migration, or
  database migration on the PC source was performed.
- The approved image remained unchanged:
  `sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`.
- OCI revision remained:
  `9956eb188fdd988bf0d7af93241c3c43962d9b39`.
- No Hetzner Production connector was started.
- No concurrent Production connectors and no dual-write occurred.
- No secret value was printed or copied into this report.

## Successful execution evidence

1. PC fallback was `ready`; its PostgreSQL dependency was `available`.
2. A new database-level write-freeze was applied to PC Production and verified:
   `default_transaction_read_only=on`, `transaction_read_only=on`, and an explicit
   write probe was rejected.
3. A new final dump was created after the freeze:
   - file: `agm-pc-production-final-resume-20260728T113828Z.dump`
   - size: `47981` bytes
   - SHA-256:
     `B34A7BA22C732435544B0668D754C31A292D243197EDD04838FBDB871FED34EA`
   - custom archive integrity/listing: PASS
   - transferred checksum: MATCH
   - Hetzner evidence mode: `root:root / 0600`
4. Hetzner pre-change backup completed with exit status 0:
   - file: `agm-postgres-20260728T114011Z.dump`
   - SHA-256:
     `52d5bd24280c99f9a243bc67f29b84b83a36d7e4b1cb85f4f15c635f51f17cd7`
5. The new dump was restored to the official target `agm-postgres`.
6. Migration `20260726031500_add_pre_departure_sync` was applied successfully.
   The idempotence rerun reported no pending migrations.
7. Target migration state was `5 complete / 0 incomplete`.
8. Row-count reconciliation matched the frozen source for all approved baseline
   tables. The additive tables `PreDepartureSession` and `PreDepartureAnswer` both
   contained zero rows.
9. The first local Hetzner API start ultimately passed:
   - exact approved image and OCI revision: PASS
   - `/api/v1/health/live`: PASS
   - `/api/v1/health/ready`: PASS
   - PostgreSQL dependency: available
   - container health: healthy
   - controlled restart of the same container: ready PASS

## Controlled deviations

### Port conflict

The first systemd start found `127.0.0.1:3000` occupied by the Validation API
`cloud-api-1`. The active Hetzner `cloudflared.service` was also the Validation
connector. The CCC temporarily suspended both Validation components, without
changing configuration, to prevent cross-environment exposure and free the approved
Production port.

### Corepack runtime dependency

Startup encountered transient `EAI_AGAIN` while Corepack attempted to obtain
`pnpm@9.12.3`. Under the mandate's temporary Corepack acceptance, the exact pnpm
version was prepared in a disposable container created from the approved image and
only its runtime cache was copied into the existing Production container. The helper
container and host-side temporary cache were removed. The image and Compose file
were not modified.

### Incomplete Docker network attachment

Because the original container creation failed during port binding, the existing
Production container had no attached Docker network. It was reattached to the
already validated `app_default` network with service alias `api`. No new network or
architecture was introduced. After attachment, Prisma, live, ready, and database
checks passed.

## SP3 stop condition

The Windows Production connector remained active as service `Cloudflared`.
The execution session could read its state but lacked the Windows service-control
permission required to stop it:

`Cannot open Cloudflared service on computer '.'`

The single-active rule prohibited starting the Hetzner Production connector while
the Windows connector remained active. The Hetzner connector was therefore never
started and public traffic was never switched.

## Controlled rollback state

- `agm-production-api`: stopped and conserved; approved image retained.
- Hetzner target database: conserved with `5 complete / 0 incomplete`.
- `cloud-api-1`: restored healthy.
- Hetzner Validation `cloudflared.service`: restored active.
- Windows Production `Cloudflared`: Running.
- PC write-freeze: removed; `default_transaction_read_only=off`.
- Public Production fallback: `ready`, database `available`.
- No DNS, Cloudflare, tunnel configuration, or public infrastructure modification.

Because PC writes were reopened, the dump generated in this attempt is retained only
as evidence and **must not be reused for a future cutover**. A future authorized
attempt requires a fresh write-freeze and a new final dump.

## Required unblock

Before a new cutover attempt, the Fallback Responsible must provide an elevated
Windows execution path capable of stopping and restarting the `Cloudflared` service
and proving its state. The exact commands must be executed from an Administrator
session:

```powershell
Stop-Service -Name Cloudflared -Force
Get-Service -Name Cloudflared
```

Rollback capability must also be proven:

```powershell
Start-Service -Name Cloudflared
Get-Service -Name Cloudflared
```

The service must not be stopped outside an authorized cutover window.

