# AGM Gate 5 Cloudflare classification decision

Date: 2026-07-28
Scope: tunnels evidenced on `agm-cloud-validation-01`
State: **PASS / REMEDIATED — AUTHORITATIVE**

## Cloudflare One account inventory

Turn Command Center evidence dated 2026-07-28 confirms exactly two current tunnels:

| Tunnel name | Account state | Management mode |
|---|---|---|
| `agm-api-production` | Healthy | Locally managed |
| `agm-api-validation-rotated-20260725` | Healthy | Locally managed |

Migration to dashboard management is irreversible and is explicitly outside the
authorized validation scope.

## Tunnel classification

| Tunnel ID | Classification | State and evidence |
|---|---|---|
| `1c7d88b4-f2bb-40bb-82b0-37da35ee30a9` | **Production** | Official prepared Production tunnel; credential JSON and `config-production.yml` exist locally; not used by the active systemd connector |
| `f4343acc-7303-4422-a10a-587a9dc96114` | **Validation** | Current token-file connector; active in cloudflared journal; public Validation hostname returns HTTP 200 |
| `1565882a-dcb3-4cd4-98f5-3118ca54a09a` | **Legacy credential artifact** | Present only in two historical token backup files; not one of the two current account tunnels |

Temporary tunnels evidenced locally: none.

All three credentials belong to the same Cloudflare account, confirmed by matching
redacted account hashes. Connector secrets and account identifiers were not printed.

## Official Production source

The approved prepared Production routing source is:

`/etc/cloudflared/config-production.yml`

Identity:

- tunnel: `1c7d88b4-f2bb-40bb-82b0-37da35ee30a9`
- hostname: `api.agmcockpit.com`
- origin: `http://127.0.0.1:3000`
- fallback: HTTP 404
- owner/group/mode: `root:root / 0600`
- SHA-256:
  `a551b6c2c4444a850b33d64f0f5f7c8b9f28671d1bd73e8b91a444494c8418ea`
- local ingress validation: PASS

This source is prepared but inactive. It must not be activated before
`agm-production-api` is deployed and healthy.

## Effective active source

The active systemd connector uses:

`/etc/cloudflared/token`

Its tunnel is `f4343acc-7303-4422-a10a-587a9dc96114`, classified Validation. Its
effective ingress is remote-managed and was not exportable through the local
connector CLI.

## Final hostname association validation

The current account inventory is established by the Cloudflare One evidence supplied
by Turn Command Center. The Dashboard does not expose ingress hostnames for the
locally managed tunnels, so the approved local `cloudflared` state is the technical
source of truth.

Read-only evidence confirms:

- Production YAML maps `api.agmcockpit.com` to tunnel
  `1c7d88b4-f2bb-40bb-82b0-37da35ee30a9`; ingress validation returned `OK`;
- the active Validation connector journal identifies tunnel
  `f4343acc-7303-4422-a10a-587a9dc96114` and records effective ingress for
  `validation-api.agmcockpit.com`;
- the approved classification maps those UUIDs to `agm-api-production` and
  `agm-api-validation-rotated-20260725`, respectively.

Final associations:

- `api.agmcockpit.com` -> `agm-api-production`;
- `validation-api.agmcockpit.com` ->
  `agm-api-validation-rotated-20260725`.

Gate 5 is closed **PASS / REMEDIATED**. No Cloudflare, DNS, tunnel or Production
infrastructure setting was changed.
