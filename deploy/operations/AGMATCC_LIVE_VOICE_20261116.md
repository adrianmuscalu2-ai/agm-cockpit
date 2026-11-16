# AGMaTCC live voice remediation — 2026-11-16

Production baseline: `051cca79963e44de1faefa7b5fc6b3fb486a13bc`.
The Commander physical test reported failed transcription and unintelligible
output. That failure is not superseded by local fixture tests.

The previous voice handler sent final browser recognition to the fixed command
parser, not to the AI provider. It assumed an iterable recognition result list,
did not display interim transcription, and selected no Romanian synthesis voice.
The manual playback button could read raw journal entries. These are verified
source defects; the exact microphone/provider failure on the user's physical
device remains unproven until runtime telemetry and the repeat physical test.

The remediation connects final transcription to the existing authorized AI
endpoint, journals request and response through the canonical event sync,
reports actual provider response identity, and reads only the answer with a
Romanian voice. STT failures and TTS completion/failure remain distinct events.
STOP suppresses stale capture callbacks, calls not yet sent, and delayed speech.
AI conversation envelopes remain in history but cannot become factual evidence
for their own answers. Production cannot instantiate the test simulator.

Activation uses only the five existing non-secret keys documented in
`LUNA_ACPM_LOCAL_INTEGRATION.md`: provider, production-enabled, Commander family,
database host and immutable handoff hash. The existing key and USD5 cumulative
ledger remain unchanged. A genuine TURN session supplied its family hash through
the existing session endpoint; this does not itself grant activation.

Use a new exact-candidate Proposal/PCR and immutable artifacts through the
existing branch/release flow. The old PR37 closure is preserved. Validate Guardian
secret-health/duty and unchanged custody; do not alter Guardian, RK or auth policy.
Apply the approved environment with the canonical systemd lifecycle, not a Docker
restart that retains old environment values. Require public version, real
provider response/ACPM IDs, canonical conversation readback and human voice
acceptance. Local speech fixtures are not physical audio or Production proof.

Reproducible focused tests: `pnpm --filter @agm/web test:agmatcc`, API copilot and
provider-selection suites, then `pnpm rescue:browser-preflight` followed by
`node scripts/test-agmatcc-voice-browser.mjs`. That Browser runner intercepts all
external requests and explicitly reports `PASS_LOCAL_FIXTURE`, never live AI PASS.
