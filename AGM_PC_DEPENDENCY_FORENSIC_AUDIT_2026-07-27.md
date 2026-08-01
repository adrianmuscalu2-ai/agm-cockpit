# AGM PC Dependency Forensic Audit

Date: 2026-07-27  
Scope: Android APK endpoint inventory, production/validation routing, Git checkpoints,
Cloudflare connectors  
Mode: read-only; no build, restart, tunnel mutation, DNS change, or deployment  
Status: **DEPENDENCY CONFIRMED — PRODUCTION CUTOVER NOT FOUND**

## 1. Executive conclusion

The Android APK has not reverted to a LAN or localhost API endpoint. The two currently
published APK files are byte-identical and embed:

```text
https://api.agmcockpit.com/api/v1
```

The reappearing PC dependency is behind that public hostname:

```text
Android APK
  -> https://api.agmcockpit.com/api/v1
  -> Cloudflare named tunnel agm-api-production
  -> single active connector: windows_amd64
  -> http://127.0.0.1:3000 on the PC
  -> Windows Node AGM API
  -> PostgreSQL in Docker Desktop/WSL2 on the PC
```

A controlled public translation request produced a new line immediately in the local
PC API log. This proves that current public production traffic terminates at the PC.

Cloudflare tunnel inspection reported one active connector for
`agm-api-production`, with architecture `windows_amd64`. No Linux/VPS connector was
listed.

The VPS validation route is separately alive:

```text
https://validation-api.agmcockpit.com/api/v1/health/ready
```

It returned HTTP 200 during this audit, but it is not the endpoint compiled into the
APK.

## 2. Checkpoint comparison

No repository checkpoint was found that records a completed production cutover away
from the PC.

The relevant history records:

| Date/checkpoint | Recorded state |
|---|---|
| 2026-07-15, `e7db8c9` | APK moved from LAN HTTP to `api.agmcockpit.com`; the named production tunnel still required the PC API and Windows `cloudflared` |
| 2026-07-17, Cloud Migration Stages 2–4 | PC remained `PRIMARY`; VPS remained `VALIDATION`; production cutover explicitly not started |
| Stage 5 plan | Planning only; no DNS, tunnel, APK, database, or production-traffic change authorized |
| Stage 5A | Backup/logging validation only; production changes explicitly `none` |
| 2026-07-24 baseline `7670640` | Production APK base URL remained `https://api.agmcockpit.com/api/v1` |
| 2026-07-25 integrity audit | Local PC production path passed; validation VPS was audited separately |
| Current state | Production tunnel has a single Windows connector and origin `127.0.0.1:3000` |

The production environment value is identical at `e7db8c9`, the pre-Premium
checkpoint, Basic baseline `7670640`, and the current tree:

```text
VITE_AGM_API_BASE_URL=https://api.agmcockpit.com/api/v1
```

Therefore:

- no endpoint rollback is visible in Git;
- no cloud-to-PC fallback-priority inversion exists in the APK;
- the stable public hostname has hidden the fact that its origin remains the PC;
- the documented cloud migration created and validated a VPS environment but did not
  execute the production cutover.

The reported historical off-site behavior may still be genuine, but it is not backed
by a committed cutover record. Possible explanations requiring external historical
evidence are:

1. a temporary VPS connector was attached to the production tunnel and later removed;
2. Cloudflare DNS/tunnel routing was temporarily changed outside Git;
3. the PC/tunnel remained reachable during the earlier device test;
4. the device tested a different APK or route.

None of these possibilities is asserted as fact without Cloudflare audit history,
server journal evidence, or the exact earlier APK.

## 3. APK artifacts examined

| Artifact | SHA-256 | Size |
|---|---|---:|
| `AGM-Cockpit-Android.apk` | `C270161B6639ACA61534DF5C86F03ED0038F02B86EB9C08926C96B31A8D943F5` | 7,604,172 bytes |
| `AGM-Cockpit-Android-1.2.6.apk` | `C270161B6639ACA61534DF5C86F03ED0038F02B86EB9C08926C96B31A8D943F5` | 7,604,172 bytes |

The files are identical. ADB was unavailable on the workstation, so the package
installed on the physical phone could not be extracted and hashed. The conclusions
about the APK apply to the two locally published artifacts, not to an unverified
device package.

## 4. Endpoint inventory

### 4.1 Operational backend endpoints

All production backend endpoints below derive from:

```text
https://api.agmcockpit.com/api/v1
```

| Module | Endpoint |
|---|---|
| Translator | `POST /translation/actions/translate-text` |
| Translator functional health | `GET /translation/health` |
| API liveness | `GET /health/live` |
| API/database/provider readiness | `GET /health/ready` |
| Turn unlock | `POST /turn-admin/unlock` |
| Turn session validation | `POST /turn-admin/validate` |
| Turn PIN change | `POST /turn-admin/change-pin` |
| Pre-departure create/sync | `POST /pre-departure/sessions` |
| Pre-departure update/sync | `PUT /pre-departure/sessions/{serverSessionId}` |
| Ladungssicherung analysis | `POST /premium/ladungssicherung/analyze` |
| Ladungssicherung field test | `POST /premium/ladungssicherung/field-test` |
| Securing recommendation | `POST /premium/ladungssicherung/recommendation` |

There is no cloud-first/local-second selection mechanism for these requests.
Production builds receive one base URL at Vite build time.

### 4.2 Public UI/monitoring endpoints embedded in the bundle

The bundle also contains:

- `https://app.agmcockpit.com/`;
- `https://app.agmcockpit.com/turn`;
- `https://app.agmcockpit.com/email`;
- `https://agm-cockpit.pages.dev/`.

Turn operational monitoring polls the public API live/ready routes and the public
frontend.

### 4.3 Local addresses present in the bundle

Strings for the following local development/audit targets are present:

- `http://127.0.0.1:3000`;
- `http://127.0.0.1:5173`;
- `http://127.0.0.1:4321`;
- localhost variants for Browser/Turn/Email.

These originate from development proxy configuration and Turn audit/monitoring target
metadata. They are not the production base URL used by Translator, Turn authentication,
Pre-departure sync, or Premium API calls.

On Android, local monitoring targets would refer to the phone itself and should not be
used as production health evidence.

## 5. Routing proof

At 2026-07-27 12:46 local time:

1. a unique translation request was sent to the public production hostname;
2. the public response was HTTP 201;
3. the PC's `.tmp/services/api.stdout.log` gained exactly one new translation-duration
   line during the same probe;
4. Cloudflare tunnel inspection showed one `windows_amd64` production connector;
5. the Windows service configuration routed `api.agmcockpit.com` to
   `http://127.0.0.1:3000`.

This establishes the current production path without stopping any service.

## 6. Findings against the six requested hypotheses

| Hypothesis | Result |
|---|---|
| APK reverted to local/LAN | **NOT CONFIRMED** — published APK uses public HTTPS |
| Backend uses PC address again | **CONFIRMED AT ORIGIN** — public tunnel origin is PC localhost |
| Required tunnel/proxy runs only on PC | **CONFIRMED** — one Windows production connector |
| Cloud deployment inactive/not primary | **CONFIRMED FOR PRODUCTION** — VPS validation is active, but not primary |
| Stable cloud configuration replaced | **NO COMMITTED STABLE PRODUCTION CUTOVER FOUND** |
| Fallback priority inverted | **NOT PRESENT** — one build-time API base URL, no cloud/local priority list |

## 7. Required evidence before remediation

To determine whether an unrecorded production cutover existed temporarily, preserve
and compare:

1. Cloudflare Zero Trust audit events and tunnel connector history;
2. DNS change history for `api.agmcockpit.com`;
3. VPS `cloudflared`, API, and systemd journals for the claimed PC-off test window;
4. the SHA-256 and embedded endpoint of the exact APK installed during that test;
5. any Stage 5C GO or Stage 5D cutover record held outside the repository.

## 8. Decision

**INCIDENT CONFIRMED: PRODUCTION REMAINS DEPENDENT ON THE PC**

This audit does not support the narrower claim that the APK endpoint was reverted by
the 2026-07-25 audit. It supports a more precise conclusion: the public hostname used
by the APK currently routes to the PC, while the independently running VPS is only on
the validation hostname. Repository evidence says production cutover was never
officially executed.

No routing or deployment change is authorized by this report.

