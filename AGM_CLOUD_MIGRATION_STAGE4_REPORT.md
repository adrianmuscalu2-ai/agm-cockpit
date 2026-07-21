# AGM Cloud Migration - Stage 4 External Validation Report

Date: 2026-07-17
Stage: 4 - Controlled external validation
Status: PASS - OFFICIALLY CLOSED
Production cutover: NOT STARTED

## Isolation

```text
Primary: local infrastructure
Validation: Hetzner VPS
Production tunnel: agm-api-production, unchanged
Validation tunnel: agm-api-validation
Production hostname: api.agmcockpit.com, unchanged
Validation hostname: validation-api.agmcockpit.com
Validation origin: http://127.0.0.1:3000
```

No production APK, DNS route, tunnel, database, or traffic destination was changed.

## External route

The dedicated validation route is:

```text
https://validation-api.agmcockpit.com
  -> Cloudflare Tunnel agm-api-validation
  -> http://127.0.0.1:3000
```

The root path returned `404 Cannot GET /`, which is expected because the API does not
define a root route. This response also confirmed end-to-end routing to the AGM API.
No artificial route was added.

## Official health endpoints

```text
GET /api/v1/health/live
status: ok
service: agm-api

GET /api/v1/health/ready
status: ready
database: available
translationProvider: configured
```

External readiness returned HTTP 200 through Cloudflare. HTTPS and HSTS were active.

## External translation

Request:

```text
Source: ro
Target: de
Text: Validare externa AGM Cloud fara trafic de productie.
```

Response:

```text
Text: Externe Validierung AGM Cloud ohne Produktionsverkehr.
Available: true
Provider: openai
```

## Production control check

The production readiness endpoint was queried in read-only mode and remained:

```text
status: ready
database: available
translationProvider: configured
```

This check did not change production configuration or traffic.

## VPS controls

```text
cloudflared service: enabled and active
cloudflared restarts: 0
cloudflared warnings: none in the inspected journal
API container: healthy
PostgreSQL container: healthy
UFW inbound: SSH only
API listener: 127.0.0.1:3000
PostgreSQL host listener: none
Public HTTP/HTTPS listeners: none
```

## Validation matrix

| Check | Result |
|---|---|
| Dedicated validation tunnel | PASS |
| Dedicated validation hostname | PASS |
| Public DNS resolution | PASS |
| HTTPS through Cloudflare | PASS |
| Expected root 404 reaches AGM API | PASS |
| Official live endpoint | PASS |
| Official readiness endpoint | PASS |
| Database dependency | PASS |
| Translation provider configuration | PASS |
| Real external RO-DE translation | PASS |
| Connector service health | PASS |
| Connector warning log | PASS |
| API remains localhost-only | PASS |
| PostgreSQL remains private | PASS |
| Production readiness remains healthy | PASS |
| Production configuration changed | NO |
| Production traffic migrated | NO |

## Decision

Technical result: **PASS**

Recommendation: **close Stage 4 officially**.

This result validates the separate external cloud route. It does not authorize
production cutover. Any production migration requires a separate approved stage,
complete device tests, a cutover window, monitoring, and a rehearsed rollback.

## Human validation

```text
Change Owner: AGM Project Owner
Inspector: AGM team
Decision: PASS - Stage 4 officially closed
Validated at: 2026-07-17
```
