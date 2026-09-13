# AGM Android Device Assistant - Production validation

## Verdict

- DEVICE ASSISTANT / ANDROID HANDOFF IMPLEMENTATION: PASS
- DEFAULT ASSISTANT SELECTION: PASS (resolved dynamically from Android secure assistant setting)
- PROVIDER HARD-CODING: NONE
- ACCESSIBILITY SERVICE / EVENT INJECTION: NONE
- NATIVE MAPS HANDOFF: PASS
- FORCE-STOP + RELAUNCH: PASS
- PHONE RESTART + AGM RELAUNCH + ASSISTANT HANDOFF: PASS
- PRODUCTION ARTIFACT: PASS (AGM 1.4.0, versionCode 24)

## Architecture

User flow:

`AGM Assistant -> explicit user confirmation -> Android official intent -> user-selected/default Android handler`

AGM remains responsible for transport, Gmail, translation and AGM professional context. Android remains responsible for the device assistant, navigation, dialer, installed apps, calendar/reminder and alarm UI.

The Android bridge returns only controlled outcomes: `OPENED`, `UNAVAILABLE`, `UNSUPPORTED`, or `INVALID_INPUT`. It never reports a generic product FAIL for a missing Android handler.

## Implemented official handoffs

- Assistant: `Intent.ACTION_ASSIST`, dynamically restricted to the package selected in Android's `assistant` secure setting. If that package exposes no assist activity, its official launcher activity is used as a controlled fallback.
- Navigation: `Intent.ACTION_VIEW` with a `geo:` URI.
- Dialer: `Intent.ACTION_DIAL` with a `tel:` URI; AGM never places a call directly.
- App opening: Android launcher activities discovered by user-visible app label; no package allowlist or provider name is embedded.
- Reminder: `Intent.ACTION_INSERT` with `CalendarContract.Events.CONTENT_URI`; the user completes the event in the selected calendar.
- Alarm: `AlarmClock.ACTION_SET_ALARM` with `EXTRA_SKIP_UI=false`; the Android UI remains visible for confirmation.
- Context: bounded to 2,000 characters and supplied best-effort through `Intent.EXTRA_ASSIST_CONTEXT` and `Intent.EXTRA_TEXT` only after the user chooses the context-handoff control.

## Physical device evidence

- Device: Samsung SM-S931B
- Android: 16 / API 36
- Installed package: `com.agm.cockpit`
- Installed version: `1.4.0` / versionCode `24`
- User-selected assistant setting observed read-only: `com.google.android.googlequicksearchbox/com.google.android.voiceinteraction.GsaVoiceInteractionService`

Before restart:

1. Signed Production v24 installed with `adb install -r`: PASS; application data preserved.
2. Force-stop and launcher relaunch: PASS; AGM regained foreground focus.
3. Dedicated module visible in AGM Assistant: PASS.
4. `Deschide asistentul Android`: PASS; focus transferred to the assist activity in the package selected by Android.
5. Android Back: PASS; AGM resumed at the handoff module.
6. Navigation value `Heilbronn`: PASS; Android ResolverActivity displayed installed handlers Maps, Satellite View, TomTom and Waze. No navigation was started.

After restart:

1. `sys.boot_completed=1`: PASS.
2. AGM Production versionCode 24 still installed: PASS.
3. Force-stop and launcher relaunch: PASS.
4. Dedicated module reopened: PASS.
5. `AGM -> Android Assistant`: PASS; focus again transferred to the Android-selected assistant package.

## Automated verification

- `test:device-assistant-handoff`: PASS (12 language registry entries, six actions, controlled fallback, no provider hard-coding, no Accessibility Service)
- `test:device-capability-router`: PASS
- `test:premium-assistant-ui`: PASS (12/12)
- `test:premium-copilot-c0`: PASS
- TypeScript `tsc --noEmit`: PASS
- Java `:app:compileDebugJavaWithJavac`: PASS
- Web Production build: PASS
- Signed AAB validation: PASS
- Browser Plugin Status: PASS
- Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE
- Browser Session Status: PASS
- Target Page Status: PASS
- Controlled Browser run: `2026-09-13T19-48-24-227Z`, dynamic target `http://127.0.0.1:59862/`

## Artifact identity

- AAB SHA-256: `CB9A58E55B7F0BC8826D11EF4DBD9A6DCB84302DFA5C19F668207C3E23D96E3E`
- Universal APK SHA-256: `C49FD35D37FB99E093F9985085B58C4522348E926D41EAB818561FFC71F57155`
- Signing certificate SHA-256: `6E:18:2B:67:BD:A9:E4:C4:F6:EE:93:D7:95:F6:19:AF:06:88:D3:96:7F:9B:74:B5:37:9A:42:FE:67:AC:C8:C1`
- Secrets printed: false
- Keystore mutation: none

## Engineering source trace

- Android `Intent` reference (`ACTION_ASSIST`, `ACTION_DIAL`, `ACTION_VIEW`, `ACTION_INSERT`): https://developer.android.com/reference/android/content/Intent
- Android assistant/assist context guidance: https://developer.android.com/training/articles/assistant
- Android `AlarmClock` contract: https://developer.android.com/reference/android/provider/AlarmClock
- Android `CalendarContract.Events`: https://developer.android.com/reference/android/provider/CalendarContract.Events

No technical source is injected into the AGM user response. This source trace exists only as engineering evidence.
