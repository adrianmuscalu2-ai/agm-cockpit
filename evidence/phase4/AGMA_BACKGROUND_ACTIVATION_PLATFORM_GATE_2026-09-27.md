# AGMa background activation — Android platform gate

## Verdict

**PARTIAL — explicit owner action and an OS-supported hotword authority are still required.**

The current Android 16 device cannot truthfully certify the requested touchless invocation `AGMa, deschide`. No semantic or foreground-voice result was relabelled as background wake.

## Physical device state

- Device: Samsung SM-S931B, Android 16 / SDK 36.
- Current assistant role holder: `com.google.android.googlequicksearchbox`.
- Current voice interaction service: `com.google.android.googlequicksearchbox/com.google.android.voiceinteraction.GsaVoiceInteractionService`.
- The enrolled DSP keyphrase model belongs to the current Google service (`hint_text: X Google`, locale `en-US`).
- The installed AGM 1.6 validation package does not register a `VoiceInteractionService`, `VoiceInteractionSessionService`, `HotwordDetectionService`, microphone foreground service or boot receiver.
- `cmd package query-services -a android.service.voice.VoiceInteractionService` returned Google and ChatGPT only; AGM is not currently a selectable assistant service.

## Deterministic boundary

Android keeps only the user-selected `VoiceInteractionService` bound for background assistant behavior. Changing the assistant is an explicit user-facing role choice and must not be performed silently. The current device is bound to Google, so AGM cannot receive an OS-owned assistant invocation in background/locked/process-recreated states.

A microphone foreground service is not an equivalent substitute for the full mandate:

- it must be started while the app is visible and explicitly opted in;
- Android 14+ applies while-in-use restrictions to microphone foreground services;
- Android 14+ does not allow a microphone foreground service to be started from `BOOT_COMPLETED`;
- it would not provide an approved/enrolled `AGMa` hotword model or an OS-authorized locked-screen assistant surface by itself.

Primary Android references:

- https://developer.android.com/reference/android/service/voice/VoiceInteractionService.html
- https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- https://developer.android.com/about/versions/14/changes/fgs-types-required
- https://developer.android.com/about/versions/15/changes/foreground-service-types

## Why implementation stopped here

The Phase 4 mandate defines an explicit STOP condition when the selected mechanism requires a user-facing default-assistant choice that cannot be validated without the owner's action, or when a genuine OS/platform limitation prevents the promised behavior. Both apply to the requested locked/background/restart matrix on this device.

Adding an unselectable service shell, a hidden permanent recorder, an accessibility workaround, or a semantic phrase matcher would create a false green. None was added.

## Safe next step

Future work needs a separately reviewable Android assistant candidate that includes the service/session metadata and a real on-device hotword mechanism, followed by the owner's explicit selection of AGM as the default assistant. Only then can the physical foreground/background/locked/task-left/process-recreated/restart matrix and representative next commands be certified.

Production mutation: **NONE**.
