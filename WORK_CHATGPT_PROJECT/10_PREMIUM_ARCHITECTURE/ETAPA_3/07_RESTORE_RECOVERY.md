# Livrabil 7 — Restaurare și recovery

Implementare: `recovery.ts`

Restaurarea validează:

- schema și identitatea Trip;
- versiunea nenegativă;
- existența evenimentelor;
- ultimul eventId;
- continuitatea `previousEventId`;
- apartenența evenimentelor la același Trip.

O nepotrivire produce rezultat invalid. Funcția
`contextRequiringRecovery` activează flagul și crește versiunea fără a șterge
date.

Pre-departure restaurează în continuare sesiunea legacy pentru compatibilitate,
dar scrie toate snapshoturile ulterioare în TripContext. Eliminarea stocării
legacy va avea loc numai după demonstrarea parității și migrarea controlată.

Recovery nu finalizează, arhivează sau resetează automat cursa.
