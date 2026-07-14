# Changelog

## Unreleased - P0 Legal Dialog Accessibility

### Branded

- Replaced the default Android launcher artwork with the AGM truck, globe, and AI-energy emblem across legacy, round, and adaptive icon densities.

### Fixed

- The first-run legal dialog stays above the mobile action bar, respects Android safe areas, scrolls its text independently, and keeps acceptance actions visible.

## v0.5.0 - 2026-07-14 - Android Stable Foundation

### Added

- Native Android speech recognition with runtime microphone permission handling.
- Native Android Text-to-Speech with RO / DE / EN locale validation.
- Voice dictation in Translator and Email Assistant.
- Local AGM PIN protection for Turn Command Center, including PIN rotation, 15-minute sessions, attempt limiting, and persistent bcrypt storage.
- Production Android API endpoint configuration for LAN testing.

### Changed

- API now binds explicitly to `0.0.0.0` and accepts the Capacitor origin.
- Android WebView permits the internal HTTP API used during LAN testing.
- Mobile cockpit actions, language selectors, translated-text area, safe-area spacing, and keyboard behavior were optimized for narrow Android devices.
- Turn Command Center was removed from ordinary-user navigation and moved behind the administrative PIN gate.

### Validated

- Translation, microphone permission, speech recognition, voice playback, OCR, Android API connectivity, cockpit stability, and mobile ergonomics were validated on a physical Android device.
- Web, API, Capacitor sync, Prisma migration, and debug APK builds pass.

### Stable Baseline

- This commit is the official stable foundation for the next AGM Android development cycle.

## Unreleased - AI Governance and Release Operations process

### Added

- `AI_GOVERNANCE.md` with official AGM rules for:
  - agent responsibilities;
  - recommendation lifecycle;
  - severity rules;
  - audit rules;
  - automation limits;
  - Basic / Premium / Backlog classification.
- `RELEASE_CHECKLIST.md` with the official release process for:
  - build;
  - testing;
  - validation;
  - APK;
  - Google Play;
  - security/privacy;
  - documentation;
  - archive.
- README and Roadmap links to governance and release documents.

### Notes

- This is a process and documentation stage.
- No runtime behavior, backend, API, OpenAI, authentication, or `.env` file was modified.

## Unreleased - AI and Agent Systems governance

### Added

- Official read-only Agent Registry in Turn Command Center.
- Unique agent identity, code, role, responsibilities, owner department, validation history, latest activity, and reliability status.
- Initial registry entries for:
  - Codex;
  - Inspector;
  - Mentor;
  - Legal Agent;
  - RO / DE Specialist;
  - RO / EN Specialist;
  - DE / EN Specialist.
- RO / DE / EN localization for the Agent Registry.

### Notes

- This implements the validated Inspector recommendation for AI & Agent Systems governance.
- The registry is read-only and does not execute operational decisions.
- No backend, API, OpenAI, `.env`, or authentication behavior was modified.

## Unreleased - AG-020 Frontend modularization

### Changed

- Extracted Turn Command Center rendering from `main.ts` into `turn-command-center.view.ts`.
- Preserved the existing Turn Command Center UX, alert system, Inspector reports, and read-only behavior.

### Validated

- `corepack pnpm --filter @agm/web build` passes after the extraction.

### Notes

- This is the first incremental frontend refactor step approved by Turn.
- No backend, API, OpenAI, `.env`, or user-facing behavior was modified.

## Unreleased - AG-019 Product and Roadmap organization

### Added

- Official `ROADMAP.md` for AGM development planning.
- Separate sections for:
  - AGM Basic Roadmap;
  - AGM Premium Roadmap;
  - AGM Future Backlog.
- Status legend and governance rule requiring every future feature to be classified as Basic, Premium, or Backlog before implementation.
- README link to the official roadmap.

### Notes

- This stage implements the validated Inspector recommendation for Product & Roadmap organization.
- No backend, API, OpenAI, `.env`, or application runtime logic was modified.

## Unreleased - AG-018 Platform consolidation

### Added

- Camera OCR translation in AGM Translator:
  - image capture / image selection;
  - OCR text detection;
  - translation through the existing Translator flow;
  - speech playback through the existing voice output;
  - copy action for the translated result;
  - local OCR history with image preview, extracted text, translated text, and timestamp.
- Android camera permission for the internal test APK.
- Local OCR adapter based on `tesseract.js`.
- Inspector Agent read-only foundation for Turn Command Center.
- Department status indicators in Turn Command Center:
  - OK;
  - Attention;
  - Error.
- Inspector reports with summary, issues, recommendations, last check, and trend.
- RO / DE / EN localization for OCR, Inspector, status indicators, legal camera notice, and OCR data management.
- Third-party notice for Tesseract.js.

### Changed

- Turn Command Center now displays Inspector health context for platform departments.
- Local data management now includes OCR history deletion.
- Reset all local data now also clears OCR history and OCR preview state.

### Architecture Decisions

- AG-018 validates the separation between AGM Basic and AGM Premium as independent architectural branches.
- Common rules, common standards, and common methodology remain shared across AGM branches.
- Each branch will have its own Inspector and audit mechanisms.
- Codex remains the technical convergence point for platform-level reporting to Turn.

### Validated

- `corepack pnpm --filter @agm/web build` passes.
- `corepack pnpm --filter @agm/web exec cap sync android` passes.
- `corepack pnpm --filter @agm/web android:apk` passes.
- Debug APK generated at `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`.

### Notes

- Backend, API, OpenAI integration, authentication, and `.env` were not modified.
- OCR is local for MVP. Future work may optimize language data packaging and performance without changing the local-first philosophy.

## Unreleased - AG-012.3 mandatory legal corrections

### Added

- Final Legal & Compliance frontend structure for Privacy Policy, Terms and Conditions, AI Transparency, microphone notice, Google Play Data Safety notes, Impressum/developer details, support, versioning, and third-party notices.
- First-run legal information screen with explicit acceptance for Privacy Policy, Terms, AI notice, and microphone notice.
- Legal acceptance versioning with `privacyPolicyVersion`, `termsVersion`, and `acceptedAt` saved locally.
- Data management controls for:
  - deleting local profile data;
  - deleting local contacts;
  - deleting local preferences;
  - deleting local legal acceptances;
  - resetting all AGM-managed local data.
- Open Source Licenses / Third Party Notices page.

### Changed

- External translation and microphone use now require current local legal acceptance before execution.
- Previous legal placeholders were replaced with operational legal-compliance content.

### Notes

- Backend, OpenAI integration, API contracts, authentication, and `.env` were not modified.
- No commit was created.

## Unreleased - AG-012 Legal & Compliance preparation

### Added

- Legal & Compliance frontend structure for:
  - Terms and Conditions placeholder;
  - Privacy Policy placeholder;
  - first-run test acceptance notice;
  - About app page;
  - visible application version;
  - support contact placeholder.
- Footer links for Legal & Compliance and About app.
- Local first-run test confirmation using `localStorage`.
- Profile compliance notices explaining that the Profile is optional and profile data remains local unless the user acts or consents.

### Changed

- E-mail Assistant signature edit action is disabled and marked as in development to avoid misleading users.
- E-mail Assistant `Send` button no longer shows the temporary visual suffix.
- English `Contact agenda` wording was updated to `Address Book`.

### Notes

- Legal text is not final and must be completed after the AG-012 legal audit.
- Backend, OpenAI translation integration, authentication, `.env`, and API behavior were not modified.

## Unreleased - AG-011-011 Text Corrector architecture

### Added

- AG-011-011 Text Corrector frontend module shell.
- Modular Text Corrector architecture with extension points for:
  - `AG-011-011A` RO / DE Specialist;
  - `AG-011-011B` RO / EN Specialist;
  - `AG-011-011C` DE / EN Specialist.
- Shared Text Corrector request/result contracts for future integration with Translator, MailMaster, and Document Assistant.
- Text Corrector route, navigation entry, command-panel actions, RO / DE / EN i18n keys, and responsive UI styling.
- Translator command-panel action `Corecteaza` / `Correct` / `Korrigieren` for the official AGM flow:
  - text entered in Translator;
  - source text corrected in place;
  - corrected text translated by the existing translation action.
- Controlled result handoff from `/corrector` back to Translator or MailMaster.

### Notes

- Current agent behavior is MVP-level and includes structural normalization, punctuation cleanup, duplicate-word cleanup, and a small local rule set per language.
- Full linguistic correction, grammar scoring, and AI provider integration remain pending a future functional validation.
- Backend, OpenAI integration, authentication, `.env`, Translator, MailMaster, and Contact Manager were not modified.

### Validated

- `corepack pnpm --filter @agm/web build` passes.

## Unreleased - Full i18n stabilization

### Changed

- Translator/Cockpit HUD labels now use the global RO / DE / EN i18n dictionary.
- Translator quick actions now use the global i18n dictionary.
- Translator runtime statuses for language selection, translation, microphone, speech output, clearing, and module navigation now use the global i18n dictionary.
- Translator preview placeholder now uses a module-specific localized fallback instead of the MailMaster preview text.
- Header, module navigation, command panel, Profile, E-mail Assistant, Contact Manager, Mail Security, and MailMaster generated text now use the global i18n dictionary.
- Preinstalled contact labels and e-mail template labels are resolved through i18n keys instead of hardcoded UI labels.
- Contact Manager validation now returns stable message keys, with UI localization handled at render time.
- MailMaster salutations, follow-up text, default manual text, attachment label, and closing formulas are resolved from the global i18n dictionary.

### Validated

- `corepack pnpm --filter @agm/web build` passes.
- Build checkpoints passed after audit, after Translator/Profile/MailMaster migration, and after contact/template cleanup.

### Notes

- Backend, OpenAI translation integration, API endpoints, authentication, and secrets were not modified.
- Remaining literal text in frontend source is limited to identifiers, route names, local fallback matching phrases, or business template content rather than UI labels.

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
