# A.G.M. Cockpit v0.1-test - Android internal test

This package prepares A.G.M. Cockpit as a PWA and as an Android test APK through Capacitor.

## Generate the APK

Prerequisites:

- Node.js and pnpm through Corepack.
- Java JDK installed and `JAVA_HOME` configured.
- Android Studio or Android SDK installed.

From the repository root:

```bash
corepack pnpm install
corepack pnpm web:build
corepack pnpm android:sync
corepack pnpm android:apk
```

The debug APK is generated at:

```text
apps/web/android/app/build/outputs/apk/debug/app-debug.apk
```

## Install on Android

1. Copy `app-debug.apk` to the Android phone.
2. Open the APK on the phone.
3. Allow installation from the selected source if Android asks for it.
4. Open **A.G.M. Cockpit** after installation.

This APK is only for trusted internal testing. It is not prepared for Play Store publication.

## Required permissions

- **Camera**: required when the user starts Camera OCR and photographs a document.
- **Microphone**: required for voice dictation.
- **Internet**: required for translation requests through the configured API.

The APK does not contain API keys. Do not add `.env` files or real secrets to the Android project.

## Backend/API note

For phone testing, the app must be built with an API URL reachable from the phone.

Example for local Wi-Fi testing:

```bash
VITE_AGM_API_BASE_URL=http://YOUR_COMPUTER_LAN_IP:3000/api/v1 corepack pnpm web:build
corepack pnpm android:sync
corepack pnpm android:apk
```

Do not use `127.0.0.1` for phone testing unless the API also runs on the phone.

## Feedback collection

Ask testers to report:

- Android phone model and Android version.
- Whether install succeeded.
- Whether microphone permission appeared and dictation worked.
- Whether Camera OCR opened the rear camera, retained permission, and transferred readable text into the translator.
- Whether Email Assistant transferred translated text and opened the configured mail client with recipient, subject, formatting, and diacritics intact.
- Whether the Advanced Message Library categories, RO/DE/EN templates, variables, search, favorites, and recent history worked without Email Assistant regressions.
- Whether the Turn incident journal preserved complete history, enforced validation evidence, reopened incidents, filtered records, and exported the audit report.
- Whether Turn displays the official Maintenance, Quality and Evolution Department, all five directors, authority boundaries, and mandatory operational workflow in RO/DE/EN.
- Translation direction tested.
- E-mail Assistant actions tested.
- Screenshots or screen recordings for visual issues.
- Any confusing labels, slow actions, or broken flows.
