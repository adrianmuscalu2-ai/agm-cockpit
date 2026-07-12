# Changelog

## Stable checkpoint - 2026-07-12

Project state saved for restart in the next working session.

### Added

- One Click Startup scripts for AGM local development:
  - `Start_AGM.bat`
  - `scripts/Start-AGM.ps1`
- MailMaster Basic local module:
  - manual recipient entry;
  - professional templates;
  - message tone selector;
  - local preview before sending;
  - local Mail Security gate for blocked real sending.
- AG-016 Contact Manager foundation:
  - add, edit, delete, search, select contact;
  - localStorage persistence;
  - integration with MailMaster recipient flow.
- Global i18n infrastructure for RO / DE / EN:
  - shared dictionary;
  - single UI language source from Profile;
  - immediate re-render after Profile language changes.
- PWA / mobile preparation files for the web app.

### Changed

- MailMaster now uses one shared generator for greeting and closing formulas.
- MailMaster direct and translated flows now use the same preview composition logic.
- Sender contact details are displayed only in the preview header.
- Real e-mail and WhatsApp sending remain blocked until security validation.
- Development Service Worker handling was adjusted to reduce stale-cache influence.

### Validated

- `pnpm --filter @agm/web build` passes.
- MailMaster preview no longer duplicates greeting, body, closing, name, or signature.
- Profile language is persisted through localStorage.
- Global i18n dictionary returns expected German and English labels for MailMaster.
- No credentials, tokens, external APIs, SMTP, IMAP, Gmail, Outlook, or WhatsApp sending were activated.

### Known Limitations

- A few UI texts remain hardcoded in Romanian, especially in the Translator/Profile/Cockpit auxiliary labels and placeholders.
- Full RO / DE / EN localization cleanup continues in the next session.
- Final browser validation still requires manual hard refresh / Service Worker unregister if an older cached build is present.

### Status

- Project marked as stable for pause and later continuation.

## v0.1.0 - 2026-07-02

Frozen checkpoint for AGM Milestone 1 and Milestone 2.

### Added

- Initial NestJS API application for AGM.
- PostgreSQL service definition through Docker Compose.
- Prisma schema and initial migration for the AGM domain model.
- Seed data for the default AGM company, owner user, owner role, and lifecycle states.
- JWT authentication endpoints:
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me`
- Transport endpoints:
  - `POST /api/v1/transports`
  - `GET /api/v1/transports`
  - `GET /api/v1/transports/{id}`
- Transport lifecycle action endpoints:
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
- Audit event creation for transport business actions.
- Business validation report creation for lifecycle transitions.
- Transport state history creation for successful lifecycle transitions.
- Financial ledger entry creation for registered payments.

### Validated

- Milestone 1 endpoints passed real HTTP verification against the local API.
- A transport was created and accepted successfully.
- Milestone 2 lifecycle actions passed real HTTP verification end to end.
- Full validated lifecycle:
  `Imported -> Accepted -> AtPickup -> PickupCompleted -> InTransport -> AtDelivery -> DeliveryCompleted -> DocumentsSubmitted -> Paid -> Closed -> Archived`.
- Final lifecycle validation produced:
  - `finalState = Archived`
  - `isArchived = true`
  - `historyCount = 10`
  - `validationReportCount = 10`
  - `auditEventCount = 11`
  - `ledgerCount = 1`

### Known Limitations

- There is no root route for `/`; the API root returns `404 Cannot GET /`.
- The current checkpoint exposes the backend API only; no UI is included.
- Evidence upload, incident records, AI recommendations, and additional human approval workflows are represented as validation checks where applicable, but are not implemented as runtime subsystems in v0.1.0.
- The development seed creates local credentials intended for development only.
