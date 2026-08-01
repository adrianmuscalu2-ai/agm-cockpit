# API-005 — Inventar interfețe G0

## API

- `POST /api/v1/pre-departure/sessions` — creare sau replay idempotent;
- `GET /api/v1/pre-departure/sessions/:id` — citire tenant-scoped;
- `PUT /api/v1/pre-departure/sessions/:id` — actualizare cu `expectedServerRevision`.

Toate endpoint-urile folosesc autentificarea API-002 și envelope/request ID API-001.

## Dependențe și consumatori

- DATA-001: PreDepartureSession și PreDepartureAnswer;
- API-004: verificarea ownership-ului TransportJob;
- API-006: context și trasabilitate;
- APP-012: producător și consumator principal al contractului;
- APP-014: coada offline/outbox pentru sincronizare;
- OPS-003: incidente și recovery.

## Erori contractuale

- payload invalid: `PRE_DEPARTURE_INVALID_PAYLOAD`;
- revizie concurentă: `PRE_DEPARTURE_REVISION_CONFLICT`;
- coliziune identitate idempotentă: `PRE_DEPARTURE_IDEMPOTENCY_CONFLICT`;
- resursă absentă/cross-tenant: not found sau transport indisponibil în compania autentificată.

