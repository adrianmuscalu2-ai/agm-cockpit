# AGM-CHG-20260801-001 — Raport remediere Cloudflare persistent

**Mandat:** remediere exclusivă pre-deployment  
**Data:** 1 august 2026  
**Rezultat:** PASS

## Modificare autorizată

A fost creată și activată unitatea persistentă:

`/etc/systemd/system/agm-production-cloudflared.service`

ExecStart reproduce comanda tranzitorie validată:

`/usr/bin/cloudflared --no-autoupdate --config /etc/cloudflared/config-production.yml tunnel run`

Au fost adăugate numai integrarea `network-online`, autostartul `multi-user.target` și protecții systemd standard. Rutarea și configurația `/etc/cloudflared/config-production.yml` nu au fost modificate.

## Integritate

- config Production SHA-256 înainte/după: `a551b6c2c4444a850b33d64f0f5f7c8b9f28671d1bd73e8b91a444494c8418ea`;
- unitate persistentă SHA-256: `1ae8e7e7a8f0a10e65bc3f7561b7b2b031c64af664027da6a30dd6dfa697dec7`;
- backupul unității tranzitorii și al configurației a fost păstrat în `/opt/agm/change-backups/AGM-CHG-20260801-001/`;
- `cloudflared ... ingress validate`: OK;
- `systemd-analyze verify`: PASS.

## Validare înainte de reboot

- unitate: active / enabled;
- FragmentPath: `/etc/systemd/system/agm-production-cloudflared.service`;
- Docker/API/conector: active/enabled;
- patru conexiuni QUIC înregistrate;
- API live/ready și Browser: HTTP 200.

## Reboot controlat

- reboot autorizat și executat;
- host boot: `2026-08-01 06:43:26 UTC`;
- conector active la `06:43:44 UTC`, fără intervenție manuală;
- FragmentPath persistent confirmat;
- `NRestarts=0`;
- patru conexiuni QUIC înregistrate automat.

## Validare după reboot

- `agm-production-api`: healthy, localhost-only;
- `agm-postgres`: healthy, writable;
- migrații: 5 complete / 0 incomplete;
- PC fallback: read-only; Windows Cloudflared standby/stopped;
- cinci verificări consecutive live/ready: HTTP 200;
- Browser public: HTTP 200;
- modificări aplicație, date, rutare sau secrete: zero.

## Observație neblocantă

Cloudflared raportează ICMP proxy disabled din cauza `ping_group_range`. Tunelul HTTP/QUIC și cele patru conexiuni sunt funcționale; OPS-004 nu utilizează ICMP proxy.

Blocajul unității tranzitorii este eliminat.
