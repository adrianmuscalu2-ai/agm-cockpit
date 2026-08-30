# AGM UI Android handoffs — final validation

Date: 2026-08-28 (Europe/Berlin)

## Scope

- Rename and isolate the two Android handoffs in Premium Copilot.
- Move the Android voice-settings handoff to Profile -> Android / Voce.
- Keep the internal AGM assistant (`POST /premium-assistant/respond`) unchanged.
- Validate 12/12 UI languages, controlled Browser, and the physical Android device.
- No publication, commit, push, DNS, tunnel, connector, or API-routing operation.

## Implementation

- `AI Android` -> `Deschide asistentul telefonului`, rendered only when `Capacitor.getPlatform() === 'android'`.
- `Intrebare catre AI` -> `Distribuie intrebarea`, Android-only; native behavior remains `Intent.ACTION_SEND`.
- The Android chooser receives the localized, generic share label; the legacy Romanian AI-specific chooser title was removed.
- `Setari AI` was removed from the Copilot action grid and moved to Profile -> `Android / Voce` -> `Setari voce Android`.
- OPENED, UNAVAILABLE, missing-text, and failure feedback is displayed in the current language.
- Android assistant/share handoff still emits `agm-android-assistant-handoff`, preserving the validated AGM TTS stop behavior.

## Automated validation

- `pnpm.cmd --filter @agm/web test:premium-copilot-c0` -> PASS.
  - 12/12 languages.
  - 13 Android UI keys per language.
  - no empty key in the Android UI namespace.
  - no legacy hardcoded Romanian labels.
  - exact Android platform gate present.
- `pnpm.cmd --filter @agm/web exec tsc --noEmit` -> PASS.
- `pnpm.cmd --filter @agm/web android:sync` -> PASS.
- Gradle `assembleDebug --offline --no-daemon --console=plain --max-workers=2` -> PASS (93 tasks).

## Browser validation

Controlled runner report:

- `browser/2026-08-28T14-01-09-027Z/report.json`
- Browser Plugin Status: PASS.
- Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE.
- Browser Session Status: PASS.
- Target Page Status: PASS.
- Desktop 1440x1000: PASS.
- Mobile 412x915: PASS.
- Android assistant controls: 0 in Browser.
- Android share controls: 0 in Browser.
- Android voice-settings sections: 0 in Browser.
- Internal AGM assistant start/transcript/confirm controls: present.
- Horizontal overflow: false.

## Physical Android validation

Device:

- serial: `RFCY70WDHXK`
- model: Samsung `SM-S931B`
- device: `pa1q`
- Android: 16

Installed build:

- package: `com.agm.cockpit`
- versionCode: 21
- versionName: 1.3.0
- lastUpdateTime: `2026-08-28 21:11:15`
- APK SHA-256: `6C93CF9E2C4904DA14D986A2556C9F23AE051A61FF6BEAB91C96D7D3D6C9A6E5`
- the pulled installed `base.apk` has the same SHA-256 as the source APK.

Runtime results:

- `Deschide asistentul telefonului`: PASS.
  - physical tap executed;
  - native `AgmCapability.launchAssistant` callback recorded;
  - Google assistant package activity recorded by Android;
  - AGM feedback: `Asistentul telefonului a fost deschis.`
- `Distribuie intrebarea`: PASS.
  - physical text `AGM_TEST_DISTRIBUIRE_2026` entered;
  - Android `ChooserActivityLauncher` became the focused activity;
  - chooser exposed generic share targets, including non-AI applications;
  - AGM feedback: `Selectorul de distribuire a fost deschis.`
- `Setari voce Android`: PASS.
  - control visible only under Profile -> Android / Voce;
  - physical tap opened `com.android.settings.Settings$ManageAssistActivity`;
  - AGM feedback after return: `Setarile de voce Android au fost deschise.`

Physical evidence directory: `physical/2026-08-28T21-11-15/`

Key files:

- `copilot-actions2.png` — both renamed Android-only controls.
- `assistant-opened.png` — assistant OPENED feedback.
- `share-chooser.png` and `share-chooser.xml` — real Android ACTION_SEND chooser.
- `share-return.png` — share OPENED feedback.
- `profile-android-voice.png` — moved settings control.
- `voice-settings-opened2.png` and `voice-settings-opened2.xml` — real Android settings activity.
- `voice-settings-return.png` — settings OPENED feedback.
- `installed-base.apk` — exact installed package pulled from the device.

## Internal AGM AI integrity

The internal AGM assistant route and its core client/service/contract were not changed by this mandate.

- `premium-assistant.client.ts`: `F6ADD5D605D979D7C7D1695132A9032BC572DA1C24665F6DEC3DCCE158A78A44`
- `premium-assistant.service.ts`: `5003049CA7D2789411C1A3BE1D4A6F0E3CF47180C0EC0C855DC1DE3F93A53F58`
- `premium-assistant.contract.ts`: `24A2575E2B40BB802FDCCD5C23B98332B1B8C955FD956E24A007A2AD86DA43BA`

## Verdict

- BROWSER VISUAL CHECK = PASS
- ANDROID PHYSICAL INTENTS = PASS
- ANDROID-ONLY VISIBILITY = PASS
- I18N 12/12 = PASS
- OPENED / UNAVAILABLE FEEDBACK CONTRACT = PASS
- INTERNAL AGM AI UNCHANGED = PASS
- PUBLICATION = NOT EXECUTED
