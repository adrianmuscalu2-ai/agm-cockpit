# AGM-CHG-20260801-001 — Raport STOP pre-deployment

**Moment constatare:** 2026-08-01T06:36:00Z  
**Fază:** pre-change, înaintea primei mutații  
**Verdict inițial:** HOLD / DEPLOYMENT NOT EXECUTED  
**Remediere ulterioară:** PASS — vezi `REMEDIATION_REPORT.md`

## Cauză

Serviciul `agm-production-cloudflared.service` rulează din `/run/systemd/transient/`, nu dintr-o unitate persistentă aprobată sub `/etc/systemd/system/`. La reboot, ruta publică Production poate deveni indisponibilă, deși API-ul și baza ar reporni.

## Stare conservată

- API public live/ready: PASS;
- Browser public: PASS;
- API Hetzner: active/healthy;
- conector Hetzner: active, dar tranzitoriu;
- PostgreSQL Hetzner: healthy, writable, 5/0 migrații;
- PC fallback: păstrat read-only;
- backup timer Hetzner: enabled/active;
- artefact: digest/revision aprobate;
- modificări de servicii/date/rutare: zero;
- secrete accesate: zero.

## Condiție de reluare

Mandatul suplimentar a fost primit și remedierea a fost validată inclusiv prin reboot controlat. Cauza acestui STOP este închisă; revenirea la Gate PRE-CHANGE necesită verdictul Independent Validator.
