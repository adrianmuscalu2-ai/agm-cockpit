# Phase 4 authentic RC gaps

## Preserved Phase 3 candidate

- Commit: `144e4a8c191438fffa1c82f4a4c3a24b6c1112f8`
- Tree: `b3f667f4ca55cfdd83910413c6bf7bf156b0549c`
- Validated manifest SHA-256: `a77b7d5d847072c577d87ded187c62b900e72e7560f62d21fefc0bb0b9da1d1c`

## Chief Monitoring Inspector

- Commit: `908b199698ce4b3f4e73b5ce663106a08e80e76a`
- Tree: `fb865f561aaa0e5b0e4de0ac851c55176ef8eded`
- Registration: BASIC duty `chief-monitoring-inspector`.
- Mandate: approved read-only `INSPECTOR` mandate under the existing Authority Control Plane.
- Runtime: scheduled in the existing 60-second ACP cycle, deterministic event/journal persistence, restart continuity through the current store, current incident authority for open/recovery/deduplication, TURN projection from `AgentRuntimeEvent`.
- Legacy boundary: no `ComponentHeartbeat` authority was added.
- Fleet: BASIC is now legitimately `35/35`; Premium IDs remain excluded.

## Fresh physical OCR

- Validator: `scripts/validate-phase4-ocr-camera-physical.mjs`.
- Evidence run: `evidence/phase4/ocr-camera-physical/2026-09-27T10-02-11-117Z/report.json`.
- Device: Samsung SM-S931B, Android 16 / SDK 36.
- APK: `com.agm.cockpit.storagetest` 1.6.0-storage-test (28).
- Installed APK SHA-256: `FCB6015A1419230FB19ACC4D495CE225B177AA161C61159BF40B1680D6C06C1F`.
- Result: **PASS** — three separate Samsung Camera launches and physical shutter captures; no gallery/file input.
- Contextual return: BASIC PASS, Translator PASS, Email PASS.
- Captured-image hashes are distinct and recorded in the machine-readable report.

The photographed scene was not staged as an OCR-quality fixture, so the text is noisy. The authentic gate verifies capture, local OCR returning non-empty recognized text, and correct destination projection; it does not claim semantic accuracy for that scene.

## AGMa background activation

**PARTIAL — PLATFORM/OWNER-CHOICE GATE.** The exact evidence and Android boundary are recorded in `AGMA_BACKGROUND_ACTIVATION_PLATFORM_GATE_2026-09-27.md`. AGM is not the selected/default assistant and has no approved enrolled hotword authority. The mandate's explicit STOP condition therefore applies before a truthful locked/background/restart certification can exist.

## Regression certification

- API production build: PASS.
- Web production build: PASS; semantic speech normalization 12/12.
- CMI runtime: 3/3 PASS; authority-control-plane contract: 5/5 PASS.
- Machine auth, Permission Guardian and multipart security: 4 suites / 24 tests PASS.
- BASIC TURN Browser: 35/35 including CMI, zero Premium identities, page errors 0.
- Premium Linguists IT/ES/SV: PASS; `OPERATIONAL_LINGUIST_V1_ONLY`; no duplicate authority; legacy Browser publisher absent; `ComponentHeartbeat` fenced.
- TURN functional overview and operational truth: PASS.
- Android action layer, contacts, multiple email labels/default/migration/disambiguation, device capability router: PASS.
- Global camera/OCR and native capture deterministic suites: PASS.
- Car Mover: six real modules PASS.
- Tachograph and Dashboard Warning camera/OCR activation: PASS.
- Physical foreground voice and native handler matrix: reused from unchanged APK lineage, PASS.
- Physical OCR: fresh Phase 4 run PASS.
- `test-turn-approved-dashboard.ts`: the first run exposed an obsolete DOM-order assumption between the AI-network declaration and the P9 investigate-page projection. The validator now checks those two independent invariants separately; rerun PASS. No application file changed for this correction.
- Secret scan for new Phase 4 text/validator evidence: PASS, zero credential patterns.
- Git diff checks: PASS.

Full AGMa background-wake regression remains unexecutable until the platform/owner-choice gate is resolved; it is not reported as PASS.

## Production boundary

- Production SHA: `895451b11a46c3f73fc572a3e6831a9a356c312f`
- Production deployment: `6682084695`
- Push: NONE
- Deploy: NONE
- Restart: NONE
- Production mutation: NONE

## Verdict

**PHASE 4 PARTIAL — CMI PASS; fresh physical OCR PASS; AGMa background activation remains blocked by explicit default-assistant owner choice and missing OS-supported/enrolled `AGMa` hotword authority. NOT RC READY.**
