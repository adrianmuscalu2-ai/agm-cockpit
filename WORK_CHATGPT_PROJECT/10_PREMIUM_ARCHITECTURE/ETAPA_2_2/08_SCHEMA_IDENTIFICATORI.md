# Livrabil 8 — Schema identificatorilor unici

## Identificatori canonici

| Identificator | Format | Generator | Stabilitate |
|---|---|---|---|
| eventId | UUIDv7 | client/server emitent | permanent |
| tripId | UUID compatibil cu modelul canonic | creator Trip | permanent |
| aggregateId | UUID | creator agregat | permanent |
| operationId | UUIDv4/v7 | client înainte de comandă | păstrat la retry |
| correlationId | UUIDv7 | orchestrator | pentru întreg cazul de utilizare |
| causationId | eventId | emitent | eveniment părinte |
| deviceId | UUID stabil din storage sigur | aplicație/dispozitiv | până la reset autorizat |
| evidenceId | UUID + SHA-256 | Evidence service | permanent cât există metadata |
| exportId | UUIDv7 | Export service | permanent |

Prefixele precum `evt_`, `trip_` sau `exp_` sunt permise numai în afișare/export;
câmpul canonic rămâne UUID pentru compatibilitate cu PostgreSQL existent.

## Secvențe

- `deviceSequence`: număr monoton per device/archive local;
- `tripSequence`: număr monoton atribuit de server per Trip;
- `aggregateVersion`: optimistic concurrency per agregat;
- `eventVersion`: versiunea semantică a payloadului.

## Coliziuni și duplicate

Același `eventId` cu același hash este idempotent. Același `eventId` cu alt hash
este incident critic de integritate și activează `RECOVERY_REQUIRED`. Același
`operationId` nu poate produce două rezultate incompatibile.
