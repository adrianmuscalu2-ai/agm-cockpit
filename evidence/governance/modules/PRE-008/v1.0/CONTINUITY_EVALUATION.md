# PRE-008 — Evaluare de continuitate

## Baseline protejat

- cele 9 stări lifecycle de la `DRAFT` la `ARCHIVED`;
- flags operaționale și blocarea tranzițiilor riscante;
- confirmări umane pentru ready/start/arrival/complete;
- `TripContext` și `OperationalEventV1` versionate;
- optimistic concurrency, event store și outbox local;
- maparea versionată către TransportJob;
- handoff-ul Pre-Departure și continuitatea After-Departure.

## Evoluție incrementală

Recovery validează suplimentar schema, stările și flags, unicitatea evenimentelor, versiunile consecutive, device sequence, identitatea agregatului și concordanța stării finale dintre event chain și snapshot.

Nu s-au schimbat lifecycle-ul, cheile locale, datele sau interfețele existente.

