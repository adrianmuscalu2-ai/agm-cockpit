# APP-011 — Inventar interfețe G0

| Interfață | Direcție | Responsabilitate | Mod |
|---|---|---|---|
| OPS-003 | intrare | health, failure, recovery, incidente corelate | read-only |
| Incident Journal | intrare/coordonare | stare și trasabilitate incidente | control uman |
| Governance Register | intrare | module, roluri, stări și decizii | read-only |
| API-007 | delegare | autentificare și acțiuni administrative | în afara APP-011 |
| OPS-004 | delegare | release, deployment și rollback | mandat separat |
| Browser Shell | ieșire | randare, navigare și accesibilitate | UI |

APP-011 nu apelează direct API-uri operaționale din componenta de randare și nu scrie direct în persistența Browser.

