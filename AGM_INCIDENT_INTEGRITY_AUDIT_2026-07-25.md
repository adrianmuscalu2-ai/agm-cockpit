# AGM Incident Integrity Audit

Date: 2026-07-25
Environment: AGM local primary, public Cloudflare surfaces, Hetzner validation route
Audit mode: integrity and functional verification
Final decision: **CONDITIONAL GO**

## 1. Executive conclusion

The audit found no verified loss of source code, PostgreSQL data, schema migrations, or
Browser/Android build assets following the multi-service incident and Docker
reinstallation.

The active AGM production path is operational:

- local API readiness: HTTP 200;
- public API readiness: HTTP 200;
- public Cloudflare Pages frontend: HTTP 200;
- custom frontend domain: HTTP 200;
- PostgreSQL: healthy;
- authenticated local and public data reads: PASS;
- real public translation: PASS;
- Browser production build: PASS;
- Android synchronization and APK build: PASS;
- automated regression suites: PASS.

Development may continue only with the open operational findings recorded below. The
audit does not authorize treating the Hetzner validation environment, Windows monitor,
or remote Git protection as healthy until their findings are closed.

## 2. Scope and evidence

The audit covered:

1. Hetzner validation exposure and available historical infrastructure evidence;
2. Docker Engine, Compose services, containers, volumes, and restart state;
3. PostgreSQL readiness, schema, migrations, exact row counts, and logical-dump
   readability;
4. local and public API health plus authenticated reads;
5. public frontend, direct SPA routes, public assets, and CORS;
6. Android Capacitor synchronization, Browser asset parity, and APK compilation;
7. Browser build, local HTTP surface, public HTTP surface, and automated Browser-shell
   checks;
8. Git object integrity, working-tree state, last commit, and remote traceability;
9. required configuration presence and secret-file tracking controls;
10. automated and end-to-end functional tests.

Secrets and translated content were not printed into this report.

## 3. Results by objective

### 3.1 Hetzner server and services

Result: **HETZNER AVAILABILITY PASS / POINT 1 CLOSED**

- Audited host: `agm-cloud-validation-01`, Hetzner CPX22, Ubuntu 24.04.
- The Product Owner supplied direct Hetzner Cloud Console evidence confirming:
  - server state `Running`;
  - CPX22 allocation with 2 vCPU, 4 GB RAM, and 80 GB local disk;
  - no server-level critical alert or availability indication;
  - public IPv4 address `167.233.237.253`.
- An independent direct network check confirmed TCP/22 reachable on
  `167.233.237.253`.
- An SSH handshake reached the VPS and was rejected at authentication with
  `Permission denied (publickey)`. This confirms that the host and SSH service were
  reachable; the audit session did not possess the authorized private key.
- Historical repository evidence records prior PASS results for Docker, PostgreSQL,
  API, Cloudflared, and the backup timer on this validation VPS.

The HTTP 530 observation is not evidence that the Hetzner VPS is stopped. Follow-up
testing identified the public-access failure at the Cloudflare Tunnel connector layer,
documented separately in finding F-01.

Live systemd, Docker, disk, journal, and backup state inside the VPS remain outside the
direct evidence of this session because SSH authentication was unavailable. This
limitation does not reopen the server-availability conclusion.

### 3.2 Docker and containers

Result: **PASS WITH AUTOSTART RISK**

- Docker client/server: 29.6.2.
- Storage driver: `overlayfs`.
- Containers: 2 running, both healthy:
  - `agm-postgres`;
  - `agm-development-postgres`.
- `agm-postgres` restart count: 0 after recovery.
- PostgreSQL image: `postgres:16-alpine`.
- Primary volume: `agm_agm_postgres_data`.
- Volume creation: 2026-07-02T17:03:27Z, proving it was not recreated during the
  2026-07-25 Docker reinstallation.
- Windows `com.docker.service` was observed stopped/manual while Docker Engine was
  available through Docker Desktop. This is an autostart/reboot resilience risk.

### 3.3 Database integrity and persistence

Result: **PASS**

- PostgreSQL 16.14 accepted connections and reported healthy.
- All four Prisma migrations were present and completed:
  - `20260702171528_init`;
  - `20260702185645_add_evidence_metadata`;
  - `20260702191656_add_incident_reports`;
  - `20260714090500_add_turn_admin_credential`.
- Exact application row counts:

| Table | Rows |
|---|---:|
| Company | 1 |
| User | 1 |
| Role | 1 |
| UserRole | 1 |
| TransportJob | 6 |
| TransportJobStateHistory | 12 |
| AuditEvent | 21 |
| BusinessValidationReport | 12 |
| EvidenceMetadata | 1 |
| IncidentReport | 1 |
| LifecycleState | 14 |
| FinancialLedger | 1 |
| TurnAdminCredential | 1 |
| `_prisma_migrations` | 4 |

- Database size: 8,775 kB.
- A temporary custom-format logical dump was created inside the container, listed
  successfully by `pg_restore`, and removed after validation:
  - dump size: 47,798 bytes;
  - catalog list: 96 lines;
  - SHA-256:
    `f73f3920cc5bbf94cb98000843a910b7d62f68f93d9f986fd74ed9c26a87c79b`.

No evidence of database replacement, emptying, or migration loss was found.

### 3.4 API and primary endpoints

Result: **PASS**

- Local liveness: HTTP 200.
- Local readiness: HTTP 200, database available, translation provider configured.
- Public liveness: HTTP 200 through Cloudflare.
- Public readiness: HTTP 200 through Cloudflare.
- Local authenticated login and `/auth/me`: PASS.
- Public authenticated login and `/auth/me`: PASS.
- Local and public authenticated list checks:
  - transports: 6;
  - evidence records: 1;
  - incidents: 1.
- Real RO-to-DE translation through the public endpoint: PASS, provider `openai`.
- API automated tests: 3 suites, 11 tests, all PASS.

### 3.5 Public website/frontend

Result: **PASS**

- `https://agm-cockpit.pages.dev/`: HTTP 200.
- `https://agm-cockpit.pages.dev/turn`: HTTP 200.
- `https://agm-cockpit.pages.dev/email`: HTTP 200.
- `https://app.agmcockpit.com/`: HTTP 200.
- Public manifest, JavaScript, CSS, and logo assets: HTTP 200.
- CORS preflight:
  - `https://agm-cockpit.pages.dev`: HTTP 204, correct allowed origin;
  - `https://app.agmcockpit.com`: HTTP 204, correct allowed origin.
- Separate Astro website static build: PASS.
- Local Astro website surface: HTTP 200 on port 4321.

### 3.6 Android

Result: **TECHNICAL PASS / DEVICE UI NOT REPEATED**

- Production web build: PASS.
- Capacitor Android synchronization: PASS.
- Browser-to-Android packaged asset parity: 17 files checked, 0 missing,
  0 mismatches.
- Gradle `assembleDebug`: PASS, 93 tasks, no build failure.
- New APK:
  - file: `app-debug.apk`;
  - size: 7,667,651 bytes;
  - SHA-256:
    `BA5E5BDA075FC8BD0A7CD44A2F073E06E91AEE961720BE44E77A74A641A25817`.

No emulator/device automation was available in this audit. The Product Owner reported
that the installed Android application was operational, but that report is not a
substitute for a repeated instrumented device test.

### 3.7 Browser version

Result: **TECHNICAL PASS / INTERACTIVE UI PARTIAL**

- Production Browser build: PASS.
- Production API endpoint validation: PASS.
- Local Browser surface: HTTP 200 on port 5173.
- Public Browser surface and direct SPA routes: HTTP 200.
- E6.3 Browser navigation and shell tests: PASS.
- POC02 Browser presentation tests: PASS.

The browser automation channel reported no available browser instance. Therefore,
pointer, keyboard, visual layout, console, refresh, and offline/recovery interactions
were not repeated as a live UI session. No live interactive Browser PASS is claimed.

### 3.8 Git integrity and traceability

Result: **PASS — ACTIVE SOURCE STATE PROTECTED**

- Git object verification: `git fsck --full --no-dangling` exited 0.
- Current branch: `feature/post-basic-turn-architecture-audit`.
- At the initial audit checkpoint, the active branch had no upstream and contained
  42 commits not reachable from any remote branch. Four tracked application files and
  three Turn Command Center reports were also uncommitted. The original observation
  was therefore accurate for the repository state at that moment.
- The relevant source and documentation were reviewed, scanned for common credential
  patterns, checked with `git diff --check`, and committed as:
  - commit `db4611d`;
  - subject `feat(turn): protect command center audit state`.
- The complete active branch was published to
  `origin/feature/post-basic-turn-architecture-audit` and configured with that
  upstream. This protects the entire 42-commit active history plus the new checkpoint.
- `agmcockpit-website` was confirmed to be a separate, clean Git repository rather
  than untracked root-project source. Its active branch
  `feature/post-contest-functions-v02` was published to the separate GitHub repository
  `adrianmuscalu2-ai/agmcockpit-website` and configured with its upstream.
- The root project now ignores `/agmcockpit-website/` so the nested repository cannot
  be accidentally embedded in the primary repository.
- `.env` is ignored and is not tracked.
- `apps/web/.env.production` is tracked and contains the public production API
  endpoint as intended.
- Remaining untracked PNG/JPEG files are screenshots and audit/marketing media, not
  executable source code. They were intentionally not published automatically because
  visual artifacts require a separate privacy/content review.
- Two commits on separate historical/development branch tips were not published by
  the scoped protection action because they are not part of the active audited
  application history:
  - `9c3b374` on `development/post-contest`;
  - `e3117d4` on `ag-018-regression-backup-20260714`.
  Their objects remain valid locally. They do not prevent PASS for the active
  application source, but their future retention policy should be decided explicitly.

There is no evidence of Git object loss. The active AGM application code, active
history, Turn Command Center changes, audit documentation, and separate website
repository are protected in GitHub.

#### 3.8.1 Competition baseline integrity

Result: **PASS — BASELINE INTACT**

- Canonical branch: `baseline/agm-basic-v1`.
- Canonical commit:
  `7670640a7a8cdcd49418bfc85079c33105094d78`.
- Canonical tree:
  `7b0a85cc83fd776ec3aaed45b9dbff95403815fb`.
- Commit subject: `release: AGM Cockpit Basic baseline`.
- Annotated tag: `agm-cockpit-basic-v1.0.0`.
- The tag resolves to the same canonical commit and tree as the baseline branch.
- Git object and tree verification passed.
- The baseline branch reflog contains no movement after its creation at the release
  commit.
- The audit/remediation branch contains the competition baseline as an unchanged
  ancestor. All audit-related changes are nine later commits on
  `feature/post-basic-turn-architecture-audit`.
- No audit action rewrote, amended, reset, force-updated, or committed directly on
  `baseline/agm-basic-v1`.

The post-baseline interventions were made only in the descendant audit branch and
covered platform/agent registry synchronization, project catalog and organization map,
the Turn alert panel, the email send confirmation correction, governed email
monitoring, Turn Command Center audit changes, and the incident-integrity report.
These changes do not alter the immutable competition commit or its tree.

Remote traceability note: the baseline commit is protected in GitHub because it is
reachable from the published audit branch. At the time of this clarification, the
canonical branch name `baseline/agm-basic-v1` and annotated tag
`agm-cockpit-basic-v1.0.0` were still local refs and were not returned by
`git ls-remote`. Publishing those two canonical refs would improve discoverability and
release traceability, but their absence does not change or invalidate the preserved
competition commit.

### 3.9 Configuration integrity

Result: **PASS / POINT 5 CLOSED**

- All required runtime keys checked were present, non-empty, and not placeholders.
- No duplicate root `.env` keys were detected.
- `.env` remained outside Git.
- Production API URL validation passed.
- Root cause: the bcrypt PIN hash in the application `.env` legitimately contained
  `$`, but was unquoted. When Compose implicitly loaded the root file, one hash segment
  was treated as a variable reference, defaulted to an empty string, and emitted a
  warning. Under `$ErrorActionPreference = "Stop"`, that native warning could abort the
  interactive startup script.
- The local Compose manifest itself does not require application secrets; PostgreSQL
  values are deliberately declared in `docker-compose.yml`.
- The bcrypt value is now single-quoted. Application-style parsing preserves the exact
  bcrypt value while Compose no longer interpolates its `$` segments.
- Both Windows startup paths now call Compose with the dedicated
  `docker-compose.env`, separating Compose loading from the application `.env`.
- Root `.env` validation: 17/17 required values present, zero duplicates, bcrypt format
  valid, PostgreSQL URL scheme valid, JWT length valid, numeric port and timeout valid.
- Local manifest validation with Docker Compose v5.3.1: exit 0, zero missing-variable
  or interpolation warnings.
- Cloud validation manifest validation with explicit synthetic PostgreSQL variables
  and server-style env-file resolution disabled: exit 0, zero interpolation warnings.
  Its runtime secret file remains intentionally external at
  `/opt/agm/secrets/agm-validation.env`.
- Docker Engine client/server 29.6.2 and Docker Compose v5.3.1 are compatible with the
  current configuration.
- `agm-postgres`: running and healthy, `restart: unless-stopped`, PostgreSQL 16.14,
  accepting connections.
- Idempotent `compose up -d postgres`: exit 0, zero interpolation warnings, existing
  container identity and creation timestamp unchanged.
- Persistent volume `agm_agm_postgres_data` remains mounted and dates from
  2026-07-02.
- Local and public API readiness after validation: HTTP 200.
- API environment validation regression: 4/4 tests PASS.

### 3.10 Full functional/regression test

Result: **PASS WITH UI LIMITATIONS**

- API Jest: 11/11 PASS.
- Premium foundation tests: PASS.
- E6.2 canonical transitions: 18/18 PASS.
- E6.3 Browser navigation and shell: PASS.
- E6.4-E6.6 validation checks: PASS.
- POC02 after-departure stage 3: PASS.
- POC02 stage 4 presentation: PASS.
- Authenticated reads over local and public API: PASS.
- Real public translation: PASS.
- Browser build: PASS.
- Website build: PASS.
- Android synchronization: PASS.
- Android APK build: PASS.

Live browser automation and a fresh instrumented Android device test remain outside
the evidence completed in this session.

## 4. Operational findings

### F-01 — Cloudflare validation tunnel has no healthy connector

Severity: High for migration readiness, no current impact on local-primary production.
Status: **CLOSED — PASS**; Hetzner audit point 1 remains closed.

Verified evidence:

- `validation-api.agmcockpit.com` resolves to Cloudflare anycast A and AAAA
  addresses;
- TLS verification succeeds and the request reaches Cloudflare Frankfurt;
- Cloudflare returns HTTP 530, `Server: cloudflare`, a Cloudflare Ray ID, and the
  exact body `error code: 1033`;
- the Hetzner VPS is `Running` in the provider console;
- direct TCP/22 to the VPS succeeds;
- the primary hostname `api.agmcockpit.com` remains HTTP 200.

According to Cloudflare's official
[Error 1033 documentation](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1033/),
error 1033 means Cloudflare cannot find a healthy `cloudflared` instance connected to
the tunnel. Cloudflare separately documents that an origin service or reverse-proxy
reachability failure behind an already connected tunnel produces HTTP 502, not 1033.

Confirmed cause: the VPS had an active systemd drop-in that connected it to
`agm-api-production`, while `agm-api-validation` had zero connectors. The validation
hostname therefore targeted an inactive tunnel.

Remediation:

- created and installed the rotated dedicated tunnel
  `agm-api-validation-rotated-20260725`
  (`f4343acc-7303-4422-a10a-587a9dc96114`);
- moved only `validation-api.agmcockpit.com` to the rotated tunnel;
- removed the VPS production override and configured origin
  `http://127.0.0.1:3000`;
- retained the Windows connector as the only production connector;
- revoked the old validation tunnel after credential rotation.

Validation:

- rotated validation tunnel: four active Hetzner connections;
- validation liveness/readiness: 5/5 HTTP 200;
- production readiness during the same cycles: 5/5 HTTP 200;
- cloudflared service: active/enabled, zero automatic restarts.

### F-02 — Current source state not fully protected remotely

Severity: formerly High.
Status: **CLOSED — PASS**.

The finding accurately described the initial audit snapshot. It was closed by creating
checkpoint `db4611d`, publishing the active 42-commit application branch, and
publishing the clean active website branch to its separate GitHub repository.
Remaining local-only items are non-code media and two out-of-scope historical branch
tips, documented above.

### F-03 — Windows monitor state is stale

Severity: formerly Medium/High.
Status: **CLOSED — PASS**.

Root cause:

- the Windows monitor configuration contained only `api-local` and `api-public`;
- no Browser health check existed;
- the Operations Center supplied a real health URL only to the API card, while the
  Browser card had an empty URL;
- an SMTP recovery failure could abort the monitor before the updated online state was
  persisted;
- replacement of an existing `state.json` was not reliable in the original Windows
  write path.

Remediation:

- added `browser-local` for `http://127.0.0.1:5173/`;
- added `browser-public` for `https://app.agmcockpit.com/`;
- connected the Operations Center Browser card to the public Browser health URL;
- added a 15-second SMTP timeout and isolated alert-delivery errors from health-state
  persistence;
- made existing state-file replacement explicit and repeatable;
- installed the active configuration under the authorized Windows user, with backups
  of the previous configuration and state.

Validation:

- failure, deduplication, and recovery simulation for all four checks: PASS;
- repeated state replacement: PASS;
- production Browser build and Browser regression checks: PASS;
- active `api-local`, `api-public`, `browser-local`, and `browser-public`: online,
  HTTP 200, zero consecutive failures;
- scheduled task `AGM Service Monitor`: last result 0.

### F-04 — AGM service autostart task is not clean

Severity: formerly High for reboot recovery.
Status: **CLOSED — PASS**.

Historical cause and evidence:

- the recorded result `3221225786` / `0xC000013A` means that the PowerShell process
  was terminated externally; it is not an AGM application exception code;
- Windows System events show Docker Desktop Service installation at 10:59:57, a
  system restart initiated at 11:22:35, operating-system startup at 11:23:15, and the
  task launch at 11:23:23 on 2026-07-25;
- Task Scheduler operational history was disabled, so the exact process that
  terminated the affected task instance cannot be attributed retroactively;
- the original task had only an at-logon trigger. If terminated later in the same
  session, it had no independent trigger that guaranteed rearming.

Current configuration:

- principal: Windows user `adria`, interactive token, highest run level;
- trigger 1: at logon for `DESKTOP-2MU7PHH\adria`;
- trigger 2: every two minutes for recovery/rearming;
- multiple instances: `IgnoreNew`;
- restart on failure: three attempts at one-minute intervals;
- execution time limit: disabled (`PT0S`);
- start when available: enabled;
- action: hidden PowerShell running `scripts/Start-AGM-Services.ps1`;
- supervised dependencies: Docker Desktop/Engine, PostgreSQL container, AGM API;
- Cloudflare remains an independent automatic Windows service;
- public API availability additionally depends on network and Cloudflare connectivity.

Validation:

- finite supervisor run: exit code 0;
- local readiness: HTTP 200;
- public readiness: HTTP 200;
- persistent task steady state: `Running`;
- active-task result: `267009` / `0x00041301`, meaning `currently running`;
- controlled supervisor stop left API and database available;
- periodic trigger restarted the task automatically at the next interval;
- supervisor log after automatic rearm: `AGM API and PostgreSQL are ready`;
- repeatability and `IgnoreNew` behavior: PASS.

The automatic startup contract is intentionally after the AGM Windows user logs in,
because Docker Desktop and the interactive user token are dependencies. Historical
logs demonstrate successful post-logon starts across multiple dates. A disruptive
cold-reboot rehearsal was not required to establish this result because the logon
trigger, historical post-boot execution, finite exit-code test, and controlled
automatic rearm were all verified.

### F-05 — Root `.env` conflicts with Docker Compose interpolation

Severity: formerly High for one-click startup.
Status: **CLOSED — PASS**.

Cause:

- an unquoted bcrypt hash in the application `.env` contained `$`;
- implicit Compose loading interpreted part of that valid hash as an unset variable;
- PowerShell's stop-on-error behavior could abort the interactive launcher on the
  warning.

Remediation and validation:

- single-quoted the bcrypt value without changing its parsed value;
- isolated all scripted local Compose calls with
  `--env-file docker-compose.env`;
- local and cloud manifest validation: exit 0, zero interpolation warnings;
- all 17 required application variables present and structurally valid;
- Docker/Compose version compatibility, PostgreSQL health, persistence, readiness,
  and local/public API HTTP 200 verified.
- final idempotent Compose start retained the existing container and data volume.

### F-06 — Live UI validation incomplete

Severity: Medium.
Evidence: no browser automation instance and no instrumented Android device were
available in this audit.
Status: OPEN.

## 5. Final decision

### Integrity decision

**PASS** for local code-object integrity, PostgreSQL persistence, schema, application
records, builds, API functionality, public frontend availability, Browser/Android
asset parity, and automated regression.

### Operational decision

**CONDITIONAL GO** for continued local development.

**NO-GO** for declaring the entire platform fully healthy or migration-ready until:

1. the Cloudflare validation connector is restored or the validation hostname is
   formally retired; Hetzner server availability itself is already closed as PASS;
2. Browser and Android live UI smoke tests are repeated.

This decision is based only on evidence collected during the audit. No unverified
claim of code loss, data loss, or full-platform health is made.

### Operational incident disposition

The primary outage incident is archived in Turn Command Center under
`AGM-CLOSE-20260725-001` with decision **CLOSED WITH TRACKED FOLLOW-UP**. This
operational closure confirms restoration and integrity of the active AGM platform; it
does not override the migration-readiness and instrumented-UI limitations above.

Residual findings were transferred without loss of traceability:

- `AGM-FU-20260725-CF1033` — Cloudflare validation connector, CLOSED;
- `AGM-FU-20260725-UILIVE` — instrumented Browser/Android evidence.

The responsibility sign-offs, department lessons, Inspector decision, Chronicler
timeline, Version Guardian baseline confirmation, architecture reconciliation,
Release & Operations evidence, and legal-impact assessment are recorded in
`AGM_INCIDENT_INTEGRITY_CLOSURE_2026-07-25.md` and the typed Turn operational-closure
registry.
