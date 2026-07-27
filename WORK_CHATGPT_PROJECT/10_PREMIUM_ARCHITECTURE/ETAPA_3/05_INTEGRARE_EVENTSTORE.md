# Livrabil 5 — Integrarea contractuală cu EventStore

Implementare:

- `operational-event.ts`;
- `trip-context.service.ts`;
- `local-adapters.ts`.

Fiecare comandă aplicată produce `OperationalEventV1` cu:

- event/trip/operation/correlation ID;
- aggregate version și lifecycle;
- flags reale;
- actor, device și module;
- payload minim;
- retenție;
- stare sync și device sequence;
- legătura la evenimentul anterior.

Ordinea operației:

1. citește contextul;
2. validează tranziția;
3. construiește evenimentul;
4. append în EventStore;
5. enqueue în outbox;
6. salvează contextul cu expectedVersion.

Duplicate identice sunt idempotente. Același eventId cu alt conținut produce
`EVENT_ID_INTEGRITY_CONFLICT`.

EventStore-ul local este fundație de demonstrație. Schema backend din Etapa 2.2
nu a fost migrată și producția nu este afectată.
