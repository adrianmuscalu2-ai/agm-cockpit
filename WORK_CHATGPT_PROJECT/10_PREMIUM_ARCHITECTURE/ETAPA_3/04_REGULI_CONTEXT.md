# Livrabil 4 — Crearea, actualizarea și închiderea contextului

## Creare

- se restaurează contextul activ dacă există;
- altfel se creează un singur DRAFT;
- se emite `trip.context.created.v1`;
- contextul și evenimentul sunt salvate local;
- evenimentul intră în outbox.

## Actualizare

- numai prin `TripContextCommand`;
- lifecycle-ul respectă matricea canonică;
- confirmările sunt obligatorii pentru stările critice;
- `BLOCKED` oprește start/completed/archive;
- `RECOVERY_REQUIRED` oprește tranzițiile;
- `SYNC_PENDING` oprește arhivarea;
- fiecare schimbare crește `contextVersion` și emite eveniment.

## Închidere

`ARCHIVED` necesită `COMPLETED`, lipsa `SYNC_PENDING` și lipsa
`RECOVERY_REQUIRED`. `clearActive` cere tripId exact și nu este expus resetării UI.

## Resetare

Resetarea Pre-departure:

- este jurnalizată ca operație;
- marchează datele pending;
- șterge numai starea UI legacy;
- nu șterge TripContext, EventStore sau outbox.
