# API-007 — Inventar interfețe G0

| Interfață | Direcție | Contract / responsabilitate |
|---|---|---|
| APP-011 | client → API | unlock, validate, change-pin |
| Prisma / PostgreSQL | API ↔ date | credential hash, failedAttempts, lockedUntil |
| JWT | API ↔ sesiune | scope `turn-admin`, expirare 900 secunde |
| bcrypt | API intern | verificare și rehash PIN |
| Nest Throttler | perimetru | maximum 5 cereri/minut pe controller |
| OPS-003 | API → monitorizare | evenimente de audit sigure, fără credențiale |

API-007 nu execută deployment și nu modifică autoritatea operațională OPS-004.

