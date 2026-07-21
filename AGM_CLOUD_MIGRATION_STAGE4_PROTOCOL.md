# AGM Cloud Migration - Stage 4 External Validation Protocol

Date opened: 2026-07-17
Status: PASS - OFFICIALLY CLOSED
Production cutover: PROHIBITED

## Objective

Expose the VPS validation API through a dedicated, temporary Cloudflare Tunnel and
hostname, then complete external functional tests without changing the production
hostname, tunnel, APK, database, or traffic.

## Fixed boundaries

```text
Local infrastructure role: PRIMARY
VPS role: VALIDATION
Production hostname: api.agmcockpit.com
Production tunnel: agm-api-production
Production changes allowed: none
Validation origin: http://127.0.0.1:3000
Public inbound VPS ports: none beyond existing SSH
```

The Stage 4 tunnel must be a new named tunnel. It must not reuse the production tunnel
credential. The validation hostname must be a new DNS name and must not replace or
modify `api.agmcockpit.com`.

## Proposed validation identifiers

```text
Tunnel name: agm-api-validation
Hostname: validation-api.agmcockpit.com
Origin: http://127.0.0.1:3000
```

These identifiers require explicit confirmation in the Cloudflare account before the
tunnel or DNS record is created.

## Gates

### Gate 4.1 - Cloudflare preparation

- confirm `agmcockpit.com` is the correct Cloudflare zone;
- confirm `validation-api.agmcockpit.com` is unused;
- create the new named tunnel `agm-api-validation`;
- route only the proposed validation hostname to the tunnel;
- transfer only the validation tunnel token or credential to the VPS;
- store the credential under `/etc/cloudflared`, owned by root and unreadable by other
  users;
- never place the credential in Git, shell history, reports, screenshots, or chat.

### Gate 4.2 - Connector activation

- configure the origin as `http://127.0.0.1:3000`;
- install a dedicated systemd service;
- start the connector and verify an active Cloudflare connection;
- confirm UFW still exposes no public HTTP or HTTPS port;
- confirm production DNS and the production connector are unchanged.

### Gate 4.3 - Technical external validation

- resolve the validation hostname through public DNS;
- validate the TLS certificate and HTTPS redirect behavior;
- validate `/api/v1/health/live`;
- validate `/api/v1/health/ready`;
- perform controlled RO-DE, DE-RO, EN-RO, and RO-EN translations;
- validate short and long text;
- validate expected error handling and rate limits;
- inspect API and tunnel logs for each request;
- measure median and p95 latency with a fixed request set;
- verify no validation request reached the local production backend.

### Gate 4.4 - Device validation

- browser test on Wi-Fi;
- browser test on 4G/5G with Wi-Fi disabled;
- Android test using a validation-only build or temporary diagnostic client;
- OCR to translation flow;
- dictation to translation flow;
- repeat tests from a location outside the home network;
- record device, network, time, expected result, actual result, and evidence.

The production APK must not be repointed during Stage 4.

### Gate 4.5 - Restart and rollback

- restart only the validation tunnel service and verify recovery;
- reboot the VPS and verify PostgreSQL, API, and tunnel recovery;
- disable the validation tunnel and confirm production remains operational;
- re-enable it and repeat readiness plus one real translation;
- document the exact rollback commands and measured recovery time.

## Stop conditions

Stop testing and disable the validation tunnel if any of these occurs:

- production DNS or traffic changes unexpectedly;
- the validation hostname resolves to the local production connector;
- PostgreSQL becomes publicly reachable;
- credentials appear in logs or source control;
- database writes occur in both primary and validation environments;
- repeated translation failures or data-integrity differences are observed;
- the rollback path cannot be completed as documented.

## Acceptance criteria

Stage 4 passes only when:

- the dedicated validation hostname is stable over HTTPS;
- all required functional tests pass externally;
- no production component was modified;
- restart and rollback tests pass;
- tunnel and API logs contain no unexplained errors;
- latency and resource measurements are documented;
- the project owner and inspector explicitly validate the evidence.

Passing Stage 4 authorizes only the preparation of a production cutover plan. It does
not authorize production DNS changes or traffic migration.
