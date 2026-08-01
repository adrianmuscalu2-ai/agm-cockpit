# AGM Gate 5 remediation status report

Date: 2026-07-28
Target: `agm-cloud-validation-01`
Verdict: **PASS / REMEDIATED**

## Completed

- Turn Command Center supplied Cloudflare One evidence that the account contains
  exactly two current, Healthy, locally managed tunnels:
  `agm-api-production` and `agm-api-validation-rotated-20260725`.
- Confirmed that migration to dashboard-managed tunnels is intentionally excluded
  because it is irreversible and outside Gate 5.
- Classified every Cloudflare tunnel credential evidenced locally.
- Designated tunnel `1c7d88b4-f2bb-40bb-82b0-37da35ee30a9` as the prepared official
  Production tunnel.
- Classified active tunnel `f4343acc-7303-4422-a10a-587a9dc96114` as Validation.
- Classified tunnel `1565882a-dcb3-4cd4-98f5-3118ca54a09a` as Legacy.
- Validated the prepared Production ingress configuration.
- Confirmed both public hostnames have valid TLS.
- Confirmed the Validation hostname remains active.
- Created a Production routing and rollback plan.
- Archived redacted effective-state evidence on the target.

## Evidence archive

`/opt/agm/change-backups/gate5-cloudflare-inventory-20260728`

Archive properties:

- owner/group/mode: `root:root / 0700`
- metadata SHA-256:
  `3b3707442415fdc95ecf965a74021e53ea0fedb0a5d1e3567d5b29d3b91ba3bc`
- journal evidence SHA-256:
  `22c9c6bbc29a40f5177db7aee017a4aebc774285a8822af2e3d8d18598069a74`
- manifest SHA-256:
  `0c6459b618b7df4a7168576ae109969495d18c548d6fed3de23c4365b610e1d9`

No token or connector secret was copied into the metadata report.

## Final completion rerun — 2026-07-28

The Cloudflare Dashboard evidence supplied by Turn Command Center shows exactly two
Healthy `cloudflared` tunnels:

- `agm-api-production`;
- `agm-api-validation-rotated-20260725`.

Dashboard does not expose hostname ingress for these locally managed tunnels and
offers only irreversible migration. Turn Command Center therefore designated the
local `cloudflared` state as the technical source of truth.

Read-only target verification established:

- `/etc/cloudflared/config-production.yml` contains tunnel
  `1c7d88b4-f2bb-40bb-82b0-37da35ee30a9` and hostname
  `api.agmcockpit.com`;
- `cloudflared tunnel ingress validate` returned `OK`;
- Production configuration SHA-256 is
  `a551b6c2c4444a850b33d64f0f5f7c8b9f28671d1bd73e8b91a444494c8418ea`;
- the active Validation unit uses `/etc/cloudflared/token`;
- the local connector journal identifies the rotated Validation tunnel as
  `f4343acc-7303-4422-a10a-587a9dc96114`;
- the connector journal records effective ingress
  `validation-api.agmcockpit.com` -> `http://127.0.0.1:3000`, with an HTTP 404
  fallback.

Combined with the two-name Dashboard inventory and the approved UUID
classification, this confirms:

- `api.agmcockpit.com` -> `agm-api-production`;
- `validation-api.agmcockpit.com` ->
  `agm-api-validation-rotated-20260725`.

## Final verdict

All Gate 5 evidence requirements are satisfied. Gate 5 is closed:
**PASS / REMEDIATED**.

## Annex — authenticated Cloudflare Dashboard evidence

Turn Command Center supplied read-only Dashboard screenshots confirming:

- exactly two tunnels are listed:
  `agm-api-production` and `agm-api-validation-rotated-20260725`;
- both tunnels are Healthy;
- both use the `cloudflared` locally managed model;
- the Dashboard exposes migration as the management transition and does not expose
  hostname ingress associations for these locally managed tunnels.

The screenshots are authoritative for account inventory, health and management type.
They are not presented as direct hostname-association evidence. The hostname
associations are established by the separately recorded local `cloudflared`
configuration and connector-journal evidence.

## Conservation

- No DNS record, tunnel, token, ingress rule or Cloudflare setting was changed.
- No service was restarted.
- API Production remained disabled/inactive.
- No deployment, image operation, database access or migration occurred.

No Dashboard migration, DNS update, tunnel modification, service restart or
deployment was performed.
