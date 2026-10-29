# AGM/AGMa consolidation matrix

Status meanings: `PASS` means the named deterministic test passed; `PARTIAL` means code/build or contract evidence exists but runtime, external provider, browser, or physical-device evidence is incomplete; `FAIL` means a reproducible test failure exists.

## AGM Cockpit

| Feature | Source / commit | Version | State | Decision |
|---|---|---|---|---|
| Basic cockpit | candidate baseline `ce51183` | 1.6.0 | PARTIAL | Integrate as baseline; runtime proof still required |
| Premium cockpit | candidate baseline `ce51183` | 1.6.0 | PASS contract / PARTIAL runtime | Keep baseline; external provider probes remain separate |
| Translation | `apps/api/src/translation`, `api003-translation-provider.spec.ts` | translation-provider.v1 | PASS unit / PARTIAL provider | Keep; do not embed API keys |
| Language/UI contracts | web scripts and language registry | 12-language contract | PASS except French wave | Keep; repair missing French keys |
| Dictation/STT/TTS | voice shell and speech semantics scripts | current baseline | PASS contract / PARTIAL device | Keep; physical microphone test required |
| OCR | `test-global-camera-ocr.ts`, camera contracts | current baseline | PASS deterministic / PARTIAL camera | Keep; physical camera test required |
| Gmail | `apps/api/src/communications`, Gmail tests | current baseline | PASS unit / PARTIAL OAuth | Keep; run authenticated provider test separately |
| Contacts | `test-quick-contacts.ts`, contact manager | current baseline | PASS deterministic | Keep; verify device permissions separately |
| Profile and permissions | authority-control-plane, permission-guardian tests | current baseline | PASS unit | Keep; deployment identity validation remains |
| Browser | web build and UI contracts | current baseline | PASS build / PARTIAL visual | Run mandatory browser runbook before release |

## AGMa Android

| Feature | Source / commit | Version | State | Decision |
|---|---|---|---|---|
| Digital Assistant | `AgmaVoiceInteractionService`, `AgmaVoiceInteractionSessionService`, XML service declaration | `ce51183` | PASS build / PARTIAL device | Keep baseline; validate Samsung invocation |
| Button handoff | `DeviceHandoffIntents`, `AgmCapabilityPlugin`, handoff test | `ce51183` | PASS deterministic | Keep |
| Voice commands | `AgmaRecognitionService`, `AgmAudioPlugin`, voice confirmation tests | `ce51183` | PASS contract / PARTIAL device | Keep; physical microphone test required |
| Calls and contacts | `DeviceContactResolver`, quick contacts tests | `ce51183` | PASS deterministic / PARTIAL device | Keep |
| WhatsApp | no isolated physical proof found in baseline | `ce51183` | UNKNOWN | Isolate; do not merge assumptions |
| Waze / Google Maps / TomTom | adapters/contracts and secret telemetry references; no physical route proof | `ce51183` | PARTIAL | Keep contracts only; validate each provider separately |
| Multi-step execution | AGMa wave scripts and turn runtime contracts | `ce51183` | PASS contract / PARTIAL device | Keep; physical sequence test required |
| Background operation | Android service code present | `ce51183` | PARTIAL | Validate lifecycle, battery and permission behavior on S25 |
| Bluetooth | no passing physical-device evidence found | `ce51183` | UNKNOWN | Isolate until hardware test exists |
| Local wake-word | `AgmaWakeDetectorEngine`, `AgmaWakeForegroundService`, `agma-kws` assets | `ce51183` | PASS build / PARTIAL device | Keep isolated; requires enrollment and S25 evidence |

## Conflicts and missing proof

- The worktrees are divergent snapshots; same HEAD does not imply same working tree.
- The active root contains extensive local changes and was not used as a merge target.
- Android generated Capacitor files were absent in the baseline and are generated during sync.
- French Basic/contact translations are missing 27 keys in `test-basic-multilingual-wave1.ts`.
- WhatsApp, Bluetooth, navigation providers, background lifecycle, wake-word behavior and physical Samsung behavior lack current physical evidence.
- No `.env`, OAuth tokens, signing secrets or certificates were imported.

## Worktrees to retain

Retain all 28 original worktrees. In particular, preserve the Android/action-layer worktrees, local-wake worktree, profile-access worktree, Android 1.9 checkpoints, phase2/phase3 worktrees, `_isolated-repair`, and the AGMa Copilot Lab because they contain distinct local modifications or provenance that has not been merged safely.
