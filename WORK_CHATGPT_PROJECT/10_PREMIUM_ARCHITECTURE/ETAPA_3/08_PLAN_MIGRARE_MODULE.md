# Livrabil 8 — Planul de migrare al modulelor Premium

| Ordine | Modul | Acțiune |
|---:|---|---|
| 1 | Pre-departure | integrare inițială realizată; apoi înlocuire repository/outbox legacy |
| 2 | AI Governance | include tripId, actor, contextVersion în permit/audit |
| 3 | Context Analysis | request și findings legate de Trip/evidence |
| 4 | Linguistic Agents | proveniență și event emission |
| 5 | Copilot | misiuni prin TripContext + AI permit |
| 6 | Proactive Recommendations | open item/handoff comun |
| 7 | Load Safety | redesign controller/stări pe porturile comune |
| 8 | After-departure | evaluator pur sub lifecycle TRIP_ACTIVE/ARRIVAL |
| 9 | OCR/Documents | media/evidence canonic |
| 10 | Report/Journal | proiecții EventStore și archive gates |

## Migrarea Pre-departure

Faza curentă este dual-write controlat:

- contractul legacy rămâne operațional;
- TripContext primește lifecycle, flags, open items și confirmarea;
- resetarea nu afectează Trip;
- outbox-ul legacy și cel comun coexistă temporar.

Dual-write nu devine permanent. Eliminarea sa cere comparație de evenimente,
restore/offline PASS și plan de rollback.
