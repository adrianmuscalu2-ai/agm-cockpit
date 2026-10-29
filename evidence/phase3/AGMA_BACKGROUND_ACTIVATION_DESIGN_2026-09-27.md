# AGMa background activation — implementation design

## Current truth

Current Android 1.6 implements foreground `SpeechRecognizer`/TTS through `AgmAudioPlugin`. The manifest contains no `VoiceInteractionService`, wake-word service, foreground microphone service, boot receiver, or hotword detector. Semantic handling of “AGMa, deschide” is not background activation.

Status: **PARTIAL — KEEP; separate implementation track**.

## Recommended architecture

Primary route: an Android `VoiceInteractionService` / selected default assistant integration, with explicit user opt-in and an onboarding check that AGM is the selected assistant. This is the only preferred path for OS-compliant locked/background assistant behavior without inventing a permanent hidden recorder.

Fallback research route: an opt-in foreground service with a visible persistent notification and an on-device wake detector. It is acceptable only if the target Android versions permit microphone foreground-service start in the intended states and if battery/privacy acceptance is explicit. It must never masquerade as a completed default-assistant path.

## Privacy and audio policy

- On-device wake detection by default.
- No raw microphone audio persisted or uploaded for wake detection.
- A bounded volatile circular buffer only as technically required by the detector; wipe it on non-match, stop, crash recovery and permission revocation.
- Start normal speech recognition only after a confirmed wake event and visible/audible acknowledgement.
- Persistent Android microphone indicator and foreground notification whenever a microphone foreground service is active.
- Explicit controls: enable, pause, disable, battery mode, and delete diagnostic metadata.
- Store only non-audio diagnostics: enable state, detector version, match timestamp, confidence band, lifecycle transition and failure code.

## Lifecycle

| State | Expected behavior |
|---|---|
| Screen unlocked / app foreground | Existing foreground voice remains authoritative; wake activation may hand into the same single-turn controller. |
| App background | Default-assistant service may receive the invocation; otherwise the opt-in foreground service must remain visibly active. |
| Screen locked | Only an OS-authorized assistant route may open the allowed surface; protected actions still require authentication/confirmation. |
| App killed | No hidden resurrection. Default-assistant lifecycle is OS-owned; foreground-service restart follows explicit user setting and OS policy. |
| Device reboot | No microphone start from boot receiver. A receiver may restore disabled/paused configuration and notify the user; listening begins only through an OS-permitted user-visible path. |
| Permission revoked | Stop immediately, clear volatile audio and show a precise disabled state. |
| Google/default assistant conflict | Detect and explain the conflict; never change the default assistant silently. |

## Battery modes

- `OFF`: no detector/service.
- `ASSISTANT_ONLY`: recommended; OS invokes AGM as selected assistant.
- `VISIBLE_FOREGROUND_LOW_POWER`: optional on-device detector, persistent notification, conservative model and backoff.
- No “always recording” or cloud-streaming mode.

## Permissions and declarations

The final manifest design must be justified against the selected route and Android target. Potential declarations include `RECORD_AUDIO`, a microphone foreground-service permission/type only for the explicit fallback, and the service metadata required by `VoiceInteractionService`. No boot-time microphone permission escalation and no accessibility-service workaround.

## Physical-device matrix

Test “AGMa, deschide” and supported-language equivalents across: unlocked foreground; unlocked background; locked; app swiped away; process killed by OS; reboot; permission denied/revoked; battery saver; Doze; Bluetooth/headset; wired headset; active phone call; Google assistant selected; AGM selected; Wi-Fi; mobile data; offline; five rapid false triggers; noisy cabin; screen rotation; service update/restart. Record microphone indicator, notification, latency, false acceptance/rejection, battery drain and zero retained raw audio.

No implementation is included in Phase 3.
