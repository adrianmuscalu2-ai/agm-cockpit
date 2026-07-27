# Livrabil 3 — Contractele porturilor transversale

Implementare: `ports.ts`

| Port | Contract |
|---|---|
| TripContextRepositoryPort | read active, optimistic save, protected clear |
| OperationalEventStorePort | append idempotent, read per Trip |
| OperationalOutboxPort | enqueue, pending, acknowledge, conflict |
| OperationalSyncPort | sync batch și rezultat ack/conflict |
| OperationalRecoveryPort | recover context din stare și evenimente |

`OperationalContextPorts` grupează repository, EventStore și outbox pentru o
tranzacție logică. Implementarea locală folosește namespace-ul
`agm.premium.*`; porturile nu depind de DOM, API sau modul.

Adaptorul server nu este implementat în Etapa 3 și nu este simulat. Evenimentele
rămân corect `pending`.
