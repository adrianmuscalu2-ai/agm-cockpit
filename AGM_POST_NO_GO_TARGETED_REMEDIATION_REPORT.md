# AGM post-NO-GO targeted remediation report

Date: 2026-07-28
Scope: PostgreSQL credential alignment and Corepack/npm decision
Verdict: **PASS / TARGETED REMEDIATION COMPLETE**

## Secret & Credentials Guardian action

Under the explicit Turn Command Center mandate, the Guardian:

- backed up the prior protected environment and manifest root-only;
- obtained the database identity exclusively from official container
  `agm-postgres`;
- atomically aligned `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and
  `DATABASE_URL`;
- preserved JWT, Turn Admin and OpenAI secrets;
- exposed no secret value;
- updated the integrity manifest.

Current redacted destination:

`postgres:5432/agm`

Integrity:

- environment SHA-256:
  `cd30a67af1804905cf78223f4b1503bb50cac6874b8accfd80fa2f9efaa73b7a`;
- manifest SHA-256:
  `1cb13a1f49a27a8c8a5c580181bac3716846c01b611dcbfbffa87266b453d2bd`;
- environment metadata: `root:root / 0600`;
- manifest metadata: `root:root / 0600`;
- protected backup directory:
  `/opt/agm/change-backups/credential-realignment-20260728T112600Z`.

## Limited Gate 1/Gate 4 revalidation

- required keys present exactly once: PASS;
- empty/placeholder values: none;
- PostgreSQL connectivity using the environment: PASS;
- Prisma connectivity using the approved image: PASS;
- Production Compose checksum unchanged: PASS;
- API systemd unit checksum unchanged: PASS;
- `docker compose config --quiet`: PASS;
- `systemd-analyze verify`: PASS;
- API unit: disabled/inactive;
- Production API container count: zero;
- target migrations: four complete, zero incomplete.

No API startup or migration occurred.

## Target database decision

The restored four-migration Hetzner target remains preserved. Because the PC fallback
resumed writes after the failed attempt, that restored copy is not a valid final
cutover snapshot.

The next deployment attempt must:

1. reapply write freeze;
2. create a new final PC dump and checksum;
3. replace/restore the Hetzner target from that new snapshot under the resumed
   deployment mandate;
4. apply migration 5 and reconcile before routing.

The existing target and previous final dump remain evidence only.

## Corepack/npm decision

`AGM_COREPACK_RUNTIME_DEPENDENCY_DECISION.md` records temporary conditional acceptance
for the current image, with fail-closed first startup before routing and mandatory
future self-contained-image remediation.

## Crisis Coordination Cell

Architecture analysis is documented in:

`AGM_CRISIS_COORDINATION_CELL_ARCHITECTURE.md`

The CCC is proposed but not activated. Its introduction requires a separate
governance decision.

## Conservation

- no deployment resumed;
- no Production API or connector started on Hetzner;
- no migration executed;
- no DNS/Cloudflare change;
- PC fallback remained healthy;
- only the authorized protected environment and manifest were changed.

## Final decision

The P1000 root cause is remediated and its affected boundaries are revalidated.
Corepack/npm has a documented controlled decision.

A new explicit deployment-resume mandate is still required.
