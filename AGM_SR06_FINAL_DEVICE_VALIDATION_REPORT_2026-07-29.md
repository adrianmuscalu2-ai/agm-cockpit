# AGM — SR-06 Final Device Validation Report

Date: 2026-07-29  
Device: Samsung Galaxy S25 (`SM-S931B`)  
Android: 16 / SDK 36  
Verdict: **HOLD**

## 1. Authorized artifact

- `applicationId`: `com.agm.cockpit`
- `versionCode`: `15`
- `versionName`: `1.2.9-sr06-final`
- authorized SHA-256: `85C89D8B5C2C4287E2FCDFB806C8CCEA669E2945B5FF03ADE457E68422E7C55E`
- pre-install hash match: **PASS**

No rebuild, source change, configuration change, API change or infrastructure change was performed.

## 2. Single installation

The candidate was installed exactly once with data preservation:

```text
Performing Streamed Install
Success
```

Pre-install package:

- `versionCode=12`
- `versionName=1.2.6-stable-distribution`
- `firstInstallTime=2026-07-28 15:33:56`

Post-install package:

- `versionCode=15`
- `versionName=1.2.9-sr06-final`
- `lastUpdateTime=2026-07-29 23:26:07`
- `firstInstallTime=2026-07-28 15:33:56` — preserved

Installation count under the mandate: **1**.

## 3. Android launch and runtime

- Cold launch: **PASS**
- Main activity: `com.agm.cockpit/.MainActivity`
- Application remained responsive throughout the validation.
- No current-candidate fatal exception was observed.
- Existing application data and administrator profile were preserved.

## 4. Translator and live status

Human and instrumented evidence confirmed:

- Translator RO/DE operation: **PASS**
- Internet indicator: **online / green**
- AI Copilot indicator: **online / green**
- Translation indicator: **online / green**
- translated result displayed correctly: **PASS**

## 5. Diagnostics and administrative incident reporting

### Access control

- masked access gesture available: **PASS**
- missing/expired administrative session redirects to the existing Turn login: **PASS**
- access after administrator authentication: **PASS**

### Administrative report UI

- canonical categories available: **PASS**
- short description required: **PASS**
- empty description prevented report creation: **PASS**
- privacy warning displayed: **PASS**
- explicit statement excluding messages, profile, passwords, tokens and API keys: **PASS**

### `AdminIncidentReportV1`

The Android producer generated a standardized report and handed it to the Android e-mail chooser and Gmail composer.

- contract marker: `admin-incident-report.v1`
- unique incident ID: generated and included
- category: included
- application/device metadata: included
- source and per-status timestamps: included
- official report handoff to external e-mail application: **PASS**
- message transmission: **not performed**

Live report status evidence:

- Internet: `online · current`
- API: `online · current`
- AI: `online · current`
- Translation: `online · current`
- safe error message: `Nicio eroare tehnică sigură înregistrată.`

## 6. Controlled unavailability and recovery

Wi-Fi and mobile data were temporarily disabled through ADB:

- `Wi-Fi=0`
- `MobileData=0`

After the application health-check interval:

- application remained open and responsive;
- Internet indicator changed to red;
- AI indicator changed to red;
- Translation indicator changed to red;
- no crash occurred.

Both networks were restored:

- `Wi-Fi=1`
- `MobileData=1`
- Android connectivity returned to `CONNECTED / VALIDATED`;
- all three application indicators returned automatically to green.

Result: **offline behavior and automatic recovery PASS**.

## 7. Official addresses

### AGM Cockpit Web Application

Confirmed:

- `https://app.agmcockpit.com/`
- HTTP response: `200`
- page title: `A.G.M. Cockpit`

Verdict: **official Web Application address PASS**.

### AGM Cockpit public Website

No definitive public Website address could be confirmed:

- `https://agmcockpit.com/`: DNS resolution failed;
- `https://www.agmcockpit.com/`: DNS resolution failed;
- local Turn catalog records the separate `AGM Cockpit Web` production URL as `neconfigurat`;
- `https://agm-cockpit.pages.dev/` responds, but currently serves the Cockpit application and is documented as an application fallback, not as a separately approved public Website.

Verdict: **official public Website address HOLD**.

## 8. Candidate identity finding

The Android package identity is correct and the internal application version constant is `A.G.M. Cockpit 1.2.9`.

However, the active Home header visibly displays:

```text
Basic 1.2.6
```

The string is embedded and hard-coded in the approved candidate, including the synchronized Android asset. It is not a stale WebView cache value.

This creates a user-visible identity inconsistency against the approved final-candidate identity and the requirement that the displayed version correspond to the real application version.

Verdict: **displayed identity HOLD**.

## 9. Residual validation scope

Translator, Diagnostics, reporting, online/offline behavior and recovery were validated on the real device.

An additional full interactive Mail/OCR workflow was not used to override the two blocking findings above. Existing internal Android unit tests and prior field evidence remain valid, but the general audit cannot close while the identity and official Website findings remain unresolved.

## 10. Final verdict

### SR-06 — HOLD

Passed:

- unique authorized installation;
- correct Android package identity;
- application launch and stability;
- Translator;
- Diagnostics access control;
- `AdminIncidentReportV1`;
- masked report generation;
- external e-mail handoff;
- live diagnostic states;
- controlled offline behavior;
- automatic recovery;
- official Web Application address.

Blocking findings:

1. active candidate header displays `Basic 1.2.6`;
2. no definitive public AGM Cockpit Website address is configured/confirmable.

Consequences:

- SR-06 is not closed;
- the general audit is not authorized for closure;
- `AGM v1.2.9 Stable Baseline` is not constituted;
- no rebuild or additional installation is authorized by the completed mandate.

A separate remediation and candidate-replacement mandate is required before repeating only the affected final validation gates.
