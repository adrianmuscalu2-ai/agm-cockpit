# AGM Cockpit — Field Test Batch 02

Recorded: 2026-08-11 23:43 Europe/Berlin  
Revision: `b241722e879bd68ee2f7367cb3338d854d00b54b`

## Result

- Situation 10 — Unsafe interaction gate: READY
- Situation 11 — Immediate danger / injuries gate: READY
- Situation 12 — Incident / accident: READY
- Situation 13 — Vehicle breakdown: READY
- Situation 14 — Driver fatigue: READY
- Situation 15 — Cargo / securing / seal issue: READY
- Situation 16 — Blocked route / restriction: READY
- Situation 17 — Weather / road condition: READY
- Situation 18 — Language barrier: READY
- Situation 19 — En-route document: READY
- Situation 20 — Independent communication: READY
- Situation 21 — Arrival / final documents: READY
- Situation 22 — Final report / sync / archive: READY

## Gates

- Controlled Chromium Desktop: 13/13 PASS, screenshots and machine-readable report complete.
- Android Samsung SM-S931B: 13/13 PASS.
- Android restart/recovery: PASS; 11 operational cases and safety state recovered.
- External effects: PREPARE → HUMAN CONFIRM preserved; automatic send absent.
- i18n common semantic contract: RO/DE/EN/FR/NL/RU/PL/TR/SQ PASS.
- Shared EventStore/outbox/reconnect/dedup contract: PASS.
- Web build and Android build: PASS.
- APK SHA-256: `658271A2DD8AEF533E2848B7019E7B8DAB5BED430F3CD083D2662642F8F26B76`.
- `git diff --check`: PASS (line-ending warnings only).

## Scope protection

Slice A and Slice B remain closed and preserved. Production, Basic, Fitness, Gmail and WhatsApp were not modified or deployed. No situation outside the authorized 10–22 range was added.

## Verdict

ANDROID FIELD TEST BUILD — READY

FIELD TEST BATCH 02 — TECHNICAL PASS / READY FOR PRODUCT OWNER FIELD TEST

PRODUCT OWNER FIELD ACCEPTANCE — PENDING

BATCH 02 — READY / NOT CLOSED

The accepted APK is frozen for field testing. It must not be changed unless a concrete field defect is recorded with situation ID, step, expected result, actual result, severity and evidence.
