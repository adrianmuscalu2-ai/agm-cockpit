# AGM Critical Operational Regression Investigation

Date: 2026-07-27  
Environment: Windows development/operations workstation, Docker Desktop/WSL2, local AGM API, Cloudflare Tunnel, Android client  
Mode: read-only diagnosis; no restart, infrastructure mutation, application change, or public deployment  
Status: **INCIDENT CONFIRMED — ROOT CAUSE DOMAIN IDENTIFIED**

## 1. Executive conclusion

The Android application is not exhibiting a general application failure. The observed
split between working local capabilities and failing AI/Translator/Turn capabilities
matches an intermittent loss of the shared backend path.

The primary infrastructure failure is confirmed in Docker Desktop logs:

- Docker's WSL backend repeatedly timed out;
- the engine reported `getting list of WSL2 integrated distros: ... context deadline exceeded`;
- Docker classified the condition as an unexpected error requiring closure/recovery;
- an internal Docker `_ping` remained blocked for approximately 3 hours and 23 minutes
  before returning an internal-server error on 2026-07-27 at approximately 12:32 local
  time.

AGM's public backend currently depends on this workstation:

1. PostgreSQL runs in Docker Desktop/WSL2;
2. `agm-api` runs as a Windows Node process, not as a container;
3. `cloudflared` exposes that local API publicly;
4. Android AI, translation, and Turn requests use the exposed API.

Therefore, a Docker/WSL stall removes or degrades the database dependency and the
backend path while navigation, camera, OCR, audio, and other local Android features
continue to operate.

At the time of the final snapshot, the system had recovered and both local and public
readiness returned HTTP 200. Eight consecutive real public translation requests also
succeeded. This is a recovery snapshot and does not invalidate the confirmed
intermittent outage.

## 2. Current topology and verified state

| Component | Deployment | Snapshot result |
|---|---|---|
| Android local modules | Device-local | Reported operational |
| `agm-api` | Windows Node process | Running; local/public readiness HTTP 200 |
| Primary PostgreSQL | Docker container `agm-postgres` | Running and healthy |
| Development PostgreSQL | Docker container `agm-development-postgres` | Running and healthy |
| Docker Desktop | WSL2 engine | Running at snapshot; confirmed earlier stall/crash |
| Public API connector | Windows `cloudflared` service/process | Running |
| Functional translation | Public POST through AGM API | 8/8 HTTP 201, 860–1336 ms |
| AGM service supervisor | Scheduled task/PowerShell loop | Running |
| AGM service monitor | Scheduled task/PowerShell | Stale/hung; not trustworthy |

There is no `agm-api` container in the active Docker inventory. Docker currently hosts
only the two PostgreSQL containers.

## 3. Confirmed evidence

### 3.1 Docker/WSL failure

Docker Desktop logs record:

- repeated engine and IPC `context deadline exceeded` errors;
- WSL bootstrap inability to reach the host backend socket;
- failure to shut down the VM within the deadline;
- `desktop proxies failed: getting list of WSL2 integrated distros`;
- an unexpected-error report and automated recovery attempt;
- a Docker API proxy `_ping` completing with internal-server error after about
  `3h23m3s`.

This is direct evidence for the user-observed Docker Desktop message and for a
multi-hour period in which Docker health probes could not reliably represent engine
availability.

### 3.2 Supervisor recovery history

`.tmp/services/supervisor.log` records several delayed recoveries:

- 2026-07-25: Docker did not become ready within the 180-second deadline and was
  retried repeatedly before recovery;
- 2026-07-26: Docker required approximately two minutes before recovery;
- 2026-07-27: Docker again exceeded the 180-second deadline, then recovered and the
  API became ready around 06:58 local time.

The supervisor can restart missing components, but it cannot make a stalled WSL/Docker
engine highly available.

### 3.3 Monitoring failure

The state file at `C:\ProgramData\AGM\monitor\state.json` was last updated at 07:47
local time, more than four hours before the final snapshot. The associated PowerShell
monitor process remained alive, and later scheduled invocations returned
`0x800710E0`. With `MultipleInstances=IgnoreNew`, a hung monitor prevents replacement
instances from performing new checks.

Consequences:

- operational state is stale;
- an outage may not generate a timely alert;
- a green/online historical state cannot be treated as current evidence;
- monitoring presently checks API readiness, not a real AI-provider transaction.

### 3.4 Public functional verification

During the investigation:

- local `/api/v1/health/ready`: HTTP 200;
- public `/api/v1/health/ready`: HTTP 200;
- database dependency: `available`;
- translation provider: `configured`;
- eight public translation POST requests: 8/8 HTTP 201.

The readiness response proves configuration and database access at probe time. It does
not itself prove end-to-end AI availability; the translation POST probes supply that
functional evidence for the snapshot.

## 4. Comparison with the known-good state

The integrity audit dated 2026-07-25 already recorded:

- the same Windows-hosted production path as operational;
- both PostgreSQL containers healthy;
- local and public API readiness passing;
- real public translation passing;
- `com.docker.service` stopped/manual as an autostart and reboot-resilience risk.

Infrastructure-related repository changes later on 2026-07-25 added:

- a two-minute recovery trigger for the persistent AGM supervisor;
- a scheduled email monitor;
- Browser checks in that monitor;
- explicit Compose environment-file selection.

No reviewed commit changed the Docker Desktop engine, WSL kernel, PostgreSQL image, or
Cloudflare tunnel architecture. The repository history therefore does not prove that
an application/configuration commit caused the Docker/WSL crash.

One post-baseline defect is nevertheless confirmed: the scheduled monitor introduced
in this period can remain hung indefinitely because its task has no explicit
unlimited/controlled execution policy and `IgnoreNew` suppresses subsequent probes.
This defect reduces detection and recovery visibility, but it is not sufficient to
explain the Docker WSL backend crash itself.

Application changes made after the stable audit are primarily Pre-departure, email,
Premium documentation/context, and currently uncommitted Android diagnostics and
translator health work. They do not explain why both Translator and Turn lose the
same network backend simultaneously.

## 5. Root-cause assessment

### Confirmed primary failure domain

**Docker Desktop/WSL2 backend stall and crash on the workstation hosting AGM
PostgreSQL.**

Confidence: high.

### Confirmed availability design weakness

**The public AGM API remains coupled to a developer workstation, Docker Desktop,
interactive Windows processes, and one Cloudflare connector.**

Confidence: high.

### Confirmed observability weakness

**The scheduled monitor is stale/hung and readiness checks do not perform real AI and
Turn synthetic transactions.**

Confidence: high.

### Not established

- No evidence currently proves PostgreSQL data corruption.
- No evidence currently proves an Android networking regression.
- No evidence currently proves that a particular Git commit caused WSL2 to fail.
- No evidence currently proves a Cloudflare Tunnel outage during the examined
  snapshot; the connector was running and public requests succeeded.

## 6. Recommended remediation order

### P0 — restore trustworthy operations

1. Capture Docker diagnostics before any reset or reinstall.
2. Repair the hung monitor lifecycle: bounded execution, forced termination after a
   safe timeout, and a watchdog that detects stale state.
3. Add synthetic probes for:
   - real translation;
   - AI-provider response;
   - an authenticated/non-destructive Turn validation route;
   - database access;
   - Cloudflare connector reachability.
4. Alert on monitor staleness independently of the monitor process itself.

### P1 — remove the single-workstation production dependency

1. Move the public API, PostgreSQL, and tunnel connector to the governed server
   environment.
2. Run API and database under service/container restart policies independent of an
   interactive Windows session.
3. Keep the workstation stack as development/validation only.
4. Define backup, restore, secret, and rollback procedures before cutover.

### P2 — harden the temporary Windows path

If migration cannot be immediate:

1. validate/update WSL and Docker Desktop only after diagnostics are preserved;
2. configure deterministic Windows service startup and recovery;
3. avoid repeated GUI launch attempts while a Docker backend process is already
   stalled;
4. separate liveness, readiness, and functional-provider health;
5. persist timestamped outage/recovery evidence outside ephemeral process logs.

## 7. Incident decision

**APPROVED FOR REMEDIATION WITH CONDITIONS**

Conditions:

- preserve database volumes and take a verified backup before Docker/WSL repair;
- do not use Docker factory reset as a first response;
- do not modify public deployment until a rollback-tested migration or repair plan is
  approved;
- treat the present green health snapshot as temporary recovery, not incident closure;
- close the incident only after sustained probes and an Android end-to-end validation
  cover AI Copilot, Translator, and Turn.

