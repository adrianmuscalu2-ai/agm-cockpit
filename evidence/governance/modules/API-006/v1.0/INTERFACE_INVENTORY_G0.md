# API-006 — Inventar interfețe G0

| Interfață | Direcție | Responsabilitate |
|---|---|---|
| APP-010 | client ↔ API | captură, listare și reconciliere incidente; fără autovalidare |
| APP-011 | client ← API | vizibilitate și coordonare Turn |
| PostgreSQL / Prisma | API ↔ date | incidente, metadate dovezi, rapoarte și audit |
| AuditService | servicii → audit | before/after, actor, requestId și correlationId |
| TransportJob | API ↔ domeniu | validarea apartenenței transportului la companie |
| OPS-003 | API → monitorizare | starea incidentelor și trasabilitatea operațională |

Validation Reports rămâne serviciu intern; nu este expus un endpoint nou prin acest mandat.

