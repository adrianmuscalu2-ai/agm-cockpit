# AGM Premium — Single Copilot product direction

Date: 2026-08-12  
Authority: Product Owner  
Status: **DIRECTION ACCEPTED / ARCHITECTURE CONTRACT REQUIRED BEFORE IMPLEMENTATION**

## Product decision

The future Premium user experience retires the two visible operational hubs and becomes one simple, voice-first AGM Copilot surface. Approximately three to five primary controls remain visible:

- Microphone / Speak with AGM;
- Camera / OCR;
- Speaker;
- optional text/keyboard;
- optional approved safety action.

The driver expresses intent. AGM selects the applicable capability and progressively guides the driver toward a useful, human-controlled action.

## Preserved foundation

The existing situation registry, state machines, safety gates, OCR provenance, translation, communication preparation, EventStore/outbox/recovery, evidence, entitlement and audit foundations remain internal capabilities. Accepted Slice A/B and field-test evidence are not discarded.

## Mandatory boundaries

- Voice-first does not mean autonomous authority.
- External actions keep `PREPARE → PREVIEW → HUMAN REVIEW → EXPLICIT CONFIRM → SEND → RECEIPT`.
- Phone capabilities require explicit platform permission and capability detection.
- On-device speech/TTS/location/Maps/call/OCR may be preferred when appropriate, but each capability needs privacy, availability and fallback contracts.
- Safety-critical intent must pass the validated safety gates.
- The Copilot must expose a visible transcript/edit/confirm step before AI or external effects where required.
- Existing Basic remains unchanged and frozen except for separately proven defects.

## Required next deliverable

Before UI replacement: capability registry, intent-routing contract, authority matrix, on-device/cloud decision policy, migration mapping from the two hubs, Android-first wireframe, rollback strategy and evidence impact analysis.

No Premium UI replacement or Production deployment is authorized by this record alone.
