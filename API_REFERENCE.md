# API Reference

## Base URL

```text
http://localhost:3000/api/v1
```

## Response Envelope

Most application responses use:

```json
{
  "data": {},
  "meta": {
    "requestId": "optional-request-id",
    "timestamp": "2026-07-02T17:33:11.873Z"
  }
}
```

## Authentication

### POST `/auth/login`

Logs in with the seeded or configured user credentials.

Request:

```json
{
  "email": "owner@agm.local",
  "password": "ChangeMe123!"
}
```

Success: `201 Created`

Response data:

```json
{
  "accessToken": "jwt-token",
  "user": {
    "id": "user-id",
    "companyId": "company-id",
    "displayName": "AGM Owner",
    "email": "owner@agm.local",
    "roles": ["company_owner"]
  }
}
```

### GET `/auth/me`

Returns the authenticated request context.

Headers:

```text
Authorization: Bearer <accessToken>
```

Success: `200 OK`

Response data:

```json
{
  "userId": "user-id",
  "companyId": "company-id",
  "roles": ["company_owner"],
  "requestId": "",
  "correlationId": ""
}
```

## Health

### GET `/health`

Returns API health.

Success: `200 OK`

Response data:

```json
{
  "status": "ok",
  "service": "agm-api"
}
```

## Transports

All transport routes require:

```text
Authorization: Bearer <accessToken>
```

Optional request tracking header:

```text
x-request-id: <uuid-or-client-request-id>
```

### POST `/transports`

Creates a transport in the `Imported` state.

Request:

```json
{
  "pickupAddressSnapshot": {
    "addressLine1": "Milestone Pickup",
    "city": "Berlin",
    "postalCode": "10115",
    "countryCode": "DE"
  },
  "deliveryAddressSnapshot": {
    "addressLine1": "Milestone Delivery",
    "city": "Munich",
    "postalCode": "80331",
    "countryCode": "DE"
  },
  "plannedPickupFrom": "2026-07-05T08:00:00.000Z",
  "plannedPickupTo": "2026-07-05T10:00:00.000Z",
  "plannedDeliveryAt": "2026-07-06T12:00:00.000Z",
  "paymentAmount": "1500.00",
  "currencyCode": "EUR"
}
```

Success: `201 Created`

Response data:

```json
{
  "transportId": "transport-id",
  "transportNumber": "AGM-2026-0001",
  "currentState": "Imported",
  "auditEventId": "audit-event-id"
}
```

### GET `/transports`

Lists transports for the authenticated company.

Success: `200 OK`

### GET `/transports/{id}`

Returns one transport with lifecycle state, state history, validation reports, audit events, and financial ledger entries.

Success: `200 OK`

## Lifecycle Actions

Lifecycle action endpoints return `201 Created` when the transition succeeds.

Generic action request body:

```json
{
  "reason": "Business reason or operator note"
}
```

Successful action response data:

```json
{
  "ok": true,
  "transportId": "transport-id",
  "previousState": "Imported",
  "currentState": "Accepted",
  "validationReport": {},
  "stateHistoryId": "state-history-id",
  "auditEventId": "audit-event-id"
}
```

### POST `/transports/{id}/actions/accept`

Allowed transition:

```text
Imported -> Accepted
```

### POST `/transports/{id}/actions/arrive-pickup`

Allowed transition:

```text
Accepted -> AtPickup
```

### POST `/transports/{id}/actions/complete-pickup`

Allowed transition:

```text
AtPickup -> PickupCompleted
```

### POST `/transports/{id}/actions/start-mission`

Allowed transition:

```text
PickupCompleted -> InTransport
```

### POST `/transports/{id}/actions/arrive-delivery`

Allowed transition:

```text
InTransport -> AtDelivery
```

### POST `/transports/{id}/actions/complete-delivery`

Allowed transition:

```text
AtDelivery -> DeliveryCompleted
```

### POST `/transports/{id}/actions/submit-documents`

Allowed transition:

```text
DeliveryCompleted -> DocumentsSubmitted
```

### POST `/transports/{id}/actions/register-payment`

Allowed transition:

```text
DocumentsSubmitted -> Paid
```

Request:

```json
{
  "amount": "1500.00",
  "currencyCode": "EUR",
  "occurredAt": "2026-07-07T09:30:00.000Z",
  "description": "Payment registered"
}
```

Additional successful response fields:

```json
{
  "financialLedgerEntryId": "ledger-entry-id",
  "ledgerNumber": "AGM-FIN-2026-0001"
}
```

### POST `/transports/{id}/actions/close-transport`

Allowed transition:

```text
Paid -> Closed
```

Close validation checks include delivery completion, required documents, financial ledger reconciliation, audit record presence, and currently not-applicable checks for evidence, incidents, AI recommendations, and additional human approvals.

### POST `/transports/{id}/actions/archive-transport`

Allowed transition:

```text
Closed -> Archived
```

The transport is also marked with `isArchived = true`.

## Validation Failures

When mandatory validation fails, the API returns `400 Bad Request` with a payload containing:

```json
{
  "code": "ACTION_VALIDATION_FAILED",
  "message": "Human-readable validation failure.",
  "validationReport": {},
  "auditEventId": "audit-event-id"
}
```
