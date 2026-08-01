# AGM production post-deployment checklist

No item authorizes deployment. Execute only in an approved deployment window.

- [ ] Loaded image ID equals `sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`.
- [ ] OCI revision equals `9956eb188fdd988bf0d7af93241c3c43962d9b39`.
- [ ] Rendered Compose contains no `build` key and uses the approved digest.
- [ ] Exactly one production PostgreSQL container and data volume exist.
- [ ] PostgreSQL publishes no host port.
- [ ] API publishes port 3000 only on `127.0.0.1`.
- [ ] `prisma migrate deploy` reports all five migrations complete.
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
- [ ] Disposable restore rehearsal passes with five complete migrations.
- [ ] Cloudflare routes traffic to exactly one production origin.
- [ ] Rollback commander and independent validator sign the evidence.

