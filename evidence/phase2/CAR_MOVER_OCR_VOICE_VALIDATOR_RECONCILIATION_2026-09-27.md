# Phase 2G — Car Mover / OCR / Voice validator reconciliation

## Scope and provenance

- Production baseline: `895451b11a46c3f73fc572a3e6831a9a356c312f`.
- Car Mover archive: `archive/car-mover-parity-physical-20260926` at `cd6713d5a3f88276a8ad80af510627d1bc7c48ae`.
- Voice validator archive: `archive/voice-runtime-validators-20260927` at `95107d1a4b5897819ed165eb787a2555bba430db`.
- Dirty machine-auth/OCR archive: `archive/dirty-machine-auth-ocr-accountability-20260926` at `85d04dc947066e19ef8c4012308bb11fe96939e1`.
- Android action-layer archive: `archive/android-action-layer-dirty-20260927` at `a23baa8a97d39a583bf7bab32fc2e9664336de4a`.

The archives were inspected without applying them. No Production, auth, TURN, M2M, Android runtime, or application source was changed in this family.

## Reconciliation

### Car Mover

The canonical navigation validator is newer and covers the complete HERO → six-module hub → operational module flow. The archived parity validator still carried unique assertions for protected copy, the v4 hero asset, title hierarchy, translucent panel, spacing, and desktop/mobile overflow. Those assertions were adapted to the current ephemeral Vite and auth/legal contract in `scripts/validate-car-mover-browser-parity.mjs`.

The archived physical Android validator is preserved but was not copied verbatim. It defaults to the obsolete storage-test package and version code 22. Current Android 1.6.0 is `com.agm.cockpit`, version code 28. A physical rerun requires an attached authorized device and exact installed APK provenance; no device was attached during this reconciliation.

Verdict: **PASS for current Browser parity; PARTIAL — KEEP for physical Android evidence**.

### OCR and machine auth

Canonical machine-auth is newer than the archive and includes GitHub Actions OIDC provisioning absent from the dirty snapshot. Normalized identical archive files were limited to the decorator, DTO, JWT guard/strategy, migration, DB validator, and accountability CSS; divergent runtime files are older or superseded. No machine-auth source was ported.

Canonical OCR covers every current `AppViewName`, authorization-denied behavior, native cancellation, and guardian-before-camera semantics. The archived Browser validator provided unique end-to-end assertions: global OCR availability on every route, route preservation, real Tesseract processing, and contextual return into BASIC, Translator, and Email. Those assertions were adapted in `scripts/validate-global-camera-ocr-browser.mjs`.

The first sandboxed run passed 27/27 route probes but could not load the official Tesseract worker from `cdn.jsdelivr.net` (`ERR_NETWORK_ACCESS_DENIED`). Under the Rescue route, only the affected validator was rerun with network access; the real OCR scenarios then passed. The failed run is retained as a recovery journal rather than hidden.

Verdict: **PASS**.

### Voice and Android action layer

The current action layer is an evolved implementation, not a missing legacy copy. Deterministic current tests prove:

- navigation provider selection for Maps, Waze, and TomTom;
- Gmail-derived destination routing;
- device and Personal AGM Contacts resolution;
- email and Messenger routing;
- personal/work/default email selection and ambiguity prompts;
- explicit confirmation before external handoff;
- voice feedback and single-use yes/no confirmation.

The current Browser voice validator uses the `premium-assistant.v2` contract and verifies model-request preemption, TTS cancellation, single active turn, and telemetry. The archived Browser script uses v1 and is obsolete. Archived physical microphone validators remain valuable evidence tooling but contain device/build pins and cannot be promoted byte-for-byte. Existing current physical validators are stronger for barge-in and native stop acknowledgement, but no device was attached for a fresh physical rerun.

The three archived glass-only scripts are UI visual probes, not voice capability validators, and were rejected from this family.

AGMa background wake activation remains **PARTIAL — KEEP**. Foreground microphone, semantic command handling, or Android assistant handoff does not demonstrate a wake-word detector, persistent background listener, `VoiceInteractionService`, boot receiver, or persistent microphone service.

Verdict: **PASS for current foreground Browser/runtime and deterministic orchestration; PARTIAL — KEEP for fresh physical Android evidence and AGMa background activation**.

## Tests and evidence

- `test-android-action-layer.ts`: PASS.
- `test-contact-email-labels.ts`: five named PASS verdicts, including voice email disambiguation.
- `test-public-contact-e2e-orchestration.ts`: PASS.
- `test-voice-action-confirmation.ts`: six named PASS verdicts.
- `test-global-camera-ocr.ts`: PASS, all canonical views.
- `test-native-camera-capture.ts`: PASS.
- machine-auth service + e2e: 2 suites, 15 tests PASS.
- Car Mover Browser parity: PASS, desktop/mobile, page errors 0, overflow 0.
- Global OCR Browser: PASS, 27/27 routes and three real contextual OCR scenarios.
- Voice TURN Browser: PASS, preemption and audio cancellation.
- Physical Android discovery: ADB available; attached devices: 0.

Evidence roots:

- `evidence/car-mover/browser-parity/2026-09-27T08-04-16-289Z/`
- `evidence/global-camera-ocr/browser/2026-09-27T08-08-19-928Z/`
- `evidence/voice-runtime/browser/2026-09-27T08-09-32-339Z/`
- recovery journal: `evidence/global-camera-ocr/browser/2026-09-27T08-04-51-162Z/report.json`

## Final family verdict

**PHASE 2G PARTIAL — current Car Mover/OCR/foreground Voice validation is reconciled and PASS; physical Android rerun and AGMa background wake activation remain preserved gaps.**
