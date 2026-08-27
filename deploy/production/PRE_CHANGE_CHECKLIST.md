# AGM Production pre-change checklist

Status: mandatory template. Completion does not authorize deployment.

## Change control

- [ ] Change ID and UTC window recorded.
- [ ] Gate 6 final verdict is GO / READY.
- [ ] Separate deployment/routing mandate attached.
- [ ] Command Lead on-duty identity and acknowledgement recorded.
- [ ] Independent Validator identity/session recorded and distinct from executor.
- [ ] Fallback Responsible identity and acknowledgement recorded.
- [ ] Rollback Responsible identity/session and acknowledgement recorded.
- [ ] STOP channel tested.

## Immutable identities

- [ ] Approved release manifest records source commit, workflow run ID,
  `AGM_IMAGE`, `AGM_WEB_IMAGE`, `AGM_REVISION`, and `AGM_WEB_REVISION`.
- [ ] API and Web identities use immutable registry digests produced by that same
  successful workflow run.
- [ ] `AGM_REVISION` and `AGM_WEB_REVISION` equal the reviewed source commit.
- [ ] API container is `agm-production-api`.
- [ ] PostgreSQL container is `agm-postgres`.
- [ ] PostgreSQL volume is `app_agm_postgres_data`.
- [ ] Production tunnel ID is
  `1c7d88b4-f2bb-40bb-82b0-37da35ee30a9`.
- [ ] Production hostname is `api.agmcockpit.com`.

## Fallback capture

- [ ] Windows `Cloudflared` service is running and its start mode is recorded.
- [ ] Windows configuration checksum is recorded without exposing credentials.
- [ ] Active Production connector is exactly one `windows_amd64` connector.
- [ ] Fallback API live and ready pass.
- [ ] Fallback PostgreSQL is healthy.
- [ ] Unique public correlation request appears only in fallback API logs.
- [ ] Exact restart command and authorized operator are recorded.

## Hetzner target

- [ ] Approved image is loaded and independently verified.
- [ ] Compose hash and systemd unit hash match approved evidence.
- [ ] Protected environment integrity, owner and mode pass.
- [ ] `agm-postgres` is healthy and the only approved Production database container.
- [ ] Hetzner Production cloudflared config hash matches approved evidence.
- [ ] Hetzner Production connector and API remain inactive before the authorized
  transition.

## Data and migration

- [ ] Gate 6D is PASS.
- [ ] Approved source database and target database are identified.
- [ ] Final source dump and transferred dump checksums match.
- [ ] Restore, schema, row-count and integrity checks pass.
- [ ] Release manifest records the exact ordered migration set, its digest, and
  `AGM_EXPECTED_MIGRATION_COUNT`; no fixed historical migration count is reused.
- [ ] Write freeze and single-writer control are active.
- [ ] Reconciliation owner and procedure are recorded.

## Rollback readiness

- [ ] Gate 6A runbook checksum matches approved evidence.
- [ ] Gate 6B role document checksum matches approved evidence.
- [ ] Gate 6C connector rollback plan checksum matches approved evidence.
- [ ] Rollback commands reviewed by Independent Validator.
- [ ] Abort triggers and SP0–SP5 acknowledged.
- [ ] Evidence directory and timestamp source are ready.

Any unchecked mandatory item is an automatic NO-GO.

## Candidate verification

- [ ] Working tree is clean and HEAD equals the reviewed release commit.
- [ ] API lint, API tests, API build, and Web build are PASS for that commit.
- [ ] Secret and Production dependency audits are PASS for that commit.
- [ ] Browser preflight fields are recorded separately; Plugin, Session, and Target
  Page are PASS, and Integrated Browser Control is either PASS or documented as the
  optional platform limitation allowed by the Browser runbook.
- [ ] `pnpm audit:wave1-browser` is PASS with a machine-readable report and captures.
- [ ] `pnpm audit:canonical-route` proves `/` redirects to `/basic` and `/basic`
  serves the AGM application.
