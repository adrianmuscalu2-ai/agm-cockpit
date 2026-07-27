# Livrabil 6 — Offline, outbox, sincronizare și reconciliere

## Implementat

- fiecare eveniment este enqueue idempotent;
- pending events sunt citite per Trip;
- acknowledge elimină numai evenimentul confirmat;
- conflictul păstrează evenimentul și marchează `sync.status=conflict`;
- Pre-departure activează `OFFLINE` pe baza conectivității curente;
- orice modificare locală activează `SYNC_PENDING`;
- retry păstrează eventId/operationId.

## Deliberat neimplementat

- transportul comun către server;
- schema fizică backend EventStore;
- reconcilierea automată a câmpurilor;
- eliminarea `SYNC_PENDING` pe ack server;
- health UI comun.

Aceste elemente necesită adaptorul server și checkpoint propriu. Până atunci UI-ul
nu poate declara sincronizare confirmată.

## Regula de reconciliere

Versiunile divergente, duplicatele neidentice și conflictele de lifecycle,
confirmare sau incident activează `RECOVERY_REQUIRED`; nu se aplică
last-write-wins.
