# AGM Production — Android CORS remediation report

Date: 2026-07-28  
Mandate: explicit server-side Android CORS remediation  
Server-side verdict: **PASS / REMEDIATED**

## Authorized change

The exact origin `https://localhost` was added to the existing
`CORS_ALLOWED_ORIGINS` value. No other environment line was changed.

Active origins:

1. `https://app.agmcockpit.com`
2. `https://agm-cockpit.pages.dev`
3. `https://localhost`

## Secret and integrity control

- Backup:
  `/opt/agm/change-backups/android-cors-20260728T153549Z`
- Environment owner/mode: `root:root / 0600`
- Environment SHA-256:
  `7c85adbec8ad1e4e5175dbfecc7be7bcc258e37b82c0e8d00bae6450f6d693f9`
- Manifest owner/mode: `root:root / 0600`
- Manifest SHA-256:
  `bf158b792e4a91e6e07506c8bbc8eb278f66f9de2361d660af6cef7364ae6d30`
- Manifest `env_sha256`: matches the environment file.
- No secret value was printed or included in evidence.

## Service action

Only `agm-production-api.service` was restarted.

- API unit: enabled / active
- API container: running / healthy
- Image ID:
  `sha256:b949e5dd986a4b654f4af8f58b891d714593f46ac84702e90dae623488e44a3e`
- OCI revision:
  `9956eb188fdd988bf0d7af93241c3c43962d9b39`
- PostgreSQL was not restarted.
- Production cloudflared was not restarted.

## CORS validation

Android origin:

- Origin: `https://localhost`
- Method: POST
- Preflight: HTTP 204
- `Access-Control-Allow-Origin: https://localhost`
- Functional POST: HTTP 201
- Provider: OpenAI
- Result returned: PASS

Browser origin:

- Origin: `https://app.agmcockpit.com`
- Preflight: HTTP 204
- Functional POST: HTTP 201
- Provider: OpenAI
- Result returned: PASS

Direct API:

- Romanian input: `Unde mergem`
- Provider: OpenAI
- Available: true
- Non-empty German translation returned.

## Log validation

- Successful OpenAI translation durations after restart: 3
- CORS errors: none detected
- OpenAI provider failures: none
- HTTP 401/403/404/5xx provider errors: none
- Prisma/database errors: none
- Migration state: `5 complete / 0 incomplete`

The three logged translations correspond to the controlled Android-origin, Browser-
origin, and direct API probes.

## Manual Android acceptance

Manual evidence captured at 17:40 confirms the physical Android application:

- displays the German translation `Morgen fahren wir ab.`;
- reports `Text tradus în Deutsch (de) prin agm-api.`;
- shows Internet, AI Copilot, and Traducere as available;
- runs the published AGM Cockpit 1.2.6 application.

Manual Android verdict: **PASS**.

## Conservation

- PostgreSQL: running / healthy, unchanged
- DNS: unchanged
- Cloudflare configuration: unchanged
- Production connector: active, unchanged
- Website: unchanged
- APK: not rebuilt, reinstalled, or modified
- PC fallback: unchanged

## Final verdict

**PASS / REMEDIATED / ANDROID VISUALLY CONFIRMED**
