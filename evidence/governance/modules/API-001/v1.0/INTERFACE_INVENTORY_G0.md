# API-001 — Inventar interfețe G0

## Intrări

- variabile validate de mediu: `NODE_ENV`, `PORT`, `API_HOST`, `DATABASE_URL`, `OPENAI_API_KEY`, `CORS_ORIGINS`;
- cereri HTTP sub prefixul global `/api/v1`;
- probe de disponibilitate PostgreSQL și provider de traducere.

## Ieșiri

- `GET /api/v1/health/live` — stare proces API, fără probe de dependențe;
- `GET /api/v1/health/ready` — stare operațională și starea dependențelor obligatorii;
- răspunsuri HTTP protejate prin politica comună de securitate, validare și throttling.

## Consumatori și relații

- OPS-003 consumă endpoint-urile Health;
- OPS-004 folosește probele la gate-urile release/deployment/rollback;
- modulele API-002…API-007 utilizează bootstrap-ul și perimetrul HTTP comun;
- DATA-001 furnizează dependența PostgreSQL pentru readiness.

## Reguli

Liveness nu verifică dependențe externe. Readiness este pozitiv numai când PostgreSQL și providerul de traducere sunt disponibile. Răspunsurile nu expun secrete.

