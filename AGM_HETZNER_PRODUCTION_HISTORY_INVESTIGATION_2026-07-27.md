# AGM Hetzner Production History Investigation

Date: 2026-07-27  
Scope: operational Cloudflare/Hetzner history outside Git  
Mode: read-only; no DNS, tunnel, server, service, or deployment mutation  
Status: **PARTIALLY VERIFIED — EXTERNAL AUDIT ACCESS REQUIRED**

## 1. Question under investigation

Was the Hetzner VPS previously the real origin for
`api.agmcockpit.com`, and if so, when and why did production return to the Windows PC?

## 2. Facts verified from live infrastructure

### Production tunnel

```text
Name: agm-api-production
Created: 2026-07-15 17:07:23 UTC
Current active connector architecture: windows_amd64
Current connector start: 2026-07-25 16:19:17 UTC
Current active connectors: one connector identity, four Cloudflare edge connections
Current origin configured on Windows: http://127.0.0.1:3000
```

`--show-recently-disconnected` did not return an additional Linux/VPS connector for
the production tunnel.

### Hetzner validation tunnel

```text
Name: agm-api-validation-rotated-20260725
Created: 2026-07-25 14:47:13 UTC
Current active connector architecture: linux_amd64
Current connector start: 2026-07-25 14:52:49 UTC
Current active connectors: one connector identity, four Cloudflare edge connections
```

The validation endpoint returned HTTP 200 with:

- API status `ready`;
- database `available`;
- translation provider `configured`.

This proves that API, PostgreSQL access, and `cloudflared` are currently active on the
Hetzner validation runtime.

### Current production request path

A unique request to `api.agmcockpit.com` created exactly one new line in the Windows
PC's local AGM API log. Current production traffic therefore terminates at the PC.

## 3. Reconstructed chronology

| Time UTC | Event supported by evidence |
|---|---|
| 2026-07-15 17:07 | Production named tunnel created |
| 2026-07-15 17:08 | Local production configuration recorded with origin `127.0.0.1:3000` |
| 2026-07-17 | Hetzner validation API, PostgreSQL, tunnel and backup work documented as active; production cutover prohibited/not started |
| 2026-07-25 14:47 | Rotated Hetzner validation tunnel created during incident audit |
| 2026-07-25 14:52 | Current Linux/Hetzner validation connector started |
| 2026-07-25 16:19 | Current Windows production connector started |
| 2026-07-27 | Both connectors remain active on separate tunnels; production hostname reaches Windows |

This sequence shows that the VPS runtime was restored before the current Windows
production connector started. It does not by itself prove which tunnel or DNS record
served `api.agmcockpit.com` before 2026-07-25 16:19 UTC.

## 4. Checks completed against the request

| Requested check | Result |
|---|---|
| Cloudflare Tunnel inventory | Completed for current and recently disconnected connectors |
| Current production connector | Confirmed Windows |
| Current Hetzner connector | Confirmed Linux on separate validation tunnel |
| Current Hetzner API/database | Confirmed ready/available through validation hostname |
| Production request destination | Confirmed local Windows API |
| Cloudflare audit-history events | Not accessible with the local tunnel certificate/CLI |
| Cloudflare DNS change history | Not accessible without dashboard/API audit permission |
| Historical Hetzner journals | Not accessible; available SSH key is rejected by the VPS |
| Historical systemd/Docker state | Not accessible for the same SSH reason |
| Exact earlier installed APK | Not accessible; ADB is unavailable |

## 5. What can and cannot be concluded

### Confirmed

1. Two independent runtimes exist now:
   - production tunnel to Windows;
   - validation tunnel to Hetzner.
2. The Hetzner validation runtime has an active API and database dependency.
3. The current production tunnel connector was established during the 25 July audit
   window.
4. Current production traffic reaches the Windows API.
5. The Cloudflare tunnel CLI shows no recently disconnected Linux connector on
   `agm-api-production`.

### Not yet proven

1. Whether an older Linux connector was attached to `agm-api-production` outside the
   CLI's recent-disconnection retention window.
2. Whether `api.agmcockpit.com` was temporarily routed to the validation tunnel or
   another VPS tunnel through a DNS/hostname route change.
3. Whether a production API/database service existed on Hetzner under another unit,
   container, hostname, or credential.
4. Which administrative action at 16:19 UTC caused or accompanied the Windows
   production connector's current session.
5. Whether the test described as “PC off” used the same APK/hash and same production
   hostname.

The existing evidence is consistent with two possible histories:

- production always remained on the PC, while Hetzner served only validation; or
- an unrecorded Cloudflare hostname/tunnel change temporarily served production from
  Hetzner and was reverted during incident recovery.

Choosing between these histories without Cloudflare audit events or VPS journals would
be speculation.

## 6. Evidence required for a definitive answer

### Cloudflare

Read-only access is required to:

1. Zero Trust / account audit logs for 2026-07-22 through 2026-07-26;
2. DNS record history for `api.agmcockpit.com`;
3. tunnel-route and public-hostname change history;
4. connector history for tunnel ID
   `1c7d88b4-f2bb-40bb-82b0-37da35ee30a9`;
5. actions involving the production and rotated validation tunnel IDs.

Relevant event types include create/update/delete route, DNS record update, tunnel
token rotation, connector registration, service install and tunnel deletion.

### Hetzner VPS

Read-only SSH access is required for:

```text
journalctl --since "2026-07-22" --until "2026-07-27"
systemctl list-unit-files
systemctl status cloudflared
systemctl status docker
docker ps -a
docker inspect <api/database containers>
docker events --since ...
last -x
```

The inspection must also read unit creation/modification timestamps, Compose files,
container start times, restart counts, API access logs, Cloudflare connector logs and
PostgreSQL startup/recovery events without printing secrets.

## 7. Current decision

**HETZNER PRODUCTION ORIGIN: NOT YET PROVEN OR DISPROVEN**

**CURRENT WINDOWS PRODUCTION ORIGIN: PROVEN**

The investigation cannot be closed as “production was never on Hetzner” merely because
Git lacks a cutover record. Conversely, the historical device behavior alone cannot
establish a specific DNS/tunnel change.

Definitive closure requires either:

- an authenticated Cloudflare audit-history export; or
- restored read-only VPS access plus matching tunnel/DNS evidence.

