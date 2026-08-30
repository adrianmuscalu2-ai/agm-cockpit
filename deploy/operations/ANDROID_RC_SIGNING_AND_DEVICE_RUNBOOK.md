# Android RC signing and physical-device gate

This runbook is release-engineering only. It does not authorize publication,
deployment, commit, push, or replacement of an existing Play signing key.

## Fixed release identity

- application ID: `com.agm.cockpit`
- version name: `1.3.0`
- version code: `21`
- output: `apps/web/android/app/build/outputs/bundle/release/app-release.aab`

## Existing keystore

If an AGM-owned production/upload keystore already exists, reuse it. Do not
create a second identity. Keep the file outside the repository and configure
the four process/CI secrets:

- `AGM_ANDROID_RELEASE_KEYSTORE`
- `AGM_ANDROID_RELEASE_STORE_PASSWORD`
- `AGM_ANDROID_RELEASE_KEY_ALIAS`
- `AGM_ANDROID_RELEASE_KEY_PASSWORD`

Do not use `.env`, `setx`, shell history, issue trackers, chat, screenshots, or
Git for passwords. Run `pnpm --filter @agm/web android:release-preflight`; it
prints only the keystore hash, alias-validation result, certificate validity,
and SHA-1/SHA-256 fingerprints.

## New keystore, only when Product Owner confirms none exists

1. Create an access-controlled directory outside the repository, for example
   `%LOCALAPPDATA%\AGM\secrets\android`.
2. From a private interactive terminal run the JBR `keytool` below. Omit
   password arguments so `keytool` prompts securely:

   ```powershell
   & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair `
     -keystore "$env:LOCALAPPDATA\AGM\secrets\android\agm-release.p12" `
     -storetype PKCS12 -alias agm-release -keyalg RSA -keysize 4096 `
     -sigalg SHA256withRSA -validity 9125
   ```

3. Back up the keystore and recovery material in the Product Owner-approved
   secure vault. Losing this material may prevent future signed updates.
4. Inject the four variables only into the current trusted release process or
   CI secret store. Clear the process environment after validation.

## AAB build and verification

Run from the repository root:

```powershell
pnpm --filter @agm/web android:release-preflight
pnpm --filter @agm/web android:aab
pnpm --filter @agm/web android:aab:validate
```

The last command fails unless the AAB is release-signed, structurally valid,
uses the fixed application/version metadata, and is not Android Debug signed.
Record the AAB SHA-256 and signer certificate fingerprints; never record
passwords.

## Physical device

1. Connect one physical Android device by USB, enable USB debugging, and accept
   the device-side RSA authorization prompt.
2. Confirm `adb devices -l` shows exactly one non-emulator device in state
   `device`.
3. Generate/install device APKs from the signed AAB with an official pinned
   `bundletool` release. Keep `bundletool`, `.apks`, and extracted APKs in the
   external release-artifact directory, not Git.
4. Install as an upgrade without clearing application data; record package
   `versionName=1.3.0` and `versionCode=21`.
5. Execute and capture the RC matrix: launch, authentication/session, Basic,
   Premium, Car Mover, Copilot, microphone, camera, STT, TTS, stale-turn
   cancellation, assistant handoff, mobile data, Wi-Fi, offline/reconnect,
   background/resume, restart, permissions, crash check, orientation and
   supported deep/app links.
6. A missing device, permission, provider account, or network mode is a failed
   gate, never an inferred PASS.

## Reproducible Gradle path

- wrapper: Gradle `8.14.3-all`
- Android Gradle Plugin: `8.13.0`
- Google Services plugin: `4.4.4`
- Java: Android Studio JBR configured in `gradle.properties`
- SDK: compile/target 36; minimum 24

Prime dependencies once from the official Gradle, Google and Maven Central
repositories using the same `GRADLE_USER_HOME`. Then verify the identical build
with `--offline`. Do not copy an unrelated user's cache and do not vendor
third-party binaries into the repository.

The controlled 2026-08-30 check completed an online build followed by an
offline/cache-only build successfully. The earlier sandbox-only
`native-platform.dll` error is an execution isolation limitation, not a Gradle
project dependency failure.
