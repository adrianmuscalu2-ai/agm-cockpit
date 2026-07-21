# AGM Cloud Migration Decision Audit

Date: 2026-07-17
Status: analysis only; no migration or architecture change approved
Scope: move the existing AGM runtime from the home PC to a VPS with minimum change

## Executive decision

The migration is technically feasible without changing AGM's functional architecture,
the Android application, or the public API contract.

The recommended first production target is one x86-64 VPS in Germany running Ubuntu
24.04 LTS, Docker Engine with Compose, the existing PostgreSQL 16 database, the AGM
NestJS API, and `cloudflared`. The public application can continue using:

```text
https://api.agmcockpit.com/api/v1
```

The Android RC4 APK therefore does not need a new endpoint or a rebuild if the same
hostname and API contract are retained.

The minimum deployment work is not a functional redesign:

- package the AGM API as a Linux service or Docker container;
- make PostgreSQL credentials secret and remove public exposure of port 5432;
- copy the database with a verified backup/restore procedure;
- install the existing named Cloudflare Tunnel on the VPS;
- replace Windows Task Scheduler supervision with Docker restart policies or systemd;
- add persistent timestamped API, tunnel, and host logs;
- add external availability monitoring and tested backups.

Recommended initial size: **CX33-class x86 VPS, 4 shared vCPU, 8 GB RAM, 80 GB SSD**.
This leaves useful headroom for AGM Premium while keeping the topology unchanged.

## 1. Current architecture inventory

### Client and public endpoints

| Component | Current implementation | Migration impact |
|---|---|---|
| Android application | Capacitor 8 application with bundled Vite assets | None |
| Production API base URL | `https://api.agmcockpit.com/api/v1` | Keep unchanged |
| API route used for translation | `POST /translation/actions/translate-text` | Keep unchanged |
| Health endpoints | `/health/live`, `/health/ready` | Reuse for monitoring |
| Browser origins | `https://localhost`, Cloudflare Pages/custom web origin where enabled | Preserve in CORS |
| Android transport | HTTPS; clear-text disabled for production | None |

The endpoint is embedded at web build time through `VITE_AGM_API_BASE_URL`. RC4 already
contains the public hostname, so the infrastructure behind the hostname can move
without changing the APK.

### Server-side components

| Component | Technology | Current runtime |
|---|---|---|
| AGM API | Node.js, NestJS 10, Express adapter | Windows process, port 3000 |
| Database access | Prisma 5 | `DATABASE_URL` |
| Database | PostgreSQL 16 Alpine | Docker volume `agm_postgres_data` |
| Translation provider | OpenAI Responses API, `gpt-4.1-mini` | Outbound HTTPS |
| Public ingress | Named Cloudflare Tunnel `agm-api-production` | Windows service |
| API supervision | PowerShell scheduled task | Windows-specific |
| Database supervision | Docker Desktop plus PowerShell | Windows-specific |

### Device-local and external functions

| Function | Execution location | VPS dependency |
|---|---|---|
| OCR | Tesseract.js on the device; image/history kept locally | None, except later translation of OCR text |
| Dictation | Android `SpeechRecognizer` or browser speech recognition | No AGM server dependency |
| Voice playback | Android `TextToSpeech` or browser speech synthesis | No AGM server dependency |
| Email projection | Native Android email intent or `mailto:` | No AGM server dependency |
| Translation | AGM API followed by OpenAI API | Yes |
| Profile, contacts, OCR history, preferences | Device `localStorage` | None in Basic |

### Ports and network dependencies

| Flow | Port/protocol | Required after migration |
|---|---|---|
| Phone/browser to Cloudflare | TCP 443 / HTTPS | Yes |
| `cloudflared` to Cloudflare | Outbound HTTPS/QUIC | Yes |
| `cloudflared` to AGM API | `127.0.0.1:3000` or Compose service network | Yes, private only |
| AGM API to PostgreSQL | TCP 5432 | Yes, private Docker network only |
| AGM API to OpenAI | TCP 443 / HTTPS | Yes |
| SSH administration | TCP 22 or chosen management port | Restricted by firewall |

No database, API port, or Docker daemon should be exposed directly to the public
Internet. Cloudflare Tunnel allows inbound ports 80 and 443 on the VPS firewall to
remain closed if it is retained.

### Configuration and secrets

Required production variables include:

```text
NODE_ENV
PORT
API_HOST
TRUST_PROXY_HOPS
CORS_ALLOWED_ORIGINS
DATABASE_URL
JWT_SECRET
JWT_EXPIRES_IN
OPENAI_API_KEY
OPENAI_TRANSLATION_MODEL
OPENAI_TRANSLATION_TIMEOUT_MS
AGM_TURN_ADMIN_PIN_HASH
```

Secrets must not be copied into the image, repository, Compose file, backup manifest,
or logs. They should be supplied through a root-readable environment file or a
provider secret mechanism.

## 2. Direct migration compatibility

### Moves without application-code changes

- compiled NestJS API and all current API routes;
- PostgreSQL schema and Prisma migrations;
- OpenAI translation integration;
- named Cloudflare Tunnel and public DNS hostname;
- Android RC4 APK and its API contract;
- CORS contract for the Capacitor origin;
- local OCR, dictation, voice playback, profile, contacts, and email projection.

### Configuration-only changes

- `DATABASE_URL`: from Windows host/localhost to the private PostgreSQL service;
- `API_HOST`: `127.0.0.1` when API runs on the host, or `0.0.0.0` inside a container;
- `TRUST_PROXY_HOPS`: retain the tested production proxy setting;
- Cloudflare ingress origin: point to the API host/container on port 3000;
- secret values and production CORS origins;
- restart, backup, log rotation, and monitoring configuration.

### Current Compose limitation

The current `docker-compose.yml` contains only PostgreSQL. The API and `cloudflared`
are not containerized. It can be used to start the database on Linux, but it is not
a complete server deployment.

Two compatible deployment choices exist:

1. Run PostgreSQL in Compose and AGM API plus `cloudflared` under systemd.
2. Add deployment-only Docker definitions for API and `cloudflared`, retaining the
   same application code and API contract.

Option 2 is recommended because it gives one restart and logging model. This is a
deployment packaging change, not a functional architecture change.

### Windows-bound dependencies

- Docker Desktop startup;
- PowerShell supervisor scripts;
- Windows Task Scheduler;
- Windows `cloudflared` service path and system-profile credentials;
- Android build tooling, if APK builds continue on the development PC.

None of these are runtime requirements of the AGM API itself. APK compilation may
remain on the development machine; it does not need to move to the VPS.

## 3. Minimum infrastructure requirements

### Staging floor

- 2 shared x86 vCPU;
- 4 GB RAM;
- 40 GB SSD;
- Ubuntu 24.04 LTS x86-64;
- daily database dump and provider backup;
- Docker restart policies;
- 7-day application logs, 30-day incident/error summaries;
- external checks against `/health/live`, `/health/ready`, and a controlled synthetic
  translation.

### Recommended initial production

- 4 shared x86 vCPU;
- 8 GB RAM;
- 80 GB SSD;
- 20% or more free disk maintained;
- daily encrypted PostgreSQL backup with restore verification;
- provider backup plus a logically separate database dump;
- host metrics for CPU, RAM, disk, load, container restarts, and network;
- alerts for readiness failure, translation failure rate, latency, disk usage, and
  backup age;
- unattended security updates with controlled reboot windows;
- SSH keys only, firewall default deny, no public PostgreSQL/API ports.

### Traffic estimate

Basic text translation is low-bandwidth. Even 100,000 translations per month at an
assumed 10 KB combined request/response overhead are roughly 1 GB before protocol and
monitoring overhead. APK distribution and future document/photo uploads would dominate
traffic, not text translation.

An EU VPS allowance measured in terabytes is therefore far above current Basic needs.
Traffic must be recalculated when Premium starts storing photos, PDFs, voice recordings,
or evidence files.

## 4. Cost analysis

Pricing basis: Hetzner Germany, prices effective 2026-06-15, including 19% VAT. Server
backup is estimated at 20% of the server price and provides seven provider backup
slots. A primary IPv4 is shown separately at EUR 0.60/month. Prices should be
reconfirmed at order time.

### A. Test/staging

| Item | Monthly | Annual |
|---|---:|---:|
| CX23, 2 vCPU / 4 GB / 40 GB | EUR 6.53 | EUR 78.36 |
| Provider backup, 20% | EUR 1.31 | EUR 15.67 |
| Primary IPv4 | EUR 0.60 | EUR 7.20 |
| Cloudflare Tunnel/DNS incremental cost | EUR 0.00 | EUR 0.00 |
| Basic external monitoring | EUR 0.00 | EUR 0.00 |
| Included SSD and traffic | EUR 0.00 | EUR 0.00 |
| **Infrastructure subtotal** | **EUR 8.44** | **EUR 101.23** |

Use only for staging or a short parallel migration test. Four GB is sufficient for
the current API and small PostgreSQL database, but provides limited Premium headroom.

### B. Initial production, recommended

| Item | Monthly | Annual |
|---|---:|---:|
| CX33, 4 vCPU / 8 GB / 80 GB | EUR 10.10 | EUR 121.20 |
| Provider backup, 20% | EUR 2.02 | EUR 24.24 |
| Primary IPv4 | EUR 0.60 | EUR 7.20 |
| Cloudflare Tunnel/DNS incremental cost | EUR 0.00 | EUR 0.00 |
| Basic external monitoring | EUR 0.00 | EUR 0.00 |
| Included SSD and traffic | EUR 0.00 | EUR 0.00 |
| **Infrastructure subtotal** | **EUR 12.72** | **EUR 152.64** |

This is the recommended balance for Basic plus early Premium development.

### C. Scalable single-node configuration

| Item | Monthly | Annual |
|---|---:|---:|
| CX43, 8 vCPU / 16 GB / 160 GB | EUR 19.03 | EUR 228.36 |
| Provider backup, 20% | EUR 3.81 | EUR 45.67 |
| Primary IPv4 | EUR 0.60 | EUR 7.20 |
| Cloudflare Tunnel/DNS incremental cost | EUR 0.00 | EUR 0.00 |
| Basic external monitoring | EUR 0.00 | EUR 0.00 |
| Included SSD and traffic | EUR 0.00 | EUR 0.00 |
| **Infrastructure subtotal** | **EUR 23.44** | **EUR 281.23** |

This adds capacity, not high availability. A single larger VPS still has one host,
one database, and one failure domain.

### External services and variable costs

The current translation model is `gpt-4.1-mini`. Published API rates are USD 0.40 per
million input tokens and USD 1.60 per million output tokens. OpenAI is billed
separately from ChatGPT subscriptions.

Illustrative translation budget, assuming 250 input and 150 output tokens per request:

| Translations/month | Estimated OpenAI cost/month | Estimated cost/year |
|---:|---:|---:|
| 1,000 | USD 0.34 | USD 4.08 |
| 10,000 | USD 3.40 | USD 40.80 |
| 100,000 | USD 34.00 | USD 408.00 |

Actual token counts, retries, longer texts, future Premium prompts, exchange rate,
taxes, and model-price changes will alter these figures. Configure project spending
limits and alerts.

Current Basic OCR, dictation, and voice playback have no AGM cloud usage fee because
they execute through Tesseract/device platform services. This changes if Premium adds
server-side vision, transcription, realtime voice, document storage, or messaging.

The existing domain and DNS require no migration-specific purchase. Normal domain
renewal remains an existing business cost and is excluded because its registrar price
is not present in the repository.

Provider setup fees for the listed cloud instances are EUR 0. Internal migration work
is estimated at 6-12 engineering hours, including rehearsal and restore testing; no
cash value is assigned without an agreed hourly rate.

## 5. Low-risk migration and rollback plan

### Phase 0: acceptance gates

- Freeze Basic at RC4.
- Record current DNS, tunnel, environment variable names, schema version, and APK hash.
- Take a PostgreSQL dump and prove it restores into a temporary database.
- Define acceptable translation latency and error rate.
- Do not expose the new server publicly yet.

### Phase 1: parallel VPS

- Create an Ubuntu 24.04 LTS x86 VPS in Germany.
- Apply SSH key access, firewall, automatic security updates, and time synchronization.
- Install Docker Engine/Compose and `cloudflared`.
- Deploy PostgreSQL and API with private networking and persistent volumes.
- Import a sanitized staging database first, then run Prisma migration checks.
- Use separate staging secrets and a temporary tunnel hostname.

### Phase 2: internal and external verification

- Verify API live/readiness endpoints.
- Run automated API/security tests and all six RO/DE/EN translation directions.
- Verify short/long text and provider timeout behavior.
- Test Android through mobile data from multiple devices.
- Test OCR-to-translation, dictation-to-translation, playback, Email Assistant, CORS,
  authentication, restart recovery, backup, and restore.
- Suspend or reboot the VPS and measure automatic recovery.
- Confirm persistent timestamped logs survive container restarts.

### Phase 3: controlled cutover

Preferred cutover keeps the same named tunnel and hostname:

- stop writes or take a final consistent database dump;
- import and verify the final database on the VPS;
- start the VPS `cloudflared` replica for the existing named tunnel;
- verify public traffic reaches the VPS;
- stop the home connector only after successful validation;
- keep the local API/database intact but read-only or stopped during the observation
  window to avoid split-brain writes.

Cloudflare Tunnel supports multiple replicas. During overlap, both origins must expose
the same application state; otherwise requests can alternate between divergent
databases. Therefore, replica overlap is suitable for connectivity validation but not
for sustained dual-write operation with independent PostgreSQL databases.

### Phase 4: observation

- Monitor continuously for at least 24 hours and during real 4G/5G tests.
- Review status codes, translation provider errors, latency percentiles, restarts,
  resource use, and backup completion.
- Keep the home environment unchanged until the acceptance window closes.

### Immediate rollback

- stop the VPS tunnel connector;
- start or confirm the original home API, PostgreSQL, and tunnel connector;
- verify public readiness and one real translation;
- if production writes occurred on the VPS, export and reconcile them before declaring
  rollback complete;
- document the failure and retain VPS logs.

Keeping the same hostname means rollback does not require a new APK. Database divergence
is the principal rollback risk and must be controlled with one writable production
database at a time.

## 6. Premium impact

The recommended CX33 can host the current modular monolith and early Premium modules on
the same infrastructure. Keep at least 40-50% RAM and CPU headroom during the first
Premium pilots.

Likely scale triggers:

- server-side image analysis for load securing or dashboard warnings;
- document/PDF ingestion and persistent evidence storage;
- vector search and validated knowledge libraries;
- realtime voice sessions, transcription, or speech generation;
- WhatsApp webhook traffic and message/media retention;
- background workers, scheduled legal-content ingestion, and audit processing;
- multiple organizations, higher concurrency, or reporting workloads.

Fixed or mostly fixed costs:

- base VPS;
- provider backup percentage until resizing;
- domain;
- baseline monitoring.

Usage-driven costs:

- OpenAI tokens and realtime/audio/vision services;
- WhatsApp/communications provider fees;
- object and document storage;
- backup retention and egress;
- monitoring/log volume;
- email/SMS notifications;
- additional servers, managed database, or load balancer.

The first vertical scale is CX33 to CX43. The next reliability step is not a still
larger VPS: it is separating the database/backup failure domain and adding a second
application/tunnel replica. That should be triggered by measured load or an agreed
availability objective, not introduced during this minimum-change migration.

## 7. Risks and controls

| Risk | Impact | Required control |
|---|---|---|
| Database loss or inconsistent cutover | Critical | Tested dump/restore; one writer |
| Secrets copied into Git/images/logs | Critical | External secret files; rotation |
| Public PostgreSQL or API port | Critical | Firewall and private Docker network |
| Tunnel replicas using divergent databases | Critical | Short controlled overlap only |
| Missing timestamp/request logs | High | Structured persistent logs and request IDs |
| Provider or VPS outage | High | Monitoring, backup, documented rollback |
| ARM package incompatibility | Medium | Use x86 for first migration |
| Shared-vCPU contention | Medium | Observe latency and resize from measurements |
| Automatic updates causing restart | Medium | Maintenance window and health checks |
| Backup exists but restore fails | High | Scheduled restore rehearsal |
| Premium media growth fills disk | High | Disk alerts and external object storage |

## Final recommendation

Approve, when implementation is authorized, a parallel migration rehearsal to a
German **CX33-class x86 VPS (4 vCPU, 8 GB RAM, 80 GB SSD)** while retaining Cloudflare
Tunnel and `api.agmcockpit.com`.

Do not rebuild the APK and do not change API contracts. Treat API containerization,
secret hardening, private PostgreSQL networking, persistent logs, monitoring, and
tested backup/restore as mandatory deployment work.

Expected recurring infrastructure cost: **about EUR 12.72/month or EUR 152.64/year
including 19% VAT**, plus variable OpenAI usage and existing domain renewal.

Decision status: **migration applicable; implementation not started**.

## 8. Operational Migration and Continuity Protocol

Status: proposed control protocol; no automation or cutover has been activated

### 8.1 Non-negotiable operating rules

1. Exactly one environment is `PRIMARY/WRITABLE` at any time.
2. The standby environment must not accept production writes.
3. Starting the home PC, Docker, API, database, or tunnel never changes production
   routing automatically.
4. Cutover and rollback require explicit human approval and a recorded checklist.
5. A database backup is not accepted until a restore test succeeds.
6. Every operational action receives an incident/change ID, timestamp, operator, and
   result.
7. The RC4 APK and public API contract remain unchanged during the migration.

### 8.2 Roles and decision authority

Named individuals must be assigned before migration. Until then, the following role
names define responsibility:

| Role | Responsibility |
|---|---|
| Change Owner | Gives final GO/NO-GO approval and accepts service impact |
| Atlas / Technical Coordinator | Owns runbook, coordinates execution, records timeline |
| Infrastructure Operator | Executes VPS, Docker, database, tunnel, and routing actions |
| Inspector / Independent Validator | Verifies evidence and may block cutover |
| Application Validator | Tests Android/browser workflows on Wi-Fi and mobile data |
| Data Custodian | Approves backup, restore, migration, and reconciliation evidence |
| Primary On-call | Acknowledges alerts and starts incident procedure |
| Backup On-call | Receives escalated alerts when Primary On-call does not acknowledge |

One person may hold multiple roles for an early-stage project, but the person executing
the cutover should not be the only person validating it. The Change Owner is the only
role authorized to approve production cutover or rollback. The Infrastructure Operator
executes only after that approval is recorded.

### 8.3 Environment states

Each environment must display one of these states in the operational record:

| State | API/tunnel | Database writes | Intended use |
|---|---|---|---|
| `PRIMARY` | Publicly routed | Allowed | Current production |
| `VALIDATION` | Temporary hostname only | Test data only | Cloud pre-production |
| `STANDBY-COLD` | Stopped | Prohibited | Local recovery reserve |
| `STANDBY-READY` | Health-checkable privately | Prohibited/read-only | Verified recovery reserve |
| `RECOVERY-PENDING` | Private only | Prohibited | Rollback checks in progress |
| `RETIRED` | Stopped | Prohibited | No longer eligible for production |

During cloud validation:

- local environment remains `PRIMARY`;
- cloud environment remains `VALIDATION`;
- production DNS/tunnel must not distribute traffic between the two databases.

After cloud cutover:

- cloud becomes `PRIMARY`;
- local becomes `STANDBY-COLD` or `STANDBY-READY`;
- local production write credentials are disabled or withheld;
- local tunnel connector is stopped.

### 8.4 Cutover entry gates

The Change Owner may issue GO only when all conditions are evidenced:

- cloud API passes live and readiness checks continuously for at least 60 minutes;
- PostgreSQL backup and restore rehearsal completed successfully;
- schema and migration version match the approved release;
- automated API/security tests pass;
- real translations pass in all six RO/DE/EN directions;
- short and long text, OCR handoff, dictation, playback, and Email Assistant pass;
- Android tests pass on Wi-Fi and 4G/5G from at least two devices;
- restart/reboot recovery and persistent logging are demonstrated;
- monitoring and alert delivery are demonstrated;
- rollback rehearsal has been completed against non-production data;
- final backup checksum and database row-count controls are recorded;
- no unresolved critical or major incident exists;
- Inspector records independent PASS;
- Change Owner records GO with date and time.

Any failed mandatory gate produces NO-GO. It is not waived verbally.

### 8.5 Controlled cutover runbook

Target service interruption: 5-15 minutes.
Maximum authorized cutover window before automatic NO-GO decision: 30 minutes.

1. Atlas opens the change record and confirms all assigned roles are available.
2. Application Validator performs a final translation through the local production
   environment and records the result.
3. Infrastructure Operator enables maintenance/write freeze for server-side data.
   Basic translation may remain available only if it does not create database writes.
4. Data Custodian creates the final PostgreSQL dump, checksum, schema version, and
   row-count report.
5. Infrastructure Operator restores the final dump to cloud PostgreSQL.
6. Data Custodian verifies checksum evidence, schema version, and row counts.
7. Infrastructure Operator starts cloud API and verifies local cloud readiness.
8. Infrastructure Operator starts the cloud connector for the approved named tunnel.
9. Infrastructure Operator stops the local connector before normal production writes
   resume. Connector overlap must be limited to a controlled connectivity check.
10. Application Validator tests public health, one real translation, OCR-to-translation,
    Android mobile data, and browser access.
11. Inspector checks logs, request routing, database target, and absence of local writes.
12. Change Owner records ACCEPT or orders rollback.
13. If accepted, cloud is marked `PRIMARY` and local is marked `STANDBY-COLD` or
    `STANDBY-READY`.
14. Atlas starts the heightened monitoring window.

No endpoint change or APK rebuild is part of this runbook.

### 8.6 Post-cutover validation

Required observation windows:

- intensive: first 2 hours;
- heightened: first 24 hours;
- migration acceptance: after 72 hours without an unresolved major incident.

Checks:

- `/health/live` every minute;
- `/health/ready` every minute;
- controlled synthetic translation every 5-15 minutes, using non-personal test text;
- HTTP 5xx and translation-unavailable rate;
- p50/p95 translation latency;
- API/container/tunnel restarts;
- CPU, RAM, disk usage, database connections, and backup age;
- real Android tests on Wi-Fi and mobile data;
- verification that the local environment receives no production traffic or writes.

Synthetic translation frequency must be included in the OpenAI usage budget and
clearly identified in logs.

### 8.7 Rollback triggers

Rollback must be considered when any of the following occurs after cutover:

- public API unavailable continuously for 5 minutes;
- readiness fails continuously for 5 minutes;
- repeated translation failures exceed 20% across a 10-minute window, excluding a
  confirmed external OpenAI-wide incident;
- data corruption, missing records, wrong database target, or schema mismatch;
- suspected secret exposure or unauthorized access;
- cloud environment cannot recover after one controlled restart;
- monitoring, logs, or backups are unavailable during the acceptance window;
- a critical Android regression is reproduced on two devices or networks;
- Inspector or Data Custodian declares evidence integrity insufficient.

An isolated mobile-network failure on one device is investigated before rollback.
Rollback is not used to mask an OpenAI provider outage that would affect both origins.

### 8.8 Controlled rollback runbook

Target recovery time objective (RTO): 15 minutes after rollback approval.
Maximum operational target: 30 minutes.

1. Primary On-call opens or updates the incident record.
2. Atlas confirms the trigger and recommends rollback or continued diagnosis.
3. Change Owner records the rollback decision.
4. Infrastructure Operator blocks new cloud writes and stops the cloud tunnel connector.
5. Data Custodian determines whether production writes occurred after the last local
   synchronization.
6. If no writes occurred, local recovery proceeds from the previously verified state.
7. If writes occurred, Data Custodian exports and validates the cloud delta before the
   local database is made writable. No blind overwrite is permitted.
8. Infrastructure Operator starts the home PC if required, then verifies Docker,
   PostgreSQL, API, disk capacity, time synchronization, and local readiness.
9. Infrastructure Operator confirms the local database version and marks it writable
   only after Data Custodian approval.
10. Infrastructure Operator starts the local `cloudflared` connector.
11. Application Validator tests public readiness, real translation, OCR-to-translation,
    Android mobile data, and browser access.
12. Inspector confirms public traffic reaches only the local environment.
13. Change Owner records rollback ACCEPTED.
14. Cloud remains isolated and its logs/disks are preserved for incident analysis.

If data reconciliation cannot be completed safely within 30 minutes, the service
remains in controlled maintenance rather than enabling two writable databases.

### 8.9 Monitoring and alerting

Minimum monitored signals:

- public live/readiness endpoints;
- synthetic translation result and latency;
- tunnel connector state;
- API/container restart count;
- PostgreSQL availability, connections, disk, and backup age;
- host CPU, RAM, disk, and clock synchronization;
- certificate/DNS expiry where applicable;
- OpenAI error status, timeout, and spending threshold.

Minimum alert payload:

```text
Incident ID
Detected at (UTC and Europe/Berlin)
Environment and service
Severity
Observed symptom and duration
Last successful check
Required action
Primary responsible person
Acknowledgement deadline
Dashboard/runbook link
```

Initial severity and acknowledgement policy:

| Severity | Example | Acknowledge | Repeat | Escalate |
|---|---|---:|---:|---:|
| Critical | Public API down, data/security risk | 5 min | every 5 min | Backup On-call after 10 min |
| Major | Readiness/translation failure, repeated timeouts | 10 min | every 10 min | Backup On-call after 20 min |
| Minor | Resource warning, one failed backup attempt | 30 min | every 30 min | Backup On-call after 60 min |
| Info | Recovery, deployment, backup success | no page | once | none |

Delivery order:

1. email to Primary On-call and operational mailbox;
2. Turn Command Center incident notification;
3. optional SMS/push for Critical and unacknowledged Major alerts;
4. automatic escalation to Backup On-call.

An alert is acknowledged only when a named person records ownership and an action.
Opening an email is not acknowledgement. Recovery notifications do not automatically
close incidents; closure requires validation.

Turn Command Center integration is a future implementation item. Until it is approved
and tested independently, external email/SMS monitoring must not depend on the AGM API
it is monitoring.

### 8.10 Home standby and wake capability

Wake-on-LAN is suitable only inside the trusted home network. Wake-on-WAN is not
recommended for the first migration because it commonly requires router exposure,
vendor cloud access, or complex VPN routing and increases the attack surface.

Preferred recovery order:

1. manually power on the home PC;
2. secure VPN to the home router/network and trigger Wake-on-LAN;
3. only later assess a managed out-of-band device with strong authentication.

Required safeguards if remote wake is later approved:

- no public unauthenticated UDP port-forward for Wake-on-LAN;
- VPN with MFA and restricted administration accounts;
- firmware/router updates and audit logs;
- tested behavior after power loss;
- wake action generates an alert and change record;
- wake does not start the production tunnel automatically;
- operator completes all local health checks before routing is enabled.

### 8.11 Data synchronization and backup policy

For the first migration, use backup/restore and controlled final delta transfer. Do not
introduce bidirectional replication solely for the migration.

Minimum policy:

- encrypted daily logical PostgreSQL dump;
- provider backup according to the selected plan;
- pre-cutover and pre-rollback manual dumps;
- checksum, size, schema version, and completion timestamp recorded;
- retention proposal: 7 daily, 4 weekly, and 3 monthly logical backups;
- at least one backup copy outside the VPS failure domain;
- quarterly restore rehearsal initially, then monthly before major Premium releases;
- backup access restricted and logged;
- documented retention/deletion rules for personal data.

Provider snapshots/backups alone are not sufficient proof of database consistency.

### 8.12 Operational records

The following records are mandatory:

- migration change record;
- environment-state register;
- approval and role assignment;
- backup/restore evidence;
- cutover and rollback checklists;
- timestamped command/action timeline;
- monitoring and alert-delivery evidence;
- Android/browser validation report;
- incident and corrective-action report;
- final acceptance or rollback decision.

Logs must use synchronized UTC timestamps while reports also display Europe/Berlin
local time.

### 8.13 Protocol acceptance criteria

This protocol becomes operational only after:

- named people are assigned to every required role;
- alert channels and acknowledgement/escalation are tested;
- cloud and local runbooks are rehearsed with non-production data;
- RTO is demonstrated;
- one-writer protection is demonstrated;
- Inspector approves the evidence;
- Change Owner signs the protocol.

Protocol status: **complete as a proposal; not activated**.
