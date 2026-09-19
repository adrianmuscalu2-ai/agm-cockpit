# Phase 2D gate — Car Mover and full cross-domain resolution

Date: 2026-09-19
Baseline: `faf77e175365b815a2f9f4f5ec184ae8b8df02b9`
Target branch: `fix/personal-contact-name-first-v150`
Production deploy: not triggered
Push: not performed

## Implemented control path

`REQUEST -> GLOBAL LIBRARY AUTHORITY -> EXPLICIT DOMAIN MANDATES -> AUTHORIZED RESOLVERS -> ONE RESOLVED CONTEXT PACKAGE -> ASSISTANT/ACTION DISPATCH`

- The Car Mover API exposes one authenticated resolution boundary at `POST /car-mover/library/resolve`.
- All Car Mover records remain tenant-scoped and require `PREMIUM_ACCESS` before repository access.
- Every eligible resolver is authorized before `RESOLVER_CALLED`.
- The Global Library Authority performs context packaging, deduplication, freshness/confidence precedence, conflict recording, and fallback dispatch.
- No Phase 1 contract file was changed.

## Real source adapters

| Resolver | Global source | Canonical data |
| --- | --- | --- |
| Transport history | `CAR_MOVER_TRANSPORTS` | `CarMoverJob` + vehicle |
| Quote history | `CAR_MOVER_OFFERS` | `CarMoverPlatformOffer` |
| Client | `CAR_MOVER_CLIENTS` | tenant invoices/counterparties |
| Vehicle | `CAR_MOVER_VEHICLES` | `CarMoverVehicleSubject` |
| Route | `CAR_MOVER_TRIP_HISTORY` | job pickup/destination snapshots |
| Platform | `CAR_MOVER_PLATFORMS` | `CarMoverPlatformOffer` |
| Cost | `CAR_MOVER_COSTS` | `CarMoverFinancialEntry(COST)` |
| Rate | `CAR_MOVER_RATES` | `CarMoverFinancialEntry(REVENUE)` |
| Empty kilometres | `CAR_MOVER_EMPTY_KILOMETRES` | `OpportunityCostAssessment.emptyKm` |
| Document | `CAR_MOVER_DOCUMENTS` | invoice evidence references |

## Reused resolvers

- Gmail uses `premium.gmail.inbox.v1`, the Phase 2B resolver. No Car Mover Gmail parser was added.
- Conversation history uses `premium.conversation-history.v1`.
- Shared Archive uses the Phase 2C archive resolvers and backend.
- Personal contacts use a bridge to an already authorized Phase 2A `PROFILE_CONTACTS` package. Raw Profile storage is not duplicated in Car Mover.
- A valid name-first Phase 2A result adds the Profile mandate even for a name-only utterance.

## Required cross-domain examples

| Request | Proven resolution |
| --- | --- |
| “Am mai transportat ceva pentru clientul acesta?” | Car Mover + Conversation History |
| “Ce am cerut ultima dată pe ruta asta?” | Car Mover quotes/routes + Shared Archive |
| “Verifică și emailurile dacă avem informații despre mașina asta.” | Car Mover vehicle + existing Gmail resolver |
| “Avem vreun email de la client despre transportul acesta?” | Car Mover transport/client + existing Gmail resolver |
| “Ce știm despre clientul acesta și ce contacte avem?” | Car Mover client + authorized Phase 2A Profile context |
| “Compară transportul acesta cu ofertele similare pe care le-am făcut anterior.” | Car Mover + Shared Archive + History |
| Full combined request | Car Mover + Basic + Premium + Profile, four explicit mandates, one package |

## Negative controls

- No Profile domain or Profile bridge runs without a Profile mandate.
- No Gmail resolver runs without a Gmail mandate.
- Missing `PREMIUM_ACCESS` blocks all eligible Car Mover reads before repository access.
- Guardian-denied Gmail remains a visible `BLOCKED` resolution and is not replaced by Car Mover/history context.
- An unproven Phase 2A Profile package is denied; Car Mover data cannot invent Profile data.
- Generic fallback is allowed only after every eligible authorized resolver returns verified no-data.
- Phase 2C regression proves `LOCAL_ONLY` data is rejected by the cross-surface shared backend.

## Verification

- `pnpm.cmd --filter @agm/api test:library:phase2d` — PASS, 28/28.
- `pnpm.cmd --filter @agm/web test:library:phase2a` — PASS.
- `pnpm.cmd --filter @agm/api test:library:phase2b` — PASS, 21/21.
- `pnpm.cmd --filter @agm/api test:library:phase2c` — PASS, 18/18.
- `pnpm.cmd --filter @agm/api build` — PASS.
- `pnpm.cmd --filter @agm/web build` — PASS.
- Web build sub-gates: production API endpoint, PWA release contract, TURN operational UI, TypeScript, speech semantics 12/12, and Vite production build — PASS.
- `pnpm.cmd security:evidence:check` — PASS, 3,664 files scanned, 0 findings.
- `pnpm.cmd security:evidence:test` — PASS, raw secret output false.

## Gate matrix

- CAR MOVER ORCHESTRATOR = PASS
- CAR MOVER RESOLVERS = PASS
- CAR MOVER + GMAIL = PASS
- CAR MOVER + PROFILE = PASS
- CAR MOVER + HISTORY = PASS
- CAR MOVER + SHARED ARCHIVE = PASS
- FULL CROSS-DOMAIN MANDATE = PASS
- DEDUPLICATION = PASS
- PROVENANCE / FRESHNESS CONFLICT HANDLING = PASS
- MINIMAL AUTHORIZED CONTEXT = PASS
- NEGATIVE CONTROLS = PASS
- NO DOMAIN BYPASS = PASS
- NO GENERIC FALLBACK BEFORE RESOLUTION = PASS
- PHASE 2D = PASS

This is automated integration-contract evidence. It does not claim Phase 3 physical-device, live Gmail-provider, cross-surface physical, or Production validation.
