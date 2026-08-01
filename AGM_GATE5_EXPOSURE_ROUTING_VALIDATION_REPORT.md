# AGM Gate 5 exposure and routing validation report

Date: 2026-07-28
Target: `agm-cloud-validation-01`
Mode: Cloudflare, TLS and listener validation, read-only
Verdict: **FAIL / NOT READY — STOP at Gate 5**

## cloudflared service

- service: `cloudflared.service`
- enabled: yes
- active/running: yes
- unit:
  `/etc/systemd/system/cloudflared.service`
- startup mode:
  `cloudflared --no-autoupdate tunnel run --token-file /etc/cloudflared/token`

The token value was not read or displayed.

Protected Cloudflare files are owned by root and use mode `0600`, including the token,
credential JSON and local production configuration.

## Local production configuration

- file: `/etc/cloudflared/config-production.yml`
- owner/group/mode: `root:root / 0600`
- SHA-256:
  `a551b6c2c4444a850b33d64f0f5f7c8b9f28671d1bd73e8b91a444494c8418ea`
- configured tunnel ID:
  `1c7d88b4-f2bb-40bb-82b0-37da35ee30a9`
- Production rule:
  `api.agmcockpit.com` -> `http://127.0.0.1:3000`
- fallback rule: HTTP 404
- `cloudflared tunnel ingress validate`: PASS
- local rule test for Production hostname: matched rule 0
- local rule test for Validation hostname: matched fallback 404

No secret or credential JSON content was read.

## Blocking effective-state findings

### Local file is not the active authority

The systemd unit runs the tunnel using a token file and does not reference
`config-production.yml`.

The latest active tunnel starts recorded in the journal use tunnel ID:

`f4343acc-7303-4422-a10a-587a9dc96114`

This differs from the local configuration tunnel ID:

`1c7d88b4-f2bb-40bb-82b0-37da35ee30a9`

Therefore the valid local ingress file cannot be treated as proof of the effective
remote-managed Cloudflare routing.

### Validation hostname remains active

Read-only public health probes returned:

- `https://api.agmcockpit.com/api/v1/health/live`: HTTP 200
- `https://validation-api.agmcockpit.com/api/v1/health/live`: HTTP 200

The active Validation route violates the Gate 5 requirement that no route remain
active toward Validation or Legacy resources.

### Origin ambiguity

Current Hetzner listeners include:

- `127.0.0.1:3000`
- `127.0.0.1:5432`

The process behind port 3000 is the existing `cloud-api-1`, classified Validation.
The official `agm-production-api` is intentionally absent and inactive.

Consequently, any Hetzner tunnel rule targeting `127.0.0.1:3000` currently reaches
Validation, not the official Production API. Routing exclusively to Production cannot
be confirmed before the approved Production API exists and a controlled route switch
is authorized.

## TLS

Both public hostnames presented a currently valid certificate:

- subject: `CN=agmcockpit.com`
- issuer: Google Trust Services `WE1`
- validity: 2026-07-15 through 2026-10-13
- SHA-256 fingerprint:
  `47:84:86:14:DD:68:7B:54:2C:39:2E:9A:07:E3:57:FA:1E:39:64:0E:FE:6D:50:24:6F:84:05:A2:98:D5:03:90`

TLS validity does not resolve the origin and route-ownership nonconformities.

## Stop and conservation

- No DNS, Cloudflare dashboard, tunnel, token or ingress rule was changed.
- No service was restarted or reloaded.
- No API Production container was started.
- No deployment, image operation, database access or migration occurred.
- Temporary HTTP response bodies were deleted immediately.

## Required remediation

A separate Cloudflare remediation mandate must:

1. identify the active tunnel `f4343acc-7303-4422-a10a-587a9dc96114`;
2. export and archive its effective remote-managed ingress configuration without
   exposing credentials;
3. classify the tunnels `f4343acc...` and `1c7d88b4...`;
4. decide the approved Production tunnel;
5. remove or disable the Validation hostname route only in an approved change window;
6. ensure Production routing cannot be activated before `agm-production-api` is
   deployed and healthy;
7. preserve an exact rollback route;
8. rerun Gate 5 read-only after remediation.

