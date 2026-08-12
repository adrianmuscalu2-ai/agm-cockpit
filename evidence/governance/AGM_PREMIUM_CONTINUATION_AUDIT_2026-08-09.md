# AGM Premium — continuation audit

Date: 2026-08-09  
Mode: read-only audit; no Premium implementation or Production mutation

## Sources and authority

1. `ROADMAP.md` v2.0 is the single canonical authority for Premium scope and execution order.
2. `ARCHITECTURE_STATUS.md` is the authority for current implementation progress.
3. `AGM_PREMIUM_ARCHITECTURAL_CONTRACT_V1.md` is normative for architecture.
4. The Hub vision and structural plan are alignment/execution references, not competing roadmaps.
5. Module dossiers and validation reports are evidence; historical statuses do not override the current architecture register.

The roadmap is already aligned to the integrated Hub model. The earlier audit recommendation to update the old feature-list roadmap has therefore been fulfilled in the current `ROADMAP.md` v2.0.

## Current Premium position

Validated foundations:

- Premium shell and route registry;
- `TripContext v1`, lifecycle machine and `OperationalEventV1`;
- local append-only EventStore, outbox, optimistic concurrency and recovery contracts;
- initial Pre-Departure integration;
- Access/Premium gateway, session, entitlement and route enforcement;
- Premium load-safety Web/API capability in its approved module scope;
- PRE-001–PRE-008 closure evidence within their individual contracts.

Current automated checks:

- Premium foundation — PASS;
- Premium Operational Context canonical tests — PASS;
- Access/Premium separation contract — PASS;
- Website Astro build, 27 routes — PASS;
- SR-14 CSS cascade parity — FAIL: actual `D27B210081C5510D57CF65EB3F6899B54CC3319D48D4EE413BF91BFCA28069D3`, expected protected baseline `4507BE92FB1586A1D8374A505786059B88B82D8EAE89ABC78B1732D0B4CB5245`.

The SR-14 failure is an integration gate for the Premium successor baseline. It does not invalidate the frozen Basic field-test candidate.

## Material gaps before functional expansion

The next canonical stage is still Stage 1 — closure of the common foundation. The following remain incomplete or unproven end-to-end:

- server-side canonical EventStore adapter;
- explicit event-schema/version compatibility policy;
- common Premium UI projection driven by the canonical context;
- server synchronization, conflict handling and recovery end-to-end;
- controlled migration of remaining Premium modules to `TripContext`;
- successor-baseline reconciliation, including SR-14;
- Browser and Android validation for the eventual Premium release candidate.

The current Cockpit Premium UI is a foundation/POC, not the complete integrated Premium product:

- route registry exposes `/premium`, `/premium/team` and `/premium/ladungssicherung`;
- Pre-Departure and After-Departure exist as separate entrypoints;
- AI Friend, Transport Assistant, Smart Communication and Driver Journal cards remain unavailable placeholders;
- this does not yet satisfy the canonical HUB-00–HUB-07 model or the vertical MVP gate.

## Website audit

Strengths:

- visual identity clearly separates Basic and Premium;
- messaging preserves human control, safety and transparent implementation stages;
- Premium is positioned around context, connected workflows and operational assistance;
- the website builds successfully in RO/DE/EN.

Required reconciliation before using the website as the Premium execution guide:

1. **Critical routing defect:** Premium presentation links are hard-coded to `http://localhost:5173/...`. Port 5173 is reserved for AGM Fitness and must never be used for Cockpit navigation. A public website must not send users to localhost. The eventual destination must use the approved Cockpit Access/Premium route, with environment-aware canonical URLs.
2. **Architecture mapping gap:** the website presents Hub A/B/C, while the canonical roadmap defines HUB-00–HUB-07. Marketing simplification is acceptable only with an explicit mapping and without implying a competing Hub architecture.
3. **Status drift:** website metadata still identifies baseline `1.2.9`, while the active application/field candidate is `1.3.0`. Several Basic and Premium feature stages no longer match the accepted evidence.
4. **Language parity gap:** Romanian Premium has the full interactive presentation; DE/EN use simplified localized pending-page content rather than equivalent Premium structure.
5. **Access semantics:** “Open Hub” must route through the validated Access gateway and entitlement enforcement, never directly promise public Premium availability.
6. **Product truth:** validated module contracts must not be presented as complete end-to-end Premium Hub availability. The website correctly warns that public access is not fully active, and this warning must be retained until the release gates pass.

## Recommended continuation order

### P0 — Reconciliation checkpoint

- preserve the frozen Basic field candidate;
- inventory each Premium module against HUB-00–HUB-07 and `TripContext`;
- resolve SR-14 by determining whether the current cascade is approved or a regression, without blindly updating the expected hash;
- define the successor Premium baseline and exact change scope.

### P1 — Close common foundation

- implement/version the server EventStore contract and adapter;
- connect outbox/sync/conflict/recovery end-to-end;
- implement the common UI projection for active trip, flags, open items and timeline;
- prove replay, idempotency, offline recovery and authorization.

### P2 — Premium Cockpit MVP

- implement HUB-00 as the single operational entrypoint;
- expose one active `TripContext`, lifecycle, flags, open items and minimal timeline;
- migrate existing Pre-/After-Departure entrypoints into the canonical navigation without parallel state.

### P3 — First vertical slice

Execute the roadmap-defined slice:

`Camera/import → OCR → human review → canonical document → analysis/translation → CommunicationDraft → event timeline → archive`

Only after this end-to-end slice passes should Communication & Language, complete Pre-Departure, Active Trip, Post-Trip and productization expand in order.

### Website workstream

Website reconciliation should be a separate, parallel presentation workstream after the P0 mapping is approved. It must fix the 5173 links first, align Hub/status/version terminology, and preserve honest availability labels. It must not redefine Premium architecture.

## Browser evidence status

The mandatory preflight detected the current host as VS Code and routed the visual probe to Codex Desktop `iab`. Source inspection and the successful static build support this documentary audit, but a new controlled visual PASS is not claimed until the Desktop handoff returns. No local browser/plugin installation was attempted.

## Verdict

- PREMIUM ROADMAP — CANONICAL / ALIGNED
- PREMIUM FOUNDATION — PARTIAL BUT VALIDATED IN APPROVED SCOPES
- PREMIUM END-TO-END PRODUCT — NOT YET COMPLETE
- WEBSITE BUILD — PASS
- WEBSITE PREMIUM ALIGNMENT — ACTION REQUIRED
- WEBSITE 5173 LINKS — CRITICAL ROUTING DEFECT
- SR-14 SUCCESSOR-BASELINE GATE — FAIL / RECONCILIATION REQUIRED
- RECOMMENDED NEXT STEP — P0 RECONCILIATION, THEN STAGE 1 FOUNDATION CLOSURE
- BASIC FIELD-TEST FREEZE — PRESERVED
- NO PRODUCT OR PRODUCTION CHANGE

## P0 reconciliation closure — 2026-08-09

The Product Owner subsequently authorized the presentation-only P0 scope. That
checkpoint is now reconciled and supersedes the website/SR-14 action items in
the audit verdict above:

- Premium CTA routing uses the canonical Cockpit Access gateway and contains no
  localhost link;
- the website records Fitness `:5173` as protected and Cockpit `:5174` as the
  strict application port;
- RO/DE/EN use one shared HUB-00–HUB-07 presentation topology;
- product identity is `1.3.0`, while historical `1.2.9` remains historical;
- SR-14 was reconciled to the approved post-Android-Wave-1 cascade and passes;
- no Premium feature, application runtime, Basic field candidate, Production,
  DNS or Cloudflare configuration was changed.

Detailed evidence: `P0_WEBSITE_PREMIUM_SR14_RECONCILIATION_2026-08-09.md`.
