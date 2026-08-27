# AGM production post-deployment checklist

No item authorizes deployment. Execute only in an approved deployment window.

- [ ] Loaded API and Web image IDs equal the immutable digests in the approved release manifest.
- [ ] API and Web OCI revisions equal the approved source commit.
- [ ] Rendered Compose contains no `build` key and uses the approved digest.
- [ ] Exactly one production PostgreSQL container and data volume exist.
- [ ] PostgreSQL publishes no host port.
- [ ] API publishes port 3000 only on `127.0.0.1`.
- [ ] `prisma migrate deploy` reports the exact ordered migration set and count recorded in the release manifest.
- [ ] `_prisma_migrations` contains zero failed or partial entries.
- [ ] `/api/v1/health/live` returns `status=ok`.
- [ ] `/api/v1/health/ready` returns `status=ready`.
- [ ] Ready reports `database=available`.
- [ ] API and PostgreSQL logs contain no critical error.
- [ ] Login and `/auth/me` pass.
- [ ] One controlled translation passes.
- [ ] Turn Admin and Pre-departure smoke checks pass.
- [ ] CORS accepts only the approved frontend origins.
- [ ] API restart returns ready and migrations remain idempotent.
- [ ] Backup produces a mode-0600 dump and matching SHA-256 manifest.
- [ ] Disposable restore rehearsal passes with `AGM_EXPECTED_MIGRATION_COUNT` complete migrations.
- [ ] `https://app.agmcockpit.com/` returns 308 with `Location: /basic`.
- [ ] `https://app.agmcockpit.com/basic` returns 200 and the audited AGM asset signature.
- [ ] Controlled Browser validation of the deployed `/basic` route passes; `POC 02` is absent from the Production shell.
- [ ] Cloudflare routes traffic to exactly one production origin.
- [ ] Rollback commander and independent validator sign the evidence.
