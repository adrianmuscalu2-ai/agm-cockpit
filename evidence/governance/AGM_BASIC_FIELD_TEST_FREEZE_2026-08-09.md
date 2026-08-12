# AGM Basic — short audit and field-test freeze

Date: 2026-08-09  
Scope: AGM Basic field validation readiness  
Excluded: Premium, new development, infrastructure changes, full regression rerun

## Frozen candidate identity

- Application: `com.agm.cockpit`
- Version: `1.3.0`
- Version code: `16`
- Android artifact: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`
- Size: `590152960` bytes
- SHA-256: `08B4C32401EE2B70EC2ADA7EAF35BE5D98BFEFF2DB925F4D6A6D883434DF0A49`
- Artifact build timestamp: `2026-08-08T20:47:28Z`
- Source branch at freeze: `feature/basic-multilingual-wave1`
- Source HEAD reference: `b241722e879bd68ee2f7367cb3338d854d00b54b`
- Public API endpoint: `https://api.agmcockpit.com/api/v1`
- Public Web revision at freeze: `turn-reconcile-20260809b`

The artifact checksum is the binding field-test identity. The workspace contains
authorized uncommitted changes, so the Git HEAD alone is not sufficient to
reconstruct or identify this APK. Do not rebuild, resign, replace, reinstall or
rename the candidate during the field cycle. Any checksum mismatch is `STOP / NEW CANDIDATE`.

The visible `Basic 1.2.6` Home label remains an accepted historical cosmetic
label. It does not replace the canonical package identity `1.3.0` / version code
`16` and is not a functional field-test failure.

## Short audit result

- Existing physical Samsung SM-S931B Translator Production matrix: 9/9 PASS.
- Translator RO/DE/EN regression: PASS.
- Email Assistant DE/FR: PASS.
- Production API real translation: PASS.
- AGM Basic multilingual Wave 1 contract rerun: PASS.
- Turn LIVE/STALE/UNKNOWN/OFFLINE reconciliation contract rerun: PASS.
- APK checksum matches the accepted Android Translator Wave 1 report: PASS.
- `git diff --check`: PASS.
- No new Browser product audit was required for this freeze; the permanent
  Browser route remains `VS Code → Rescue → Codex Desktop iab` if the visual
  build or Browser contract changes.

## Field-test scope

The field cycle is authorized to collect real-use evidence for Basic only:

1. Home and Basic hub navigation under normal driving-work conditions while the vehicle is stationary and testing is safe.
2. Transport documents.
3. Tachograph workflow.
4. Dashboard textual messages.
5. Dashboard warning/photo-first workflow.
6. Legislation lookup.
7. Load safety.
8. Document OCR, archive and deletion/privacy behavior.
9. Cargo anchoring/photo-first workflow.
10. Translator and Email Assistant smoke checks without repeating the accepted 9-language matrix unless a regression is observed.
11. Connectivity transition relevant to field use (Wi-Fi/mobile/offline/recovery), without changing Production configuration.

For each observation record: timestamp/timezone, device, network, route/feature,
input conditions, expected result, actual result, PASS/FAIL, screenshot or video
identifier, and incident ID when failed. Do not include secrets, personal email
content, document personal data, vehicle identifiers or credentials in shared evidence.

## Honest pending items

The following remain `FIELD VALIDATION — PENDING` until exercised in real
conditions: transport documents, tachograph, dashboard textual messages, load
safety and document OCR. Existing automated or laboratory PASS evidence is
preserved but is not converted into field PASS.

Premium is excluded and receives no verdict from this freeze.

## Change-control rule during field testing

- Functional code, API contracts, Android project, APK and Production runtime are frozen.
- No opportunistic fixes are permitted during evidence collection.
- A proved regression opens a separate incident containing the exact evidence.
- Critical safety/security/data-loss defects stop the affected test immediately.
- A non-critical defect stops only the affected flow; previously accepted PASS evidence remains preserved.
- Any authorized correction creates a new candidate, checksum and targeted retest scope.

## Verdict

- BASIC SHORT AUDIT — PASS
- BASIC FIELD-TEST CANDIDATE — FROZEN
- FIELD EXECUTION — AUTHORIZED
- FIELD-ONLY ITEMS — PENDING / HONEST
- PREMIUM — EXCLUDED
- NO REBUILD / NO REINSTALL / NO FULL RETEST
- NO PRODUCTION OR INFRASTRUCTURE CHANGE
