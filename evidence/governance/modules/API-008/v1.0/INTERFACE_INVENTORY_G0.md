# API-008 — Inventar interfețe

| Interfață | Direcție | Contract |
|---|---|---|
| PRE-007 Client | PRE-007 ↔ API-008 | multipart analyze/recommendation/field-test |
| APP-015 Platform | cameră/fișier → API-008 | JPEG/PNG/WEBP, 8 MB |
| AI Provider | API-008 → OpenAI | numai cu secret, timeout și JSON Schema strict |
| PRE-008 TripContext | API-008 → PRE-007/PRE-008 | rezultat orientativ; fără mutație directă |
| OPS-003 Monitoring | API-008 → health/incidents | unavailable și erori sanitizate |
| API-001 Core | API-001 → API-008 | envelope, throttling și runtime NestJS |

Nu există interfață de persistență cu DATA-001 în baseline-ul API-008 v1.0.

