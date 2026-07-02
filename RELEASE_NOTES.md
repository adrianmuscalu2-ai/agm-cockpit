# Release Notes

## v0.4.0 - Stable Backend Checkpoint

This release captures the current stable AGM backend state after Milestones 1 through 4.

## Completed Milestones

- Milestone 1: Authentication and initial transport creation/acceptance flow.
- Milestone 2: Transport lifecycle actions from imported through archived.
- Milestone 3: Evidence metadata API with transport linkage and audit traceability.
- Milestone 4: Incident management API with create, list, detail, resolve, and audit traceability.

## Implemented APIs

### Health

- `GET /api/v1/health`

### Authentication

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

### Transports

- `POST /api/v1/transports`
- `GET /api/v1/transports`
- `GET /api/v1/transports/{id}`

### Transport Lifecycle Actions

- `POST /api/v1/transports/{id}/actions/accept`
- `POST /api/v1/transports/{id}/actions/arrive-pickup`
- `POST /api/v1/transports/{id}/actions/complete-pickup`
- `POST /api/v1/transports/{id}/actions/start-mission`
- `POST /api/v1/transports/{id}/actions/arrive-delivery`
- `POST /api/v1/transports/{id}/actions/complete-delivery`
- `POST /api/v1/transports/{id}/actions/submit-documents`
- `POST /api/v1/transports/{id}/actions/register-payment`
- `POST /api/v1/transports/{id}/actions/close-transport`
- `POST /api/v1/transports/{id}/actions/archive-transport`

### Evidence Metadata

- `POST /api/v1/evidence`
- `GET /api/v1/evidence`
- `GET /api/v1/evidence/{id}`

### Incidents

- `POST /api/v1/incidents`
- `GET /api/v1/incidents`
- `GET /api/v1/incidents/{id}`
- `POST /api/v1/incidents/{id}/actions/resolve`

## Validation Status

All milestone APIs listed above have been validated with real HTTP requests against the local API.

Validated flows include:

- Seeded owner login.
- Authenticated current-user lookup.
- Transport creation and listing.
- Transport acceptance.
- Complete transport lifecycle:
  `Imported -> Accepted -> AtPickup -> PickupCompleted -> InTransport -> AtDelivery -> DeliveryCompleted -> DocumentsSubmitted -> Paid -> Closed -> Archived`.
- Evidence metadata creation, listing, detail lookup, and audit visibility through transport detail.
- Incident creation, listing, detail lookup, resolution, and audit visibility through transport detail.

Build validation:

- `corepack pnpm prisma generate`
- `corepack pnpm build`
- `corepack pnpm start`

Runtime validation uses `corepack pnpm start` from a clean build artifact state.

## Known Limitations

- No frontend application is included yet.
- No root route is defined for `/`; use `/api/v1/health`.
- `corepack pnpm dev` has shown unstable watch-build behavior on this Windows workspace; validation uses `corepack pnpm build` followed by `corepack pnpm start`.
- Evidence metadata stores references only; file upload/storage implementation is not included.
- Incident management records and resolves incidents, but does not yet alter the transport lifecycle state automatically.
- AI recommendation and human approval subsystems are not implemented yet.
- Seeded credentials and development secrets are local-development defaults.

## Next Milestone Recommendation

Milestone 5 should add the AI recommendation subsystem as a separate bounded module, preserving the existing transport, evidence, incident, audit, and validation-report architecture. Recommended initial endpoints:

- create AI recommendation linked to a transport
- list AI recommendations
- get AI recommendation by id
- record human review decision for an AI recommendation

The implementation should keep the current audit trail pattern and validate each new endpoint through real HTTP requests before commit.
