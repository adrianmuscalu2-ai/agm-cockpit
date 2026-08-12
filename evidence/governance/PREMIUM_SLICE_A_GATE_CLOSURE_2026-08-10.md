# Premium Slice A — gate closure evidence

Checked: 2026-08-10 (Europe/Berlin)

> **Superseded closure status — 2026-08-11:** The historical HOLD below was
> closed after the remaining controlled Desktop and physical Android evidence
> completed. Product Owner Acceptance is GRANTED. Canonical current verdict:
> `VERTICAL SLICE A — PASS / CLOSED`. Evidence:
> `evidence/slice-a/EVIDENCE_MANIFEST.json` and
> `evidence/slice-a/SLICE_A_FINAL_CLOSURE_2026-08-11.md`. Slice B remains
> `NOT STARTED / NOT AUTHORIZED`.

Scope: `required-document` only. Slice B, the remaining 22 situations,
Production, Basic, Fitness, Gmail and WhatsApp were not changed.

## Automated evidence

- `pnpm --filter @agm/web test:situation-router`: PASS.
- `pnpm --filter @agm/web build`: PASS (237 modules).
- Evidence chain is fail-closed: OCR must reference an existing original and
  exact original SHA-256; human confirmation must reference an existing OCR
  proposal and exact OCR SHA-256; duplicate evidence IDs are rejected.
- READY requires a complete original → OCR → human-confirmation chain,
  readability, validity, no blocking severity and explicit warning acceptance.
- Expired, 30-day warning and valid date classifications are covered by domain
  tests. The 30-day warning derives from the approved roadmap rule
  `RN-2.1 ... Verificare 1 lună înaintea`.
- Legacy valid import, deterministic marker, repeat without duplication,
  retained answers/issues, read-only source and ambiguous association recovery
  are covered by the router test.
- The Slice A dictionary contains all nine official language keys and the
  previously corrupted UTF-8 strings were corrected.

## Browser gate

Preflight report: `tmp/rescue-browser-preflight.json`

- Browser Plugin Status: PASS
- Integrated Browser Control Status: FAIL in current VS Code host. Exact runtime
  selection returned `Browser is not available: iab`.
- Browser Session Status: NOT STARTED
- Target Page Status: NOT STARTED
- Visual signature: `254D0FB63EC50013CCD6E70FAA92C1D531852FE9D81CF430E7FF59DFEAEFEF56`
- Previous Browser PASS is not reusable because the visual signature changed.
- Rescue created `evidence/browser-control/handoff-pending-2026-08-10T00-23-03-749Z/HANDOFF.md`
  and launched Codex Desktop for the mandatory `iab` probe.

No Desktop or Android PASS is claimed until new controlled evidence exists.

## Current verdicts

- DOMAIN CONTRACT — PASS (automated contract scope)
- UI E2E — HOLD / CONTROLLED VISUAL EVIDENCE PENDING
- ORIGINAL INTEGRITY — HOLD / BROWSER INDEXEDDB CORRUPTION PROBE PENDING
- OCR PROVENANCE — PASS (domain); real OCR UI proof pending
- HUMAN CONFIRMATION — PASS (domain); UI proof pending
- READY/BLOCKED SEMANTICS — PASS (domain); UI scenarios pending
- LEGACY MIGRATION IDEMPOTENCY — PASS (automated)
- ROLLBACK — HOLD / RUNTIME PROOF PENDING
- I18N 9/9 — HOLD / RENDERED UI PROOF PENDING
- HARDCODED USER TEXT — HOLD / COMPLETE RENDER AUDIT PENDING
- REFRESH/RESTART RECOVERY — HOLD / CONTROLLED BROWSER PROOF PENDING
- OFFLINE/OUTBOX — HOLD / E2E PROOF PENDING
- DESKTOP — HOLD / CODEX DESKTOP IAB HANDOFF PENDING
- ANDROID — HOLD / NOT STARTED
- VERTICAL SLICE A — HOLD / GATE EVIDENCE INCOMPLETE

This HOLD is limited to Slice A gate closure. It does not change any accepted
Basic, Production, Fitness, Gmail or WhatsApp verdict.

## Android continuation — 2026-08-10

- Samsung SM-S931B was connected and the build-bound LOCAL VALIDATION APK was
  installed (`SHA-256 815CBB0D67AFB8F6C20E3E5FE005B969929A8D8100E2ED73EAA1E6B5B9D0D542`).
- The local API/CORS route was isolated on port 3002 through `adb reverse`;
  Production was not changed.
- Missing document → BLOCKED: PASS.
- Real image import, original preservation and real OCR: PASS.
- Edited OCR text → human confirmation → displayed confirmed text: PASS after
  limited correction.
- Readable and valid document → human-confirmed terminal `READY ✓`: PASS after
  limited correction; repeat confirmation is disabled.
- Android force-stop/relaunch: FAIL. The operational case remains locally
  stored, but the Premium refresh session is not restored across WebView
  restart, so the case cannot be resumed through the authenticated UI.

Current Android verdict: **FAIL / PREMIUM SESSION RESTART DEFECT**. No further
manual login loop is requested. Correcting the authentication persistence
contract requires a separately reviewed security/runtime change.

## Continuation checkpoint â€” 2026-08-10 13:03 Europe/Berlin

- Current Slice A build: `beforeDeparture-DXTOBKA9.js`, SHA-256
  `5526DBEC33479C28666C6EEA88F1FF98B9984389E3A6A1F6532E0A2068E4F2BB`.
- `test:slice-a-remediation`: PASS (offline outbox, ordering, restart
  persistence, reconnect, receipt deduplication, conflict recovery, i18n 9/9,
  hardcoded-text audit).
- `test:situation-router`: PASS.
- `test:event-sync`: PASS.
- Production-endpoint web build: PASS (238 modules).
- New visual handoff for the current build:
  `evidence/browser-control/handoff-pending-2026-08-10T11-03-11-213Z/HANDOFF.md`.
- Cockpit Slice A route on reserved port 5174 returned HTTP 200. Fitness 5173
  remained reserved and was not started, stopped, reused or modified.
- Final Android APK artifact exists with SHA-256
  `B5DBE9AD86FE02C71C64A93A943D38B0656AD39C7DE889FD81F6CC6C4123F378`.
- Samsung was disconnected before the next physical probe. No prior Android
  evidence was invalidated and no login or visual PASS is claimed.
- Permanent Product Owner Production provisioning was authorized, but the
  first interactive attempt failed locally during bcrypt invocation before any
  Production transaction. Root cause was inline Node argument tokenization.
  The script now uses the existing stdin-only hashing helper and passed a
  synthetic helper check plus PowerShell parser validation. Account creation
  remains pending until the Product Owner returns for masked password entry.
