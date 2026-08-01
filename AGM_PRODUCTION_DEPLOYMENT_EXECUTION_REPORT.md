# AGM Production controlled deployment execution report

Date: 2026-07-28
Mandate: controlled Production deployment
Final verdict: **NO-GO / DEPLOYMENT STOPPED / FALLBACK RESTORED**

## Stop reason

The deployment stopped during target migration, before API startup or connector
transition.

The protected Production environment resolves to:

`postgres:5432/agm_production`

Credentials remain redacted.

The official `agm-postgres` container reports its logical identity as:

`agm/agm`

`prisma migrate deploy` failed with Prisma `P1000` authentication failure against
database `agm_production`. This is a newly proven inconsistency between the protected
Production environment and the official PostgreSQL container.

No secret value was printed or copied into this report.

## Pre-execution drift control

Result: **PASS**

- approved document checksums matched;
- local image ID, RepoDigest, OCI revision and size matched;
- remote Compose, systemd unit and Cloudflare Production configuration hashes
  matched;
- protected environment remained `root:root / 0600`;
- `agm-postgres` retained its approved container ID, volume and healthy state;
- API unit was disabled/inactive and no Production API container existed.

## Artefact transfer

- image archive size: 160,530,944 bytes;
- archive SHA-256:
  `54cb618d95a63a87e4fc9cd63d14914f48f93b14ae95e1a43b9dc1b02b0a537b`;
- transfer checksum: MATCH;
- loaded Image ID:
  `sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`;
- OCI revision:
  `9956eb188fdd988bf0d7af93241c3c43962d9b39`;
- loaded RepoDigest: approved digest;
- loaded image size: 160,512,083 bytes.

The archive and baseline dump are stored root-only under:

`/opt/agm/change-backups/deployment-20260728`

## Production-copy rehearsal

Result: **PASS**

- isolated network, volume, PostgreSQL and API containers;
- no host PostgreSQL port;
- PC baseline dump SHA-256:
  `0cacc925a1b7c74037e5f40c5e993f3321d7f06cda583ba0bb0f71a54b6391e8`;
- restore with four completed migrations: PASS;
- migration 4→5: PASS;
- migration idempotence: PASS;
- five completed, zero incomplete migrations;
- all 13 source business-table counts matched;
- new Pre-Departure tables existed with zero rows;
- API live: PASS;
- API ready/database available: PASS;
- critical log scan: zero;
- all disposable resources removed.

Warning: Corepack downloaded `pnpm` from the public npm registry at container runtime.
The approved image therefore has an external startup dependency not captured inside
the image layers.

## Backups and final source snapshot

Hetzner pre-import backup:

- file: `agm-postgres-20260728T110046Z.dump`;
- size: 796 bytes;
- SHA-256:
  `fd0dc43612350985f04989b26eb83887495100b2e39a36e3b6abc90c6efe96f1`;
- mode: `0600`;
- backup service result: success.

PC final source:

- write freeze implemented as PostgreSQL default read-only plus session
  reconnection;
- API process termination was denied by the Windows ACL, so the API remained
  read-capable while database writes were fail-closed;
- final dump size: 47,981 bytes;
- final dump SHA-256:
  `a85f064471c8b89fa2d8924768eaf0d522c69497a217e44ccd921f7d7b544942`;
- source migrations: four complete, zero incomplete;
- encrypted transfer checksum: MATCH.

## Target state at stop

- final PC dump restored into the official Hetzner `agm` database;
- target migrations: four complete, zero incomplete;
- fifth migration not applied because the protected environment authentication
  failed;
- target PostgreSQL: healthy;
- target API containers: zero;
- `agm-production-api.service`: disabled/inactive;
- Hetzner Production connector: not started;
- DNS and Cloudflare unchanged;
- no public request reached the Hetzner target;
- no Hetzner Production application write occurred.

The restored target is preserved as evidence. The pre-import empty-target backup is
available. No attempt was made to rewrite the protected environment or revert the
target without a new mandate.

## Fallback restoration

Result: **PASS**

- PC database default read-only setting reset;
- existing PC database sessions reconnected;
- `default_transaction_read_only=off`;
- `transaction_read_only=off`;
- `AGM Services` scheduled task: Running;
- Windows `Cloudflared` service: Running;
- local API port 3000: listening;
- public Production `/ready`: PASS;
- public dependencies: database available, translation provider configured.

Production traffic therefore remains on the approved PC fallback.

## Required remediation

1. Secret & Credentials Guardian must reconcile `agm-production.env` with the
   official PostgreSQL container under a new explicit Turn Command Center
   authorization. Values must remain undisclosed.
2. Gate 1/Gate 4 must be revalidated only for the environment-to-database
   connectivity contract and updated integrity manifest.
3. Turn Command Center must decide whether the restored four-migration target is
   retained for resumed migration or reverted from the 796-byte pre-import backup.
4. The runtime Corepack/npm dependency must be explicitly accepted or remediated
   through a separately approved artefact lifecycle; the current deployment mandate
   does not authorize a rebuild.
5. A new deployment/resume mandate is required.

## Conservation

- no code or approved configuration was edited;
- no DNS or Cloudflare mutation;
- no Production connector transition;
- no Production API startup on Hetzner;
- no migration applied to the PC source;
- no dual-write interval;
- fallback restored and verified.

## Final decision

**NO-GO / DEPLOYMENT STOPPED / FALLBACK RESTORED**

The prior Gate 6 GO/READY is suspended only for the newly proven
environment-to-database inconsistency and runtime dependency warning. No further
deployment action is authorized by this report.
