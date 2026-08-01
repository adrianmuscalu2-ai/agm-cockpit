# AGM Hetzner — Controlled Cutover Runbook

Date: 2026-07-27  
Status: plan only; execution requires explicit approval

Placeholders such as `<release-sha>`, `<container>` and `<dump>` must be resolved and
recorded before execution. Commands that mutate state are shown for the approved
execution window only.

## Step 1 — checkpoint and conservation

- Action: record Git state, hashes, runtime inventory and approved release scope.
- Commands: `git status --short`, `git rev-parse HEAD`, `Get-FileHash -Algorithm SHA256`.
- Files: working tree plus conservation manifest.
- Duration: 30–60 min.
- Risk: accidental inclusion or loss of local work.
- Verify: manifest reproduces all audited hashes.
- PASS: release scope approved and working state recoverable.
- NO-GO: unknown/unclassified changes.
- Rollback: none needed; read-only.

## Step 2 — prepare the Hetzner production design

- Action: prepare a separate production Compose project, private network, secrets file,
  restricted directories and loopback-only API.
- Commands after approval: `install`, `docker compose config`, `systemd-analyze verify`.
- Files: production Compose, systemd units, protected env file, deployment manifest.
- Duration: 1–2 h.
- Risk: collision with the working validation stack.
- Verify: unique project/container/volume names; no public database mapping.
- PASS: static config and permission audit pass.
- NO-GO: any dependency on validation container names or shared volumes.
- Rollback: remove only the newly created inactive production configuration.

## Step 3 — deploy API to Hetzner staging

- Action: build an immutable API image from `<release-sha>` without replacing the
  existing validation or PC production runtime.
- Commands: `docker build --label org.opencontainers.image.revision=<release-sha>`,
  `docker image inspect`.
- Files: Dockerfile, lockfile, API source, Prisma migrations.
- Duration: 30–60 min.
- Risk: deploying uncommitted behavior or stale migrations.
- Verify: image digest, label, package version and migration inventory.
- PASS: image identity is complete and API starts on an isolated loopback port.
- NO-GO: source/image cannot be tied to the approved release.
- Rollback: stop/remove only the new staging container; retain image evidence.

## Step 4 — disposable migration test

- Action: create an isolated disposable PostgreSQL database and restore a rehearsal
  dump.
- Commands: `pg_restore --list`, `createdb`, `pg_restore`, `prisma migrate deploy`.
- Files: rehearsal dump and checksum.
- Duration: 45–90 min.
- Risk: wrong database target.
- Verify: explicit disposable database name, schema, migration table and row counts.
- PASS: restore and current migrations complete without destructive surprises.
- NO-GO: migration failure, missing model or unexpected row loss.
- Rollback: drop only the disposable database/volume after evidence is retained.

## Step 5 — import a production copy

- Action: take a consistent PC production dump without stopping the existing service
  and restore it into the isolated Hetzner rehearsal database.
- Commands: `pg_dump --format=custom`, `sha256sum`, `scp`, `pg_restore`.
- Files: timestamped dump and SHA-256 manifest.
- Duration: 30–90 min, data-size dependent.
- Risk: source confusion or secrets in command history.
- Verify: source database identity, dump checksum and transferred checksum.
- PASS: hashes match and row-count manifest is complete.
- NO-GO: source cannot be proven or checksum differs.
- Rollback: discard the rehearsal target; PC remains unchanged.

## Step 6 — complete API tests

- Action: run API test suite and non-destructive HTTP matrix against the restored copy.
- Commands: `pnpm --filter @agm/api test`, scripted `curl`/Supertest matrix.
- Files: test evidence only.
- Duration: 45–90 min.
- Risk: test data contaminates the copy.
- Verify: use a dedicated test tenant/records and correlation IDs.
- PASS: every mandatory API gate passes.
- NO-GO: any auth, audit, incident, translation, Turn or sync failure.
- Rollback: rebuild the disposable database from the rehearsal dump.

## Step 7 — Browser test through temporary Hetzner endpoint

- Action: use `validation-api.agmcockpit.com` with an approved staging frontend build
  or runtime override; do not change the production Pages project.
- Commands: production build with the temporary staging API URL, Playwright/manual
  Browser matrix.
- Files: temporary build and evidence.
- Duration: 45–60 min.
- Risk: accidentally publishing staging configuration.
- Verify: build destination and API hostname before every test.
- PASS: direct routes, refresh, CORS, translation, Turn and Pre-departure pass.
- NO-GO: any PC log receives the staging test traffic.
- Rollback: discard the temporary build.

## Step 8 — APK/Android test through temporary endpoint

- Action: build a separately named staging APK using the Hetzner validation endpoint.
- Commands: `pnpm android:sync`, Gradle debug build, `adb install` on a test device.
- Files: staging-only APK and checksum.
- Duration: 60–90 min.
- Risk: confusion with production APK.
- Verify: distinct application label/version suffix and embedded endpoint inventory.
- PASS: Android translation, Turn, auth and Pre-departure work while PC API is not used.
- NO-GO: wrong embedded endpoint, TLS/CORS/network regression.
- Rollback: uninstall staging APK; production APK remains untouched.

## Step 9 — backup and restore rehearsal

- Action: correct the backup target in the proposed production unit, run one controlled
  backup and restore it to a disposable database.
- Commands: `systemctl start`, `sha256sum -c`, `pg_restore --list`, disposable restore.
- Files: backup script/unit, dump, manifest and evidence.
- Duration: 60–120 min.
- Risk: targeting the wrong container.
- Verify: container ID, database identity, file permissions and restored row counts.
- PASS: backup and full restore pass; external alert test succeeds.
- NO-GO: backup service failure or unverified restore.
- Rollback: restore previous unit file; validation/PC production remain active.

## Step 10 — approve the cutover window

- Action: freeze release scope, operators, rollback authority and communication plan.
- Commands: none.
- Files: signed decision record.
- Duration: 15–30 min.
- Risk: beginning without a single decision owner.
- Verify: all matrix items green and rollback target reachable.
- PASS: Product Owner, Release & Operations, QA/Inspector and Data Custodian approve.
- NO-GO: any missing approval or open critical finding.
- Rollback: cancel window.

## Step 11 — final dump and synchronization

- Action: enter a short write freeze, complete in-flight requests, create the final PC
  dump, transfer, restore and apply migrations.
- Commands: controlled maintenance gate, `pg_dump`, `sha256sum`, `scp`, `pg_restore`,
  `prisma migrate deploy`.
- Files: final dump, checksum and row-count manifest.
- Duration: target 15–30 min.
- Risk: writes occur after the dump.
- Verify: PC access logs show no mutations after freeze; final counts match.
- PASS: final Hetzner database is ready and PC snapshot retained.
- NO-GO: freeze cannot be enforced or integrity differs.
- Rollback: reopen the unchanged PC API; discard incomplete Hetzner restore.

## Step 12 — change Cloudflare route

- Action: attach `api.agmcockpit.com` to the validated Hetzner production origin.
- Commands: approved Cloudflare tunnel/DNS action recorded in audit log.
- Files: Cloudflare configuration and change record.
- Duration: 5–15 min.
- Risk: wrong tunnel, hostname or origin.
- Verify: unique request/correlation ID appears only in Hetzner API logs.
- PASS: hostname resolves through Cloudflare and reaches Hetzner.
- NO-GO: request reaches PC, mixed origins or TLS failure.
- Rollback: restore the saved Windows production route immediately.

## Step 13 — production verification

- Action: execute the full mandatory smoke matrix.
- Commands: health curls plus authenticated and functional test scripts.
- Files: timestamped evidence.
- Duration: 20–40 min.
- Risk: destructive smoke data.
- Verify: dedicated production-smoke tenant/data and cleanup contract.
- PASS: all validation matrix rows pass.
- NO-GO: any critical function fails.
- Rollback: invoke the rollback runbook.

## Step 14 — soak test

- Action: monitor for at least 2 hours; recommended 24 hours before closure.
- Commands: read-only metrics, logs, health and synthetic probes.
- Files: soak report.
- Duration: 2–24 h.
- Risk: delayed failure not seen during smoke.
- Verify: restart count, latency, errors, backup state, disk and DB connections.
- PASS: no critical errors and stable synthetic probes.
- NO-GO: sustained errors, data divergence or unavailable alerting.
- Rollback: route back to PC while its frozen snapshot remains usable.

## Step 15 — retire PC dependency

- Action: only after soak PASS, remove PC from the production route; retain it as a
  time-limited read-only rollback asset.
- Commands: none until separately approved.
- Files: architecture and operations documentation.
- Duration: 30 min plus retention period.
- Risk: premature removal of the rollback target.
- Verify: Android/Browser function with the PC API and Docker stopped during an
  approved controlled test.
- PASS: no request reaches PC and all functions remain healthy.
- NO-GO: any hidden dependency.
- Rollback: restart PC services and restore route.

## Step 16 — immediate rollback on NO-GO

- Action: stop the cutover, restore the saved Cloudflare route to Windows, reopen the PC
  write path and preserve all Hetzner evidence.
- Duration: target 10–20 min after decision.
- PASS: public API reaches PC and health/function tests pass.
- Escalation: if rollback exceeds 20 min, declare a production incident and stop all
  further migration actions.
