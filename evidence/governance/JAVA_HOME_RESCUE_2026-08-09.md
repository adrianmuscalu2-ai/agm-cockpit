# Rescue — permanent JAVA_HOME configuration — 2026-08-09

## Classification and requirement

- Classification: `DEFECT DE CONFIGURARE`.
- Required Java: JDK 21, proved by
  `apps/web/android/app/capacitor.build.gradle` source and target compatibility
  `JavaVersion.VERSION_21`.
- Build stack: Gradle 8.14.3, Android Gradle Plugin 8.13.0, compile/target SDK 36.

## Existing installation selected

- Source: bundled JetBrains Runtime from the existing official Android Studio
  installation.
- Path: `C:\Program Files\Android\Android Studio\jbr`.
- Java: OpenJDK 21.0.10, JetBrains build `21.0.10+-14961533-b1163.108`.
- `java.exe` and `javac.exe`: present.
- No JDK was installed or removed.

## Change record

| Setting | Old value | New value | Rollback |
|---|---|---|---|
| User `JAVA_HOME` | absent | `C:\Program Files\Android\Android Studio\jbr` | remove user variable |
| User `Path` | `C:\Users\adria\.local\bin;C:\Users\adria\AppData\Local\Microsoft\WindowsApps;C:\Users\adria\AppData\Local\Programs\Microsoft VS Code\bin;C:\Users\adria\AppData\Roaming\npm;C:\Users\adria\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin` | prepend `%JAVA_HOME%\bin`; preserve all existing entries | restore captured old value |
| Gradle `org.gradle.java.home` | absent | selected JBR path | remove property |
| VS Code Java/Gradle homes | absent | selected JBR path | remove three settings |
| VS Code PowerShell terminal environment | absent | JAVA_HOME and JBR `bin` prefix | remove profile `env` block |

Reason: make Java resolution deterministic for PowerShell, new terminals, VS
Code, Gradle, and Android builds without relying on a guessed or missing path.

## Validation journal

| Test | Result |
|---|---|
| Persistent user `JAVA_HOME` | PASS — `C:\Program Files\Android\Android Studio\jbr` |
| Persistent user `Path` | PASS — `%JAVA_HOME%\bin` prepended; prior entries preserved |
| Target existence | PASS — `bin\java.exe` and `bin\javac.exe` exist |
| `java -version` | PASS — OpenJDK 21.0.10 JetBrains Runtime |
| `javac -version` | PASS — 21.0.10 |
| New PowerShell terminal | PASS — resolved persisted `JAVA_HOME` and selected `java.exe` |
| VS Code restart persistence | PASS — workspace JSON parses; Java language server, Gradle import, Gradle and new PowerShell terminal profiles all persist the validated JBR path |
| `gradlew --version` | PASS — Gradle 8.14.3; Launcher JVM 21.0.10; Daemon JVM selected from `org.gradle.java.home` |
| Android `assembleDebug` | PASS — `BUILD SUCCESSFUL`; 93 tasks up-to-date |
| APK | PASS — `app-debug.apk`; SHA-256 `08B4C32401EE2B70EC2ADA7EAF35BE5D98BFEFF2DB925F4D6A6D883434DF0A49` |

The first wrapper attempt proved Java startup but could not download Gradle
inside the restricted network sandbox. The authorized retry used the exact
project wrapper distribution and completed successfully. No alternative JDK,
Gradle, plugin, extension, or runtime was installed.

## Rollback

1. Restore the captured old user `Path` above.
2. Remove the user `JAVA_HOME` value.
3. Remove `org.gradle.java.home` from Android `gradle.properties`.
4. Remove the three VS Code Java/Gradle home settings and the PowerShell profile
   `env` block.
5. Broadcast Windows `WM_SETTINGCHANGE` for `Environment` or sign out/in.

No installed JDK needs removal for rollback.

## Verdicts

- `JAVA_HOME — PERMANENTLY CONFIGURED`
- `JAVA / GRADLE / ANDROID COMPATIBILITY — PASS`
- `NEW TERMINAL VALIDATION — PASS`
- `VS CODE RESTART VALIDATION — PASS`
- `DEPENDENCY INSTALLATION POLICY — ACTIVE`
- `NO SPECULATIVE INSTALLATIONS`
