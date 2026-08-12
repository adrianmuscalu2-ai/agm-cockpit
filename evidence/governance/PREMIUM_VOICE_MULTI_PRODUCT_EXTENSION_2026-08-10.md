# Premium voice assistant — multi-product extension boundary

Date: 2026-08-10

## Decision

`Vorbește cu AGM` is a shared Premium service. The conversational engine is not
owned by AGM Cockpit. Product-specific operational data is supplied through a
product context adapter.

## Current active product

- Active registry: `agm-cockpit` only.
- Required entitlement: `premium.voice-assistant`.
- Required isolation scope: product, module, tenant and subject.
- Current operational references: trip, operational case and situation.

## Reserved extension

`agm-car-mover` is reserved only as a future product identifier. It is not in the
active registry and has no route, UI, database model, table, workflow, entitlement
grant or runtime adapter.

A future Car Mover integration must register its own adapter and project only the
approved order, vehicle, pickup, delivery, expense and operational-file context.
The common engine must not infer or read those records through the Cockpit adapter.

## Isolation rules

- A voice utterance is accepted only when product, module, tenant, subject,
  entitlement and operational references match the active conversation scope.
- A different tenant, product or operational case is rejected as a scope mismatch.
- Product adapters explicitly allow capabilities; no cross-product action fallback
  exists.
- External effects remain disabled in the current foundation.
- Audio is not stored or transmitted.

## External Car Mover photographs

The planned Car Mover product must keep delivery/pickup photographs in the external
Car Mover platforms by default. A future adapter may retain an order reference, a
final protocol reference and only exception/incident/retention evidence explicitly
required by policy. No photo archive is implemented by this change.

## Current-mandate preservation

- Premium access and AuthSession contracts are unchanged.
- AGM Cockpit voice context remains functional through its adapter.
- I18N continues to use the shared nine-language contract.
- No Car Mover functionality was activated or implemented.
- No Production, Basic, Fitness, Gmail or WhatsApp change was made.

## Verdict

- MULTI-PRODUCT VOICE ARCHITECTURE — PASS
- AGM COCKPIT CONTEXT ADAPTER — PASS
- PRODUCT/MODULE/TENANT/SUBJECT ISOLATION — PASS
- AGM CAR MOVER — RESERVED EXTENSION ONLY / NOT IMPLEMENTED
- CURRENT PREMIUM VOICE FOUNDATION — PRESERVED
