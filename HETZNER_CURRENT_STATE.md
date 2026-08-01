# AGM Hetzner — Current State

Date: 2026-07-27  
Mode: read-only audit  
Decision: **NOT READY FOR PRODUCTION CUTOVER**

Step 2A update: **PASS — public PostgreSQL exposure removed on 2026-07-27**

## 1. Local conservation record

- Branch: `feature/pre-departure-stage-5-final-report`
- HEAD: `9956eb188fdd988bf0d7af93241c3c43962d9b39`
- Working tree: 8 tracked files modified plus untracked reports, Android diagnostics,
  APK artifacts and evidence.
- No commit, branch, push, stash application, reset or deletion was performed.

Relevant modified-file SHA-256:

| File | SHA-256 |
|---|---|
| `apps/api/src/translation/translation.controller.ts` | `2B5127DBD5850CFB4C4E5FB36EA8816564CE259EBC2FD3A72FA20833C19917FD` |
| `apps/api/src/translation/translation.service.ts` | `A79E958C4F221594E41535D00CE18B70CF90EB66770DE2D6958B863D0210BCBE` |
| `apps/web/android/app/build.gradle` | `4F5E11B19C4011E7CF0508D207738BFCE2BC998B410653D48CB5BDE0F5C73B05` |
| `apps/web/android/app/src/main/java/com/agm/cockpit/MainActivity.java` | `CE4A8EFB0D4E961221C1BFF423ABBE126C2B70EADCD3F636A63A426533D20C7F` |
| `apps/web/public/sw.js` | `6A67B0EE07EF5B5C8F349FBEB7419B8CBBDF230B55B1F34C61A8964A6572BDF3` |
| `apps/web/src/main.ts` | `B925A8055207631FA2F52A8ED78CF077ECE502A1A977E24F828C056B713B0146` |
| `apps/web/src/styles.css` | `2A676A4ED84022E5801150155B2F6E317892A15E45522F4CA3A972F4D8D39A4A` |
| `apps/web/src/translationAdapter.ts` | `28AA71F3D8189059692A580FB18D468A9A5732C013DE563834E7993A418BD804` |
| `AgmDiagnosticsPlugin.java` | `258B4A0458D93A4737A448650A8F42388FDC3E677A62D83B113994215CCB9D7B` |
| `apps/web/src/admin-report.ts` | `EE363515E0EB00BB02036E28B07FB5A7679C91EFC7C2AC77E79534010ED92E3B` |
| `apps/web/src/native-diagnostics.ts` | `85020AB6C07B597871AF92B0C022A1DE71BE2C63331C1A93C2A040AA58763138` |
| Both current APK files | `C270161B6639ACA61534DF5C86F03ED0038F02B86EB9C08926C96B31A8D943F5` |

## 2. Host

- Host: Hetzner validation server.
- OS: Ubuntu 24.04.4 LTS, kernel 6.8.
- Uptime at audit: 4 days.
- CPU load: effectively idle.
- RAM: 3.7 GiB total, approximately 3.0 GiB available.
- Swap: 2 GiB, unused.
- Disk: 75 GiB total, 66 GiB available, 9% used.
- SSH user: `agmops`, member of `sudo`.

The server has sufficient capacity for staging and an initial production workload,
subject to load and restore testing.

## 3. Runtime already installed

- Docker Engine 29.6.2.
- Docker Compose 5.3.1.
- `cloudflared.service`: enabled and running.
- `docker.service`: enabled and running.
- `fail2ban.service`: enabled and running.
- `agm-postgres-backup.timer`: enabled and waiting.
- UFW: enabled; default incoming policy deny; SSH allowed.

Containers:

| Container | Purpose | Status | Exposure |
|---|---|---|---|
| `cloud-api-1` | AGM validation API | healthy | `127.0.0.1:3000` only |
| `cloud-postgres-1` | PostgreSQL used by validation API | healthy | Docker network only |
| `agm-postgres` | older/parallel PostgreSQL | healthy | `127.0.0.1:5432` only after Step 2A |

The public validation route returns:

- `/api/v1/health/live`: PASS;
- `/api/v1/health/ready`: PASS;
- database: available;
- translation provider: configured.

## 4. Installed code and database

- API image: `agm-api:validation`.
- Image digest: `sha256:aae205d14188619496e5a662356836e9c42338e86e3cb635392545af43f5effa`.
- API package version: `0.1.0`.
- `/opt/agm/app` has no Git metadata; the exact commit cannot be proven.
- Files in `/opt/agm/app` have broadly permissive `0777` modes and must not be
  accepted for production.

The active validation database contains four Prisma migrations:

1. `20260702171528_init`
2. `20260702185645_add_evidence_metadata`
3. `20260702191656_add_incident_reports`
4. `20260714090500_add_turn_admin_credential`

The current repository additionally requires:

- `20260726031500_add_pre_departure_sync`

Therefore the installed API/database is behind the current application contract.

## 5. Configuration inventory

The protected validation environment contains these variable names:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`
- `NODE_ENV`
- `PORT`
- `API_HOST`
- `TRUST_PROXY_HOPS`
- `CORS_ALLOWED_ORIGINS`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `OPENAI_API_KEY`
- `OPENAI_TRANSLATION_MODEL`
- `OPENAI_TRANSLATION_TIMEOUT_MS`

No values were printed or copied.

## 6. Backup state

Historical daily dumps from 18–23 July have matching SHA-256 manifests. A precutover
dump also exists.

Current state:

- timer enabled and active;
- last scheduled execution, 27 July: **FAILED**;
- reason: `postgres_container_not_found`;
- configured target: `app-postgres-1`;
- existing containers: `cloud-postgres-1` and `agm-postgres`;
- the next scheduled run would fail again unless corrected.

The existing precutover dump is mode `0644`, less restrictive than the approved
`0600` policy. No encrypted off-site copy or currently verified restore rehearsal was
observed in this audit.

## 7. Security findings

Resolved in Step 2A:

- TCP `5432` was externally reachable on the Hetzner IP.
- Logs showed repeated failed external PostgreSQL authentication attempts.
- The old Compose mapping was changed from host-wide `5432:5432` to
  `127.0.0.1:5432:5432`.
- External TCP validation now reports port `5432` unreachable.
- `cloud-postgres-1` retained the same container ID and start time and remained healthy.
- The old `agm-postgres` retained volume `app_agm_postgres_data`.
- The previous Compose file is preserved with mode `0600` under
  `/opt/agm/change-backups/step-2a-20260727/`.

High:

- two PostgreSQL stacks and three Docker volumes create source-of-truth ambiguity;
- backup automation targets a nonexistent container;
- deployed application files are broadly writable;
- deployed code has no Git commit identity;
- Cloudflare is configured for validation, not approved production cutover.

## 8. Current assessment

### A. Installed

Ubuntu, Docker, Compose, UFW, fail2ban, cloudflared, AGM API, two PostgreSQL stacks,
backup script/timer and historical backups.

### B. Working

Host resources, Docker, validation API, active validation database, Cloudflare
validation route, live/ready health and historical backup checksums.

### C. Missing

Current application release, Pre-departure migration, authoritative production data
copy, production smoke matrix, working backup, restore rehearsal, external alerting,
commit-to-image traceability and Android validation against the Hetzner staging route.

### D. Unsafe

Public PostgreSQL port, repeated login attempts, duplicate databases, failed backup,
permissive application file modes and unknown deployed commit.

### E. Required before production

Close public database exposure; select one database; deploy an immutable, identified
release; import and validate a production copy; repair and test backup; execute a
disposable restore; validate Browser/Android; then authorize a controlled route
cutover.
