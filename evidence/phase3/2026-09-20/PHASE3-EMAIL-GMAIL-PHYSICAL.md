# Phase 3 - labelled contact email + physical Gmail runtime

Date: 2026-09-20
Device: Samsung SM-S931B
Test package: com.agm.cockpit.storagetest
Version: 1.5.0-storage-test, versionCode 27
Local source HEAD before Phase 3 commit: ac681806691a06d07a395beff65c8d7146ef682f
StorageTest APK SHA-256: DE960E27F33A7D4B3749BCA6FA9034A8CF78B63D30C74AFAD5D60392536FC5FE
Production package changed: NO
Production deploy triggered: NO

## Multiple labelled email addresses

- Extensible email rows in Profile / Personal AGM contacts: PASS
- Labels personal + work: PASS
- Optional default address: PASS
- No-default state with two addresses: PASS
- Legacy single-email migration: PASS
- Semantic personal/work selection: PASS
- Voice ambiguity prompt before external action: PASS
- Assistant API calls before local ambiguity resolution: 0
- Voice choice `de serviciu` resolved the work label: PASS
- Android email handoff target: synthetic work address under example.test
- Force-stop/relaunch persistence: PASS

Synthetic test contact contained only example.test addresses. It is not production/user data.

## Automated gates

- Web typecheck: PASS
- MULTIPLE EMAIL ADDRESSES PER CONTACT: PASS
- EMAIL LABELS + LEGACY MIGRATION: PASS
- SEMANTIC EMAIL RESOLUTION: PASS
- DEFAULT EMAIL SUPPORT: PASS
- VOICE EMAIL DISAMBIGUATION: PASS
- Quick contacts regression: PASS
- Phase 2A resolver regression: PASS
- Voice action confirmation regression: PASS
- API Gmail + Phase 2B tests: 41 PASS / 0 FAIL
- Web build: PASS
- API build: PASS
- Evidence secret scan: PASS, 3672 files, 0 findings

## Physical Gmail diagnosis

Exact normalized utterance: `Reda-mi te rog ultimele doua emailuri.`

Observed with the exact StorageTest APK against Production API:

- request endpoint: Production premium-assistant/respond
- request includes `surface: ANDROID`
- HTTP status: 400
- validation message: `property surface should not exist`
- Gmail resolver reached: NO
- generic `AGM nu poate raspunde momentan` shown: NO
- factual pre-resolver failure spoken through TTS: PASS

Control probe from the same physical WebView and authenticated session, omitting only the incompatible `surface` property:

- HTTP status: 201
- contract: premium-assistant.v1
- provider: AGM
- tool: gmail-inbox
- tool status: SUCCESS
- operation: LIST_RECENT
- result count: 2
- external effect: false

Physical session renewal probe:

- auth/refresh HTTP status: 201
- replacement access token issued: YES
- token value recorded: NO

Diagnostic-only in-memory bridge (not an acceptance artifact) omitted `surface` and proved:

VOICE/CONFIRMED TEXT -> GMAIL INTENT -> AUTHORIZATION -> GMAIL RESOLVER -> GMAIL READ (2) -> ASSISTANT RESPONSE -> TTS SPEAKING

Observed voice states: OFF -> UNDERSTANDING -> PREPARING -> SPEAKING.
No email subject, sender, body, token, cookie, or credential was written to evidence.

## Root cause and verdict

ROOT CAUSE = WEB/API RELEASE CONTRACT SKEW

The local/current request contract allows optional `surface: ANDROID | BROWSER`. The Production API receiving the physical request rejects that property before Global Library Authority and Gmail resolution. The same authenticated physical request reaches Gmail and returns exactly two results when that one incompatible field is omitted.

A client compatibility retry was intentionally not introduced because it would hide release skew and would misclassify Android as the Browser default. Correct closure requires publishing one aligned Web/API release, rebuilding the exact Android artifact against it, then repeating the unmodified physical voice request.

MULTIPLE EMAIL ADDRESSES PER CONTACT = PASS
EMAIL LABELS = PASS
SEMANTIC EMAIL RESOLUTION = PASS
DEFAULT EMAIL SUPPORT = PASS
VOICE DISAMBIGUATION = PASS
GMAIL TOKEN AUTO-REFRESH ENDPOINT = PASS
PHYSICAL GMAIL ACCESS ON EXACT UNMODIFIED ARTIFACT = FAIL
LATEST EMAIL RETRIEVAL ON EXACT UNMODIFIED ARTIFACT = FAIL
GENERIC FALLBACK BEFORE GMAIL RESOLUTION = NOT OBSERVED; REQUEST REJECTED AT DTO VALIDATION
PHASE 3 GMAIL = NOT CLOSED
