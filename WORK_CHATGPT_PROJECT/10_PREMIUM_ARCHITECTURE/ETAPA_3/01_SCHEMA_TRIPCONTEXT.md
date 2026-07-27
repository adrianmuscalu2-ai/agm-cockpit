# Livrabil 1 — Schema canonică TripContext

Implementare: `apps/web/src/premium-operational-context/trip-context.types.ts`

`TripContext v1` conține:

- `tripId`, `contextVersion`, schema și timp;
- lifecycle Premium canonic;
- flagurile `BLOCKED`, `INCIDENT_OPEN`, `SYNC_PENDING`, `OFFLINE`,
  `RECOVERY_REQUIRED`;
- legătura opțională cu TransportJob și versiunea mapării;
- starea șoferului, vehiculului, remorcii și încărcăturii;
- open items tipizate și destinația transferului;
- rezultate transferate;
- ID-urile confirmărilor;
- ultimul eveniment și ultima versiune server.

O singură înregistrare este activă în adaptorul local. Salvarea folosește
`expectedVersion`; o versiune divergentă produce
`TRIP_CONTEXT_VERSION_CONFLICT`.

Modulele consumă `TripContextSnapshot` și trimit comenzi prin serviciul comun. Nu
modifică direct obiectul și nu creează stări globale paralele.
