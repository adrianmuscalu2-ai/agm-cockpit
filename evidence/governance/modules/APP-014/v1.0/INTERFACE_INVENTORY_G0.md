# APP-014 — Inventar interfețe G0

## Producători

- APP-012 / Pre-departure outbox;
- APP-013 / After-departure journey handoff;
- Premium Operational Context / OperationalEventV1.

## Contract comun

Fiecare operație expune versiune, owner, `recordId`, `operationId`, `idempotencyKey`, `streamId`, sequence, payload, status, attempts, timestamp și queue position.

## Consumatori și servicii

- API-005 consumă sincronizarea pre-departure;
- adaptoarele de sync operațional consumă evenimentele în ordinea stream/sequence;
- OPS-003 primește incidentele de failure/conflict prin integrarea operațională;
- localStorage rămâne mecanismul existent al cozilor specializate.

APP-014 nu transmite singur date și nu introduce colectare sau telemetrie continuă.

