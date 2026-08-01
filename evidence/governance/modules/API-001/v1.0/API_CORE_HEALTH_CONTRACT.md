# API-001 — Contract API Core & Health v1

**Contract:** `api-core-health.v1`  
**Serviciu:** `agm-api`

## Perimetru HTTP

- prefix global: `/api/v1`;
- port implicit: `3000`;
- host implicit non-Production: `0.0.0.0`;
- host Production validat: `127.0.0.1`;
- Helmet activ;
- CORS strict, bazat pe allowlist;
- payload-uri validate cu whitelist și respingerea proprietăților necunoscute;
- throttling implicit: 100 cereri / 60 secunde.

## Health

- `health/live`: confirmă exclusiv că procesul API răspunde;
- `health/ready`: verifică PostgreSQL și providerul de traducere;
- o dependență obligatorie indisponibilă produce `503 not_ready`;
- incidentele și recovery-ul sunt preluate de OPS-003, nu închise automat de API-001.

## Failure / recovery

- eșec bootstrap sau mediu invalid: procesul nu devine ready;
- DB indisponibilă: `ready = 503`, cu DB marcată indisponibilă;
- provider lipsă: `ready = 503`, cu providerul marcat indisponibil;
- după recuperarea dependențelor, `ready = 200`; ciclul incidentului rămâne guvernat de OPS-003.

## NO-GO

- liveness dependent de DB sau AI;
- readiness pozitiv cu o dependență obligatorie indisponibilă;
- CORS permisiv necontrolat în Production;
- ocolirea validării mediului sau a payload-urilor;
- expunerea secretelor ori a detaliilor sensibile în Health.

