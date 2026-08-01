# API-004 — Inventar interfețe G0

## API

- `POST /api/v1/transports`;
- `GET /api/v1/transports` și `GET /api/v1/transports/:id`;
- acțiuni: accept, arrive-pickup, complete-pickup, start-mission, arrive-delivery, complete-delivery, submit-documents, register-payment, close-transport și archive-transport.

Toate endpoint-urile necesită API-002 JWT și folosesc `RequestContext` cu `userId`, `companyId`, request ID și correlation ID.

## Dependențe și ieșiri

- DATA-001: TransportJob, LifecycleState, StateHistory, ValidationReport, AuditEvent și FinancialLedger;
- API-005: contractele pre-departure consumă transportul și starea lui;
- APP-012/APP-013: consumă fazele înainte și după plecare;
- API-006: audit și trasabilitate;
- OPS-003: detectarea și urmărirea incidentelor.

Citirile și mutațiile sunt filtrate pe `companyId`. Tranzițiile reușite sunt atomice și leagă validarea, auditul, istoricul și starea curentă.

