# AGM — Final SR-06 Validation Candidate Artifact Report

Date: 2026-07-29  
Mandate: Final SR-06 Validation Candidate  
Verdict: **CANDIDATE GENERATED / INTEGRITY PASS / READY FOR SINGLE DEVICE INSTALLATION**

## 1. Execution scope

The approved Android candidate was generated exactly once from the Readiness Gate-approved source state.

- `assembleDebug` executions under this mandate: **1**
- Result: **BUILD SUCCESSFUL**
- Gradle tasks: **93 actionable tasks — 28 executed, 65 up-to-date**
- Functional or source-code changes during candidate generation: **none**
- Additional rebuilds: **none**
- Device access or installation: **none**

The generic Gradle output was moved, without modification or rebuilding, to the canonical candidate filename.

## 2. Canonical artifact

- File: `apps/web/android/app/build/outputs/apk/debug/AGM-Cockpit-1.2.9-sr06-final.apk`
- SHA-256: `85C89D8B5C2C4287E2FCDFB806C8CCEA669E2945B5FF03ADE457E68422E7C55E`
- Size: `22,119,335 bytes`
- Artifact timestamp (UTC): `2026-07-29T21:05:13.4924935Z`
- Artifact timestamp (Europe/Berlin): `2026-07-29 23:05:13.4924935 +02:00`

The hash above is the immutable identity to be checked again immediately before the separately authorized single installation.

## 3. Approved identity

Android manifest inspection with Android Build Tools `aapt` confirmed:

- `applicationId`: `com.agm.cockpit`
- `versionCode`: `15`
- `versionName`: `1.2.9-sr06-final`
- Application label: `A.G.M. Cockpit`
- Launch activity: `com.agm.cockpit.MainActivity`

Embedded content inspection confirmed:

- UI identity: `A.G.M. Cockpit 1.2.9`
- Service Worker cache identity: `agm-cockpit-1.2.9`
- Internal incident contract marker: `admin-incident-report.v1`

The generated artifact therefore corresponds to the identity approved by the Readiness Gate.

## 4. Integrity verification

### APK signature

Android Build Tools `apksigner verify --verbose --print-certs` returned `Verifies`.

- Verified APK Signature Scheme: **v2**
- Signers: **1**
- Certificate: `C=US, O=Android, CN=Android Debug`
- Certificate SHA-256: `287319D9C7540A9B48B63C1F5DF99CAFB0284A3E80FB603AF8FEF4F2AAB7743`
- Key: RSA, 2048 bits

This is the authorized debug validation artifact, not a production-release publication artifact.

### Archive structure

The APK was opened as a ZIP archive and every entry stream was read fully:

- Entries: **461**
- Uncompressed bytes read: **28,796,891**
- Read/structure errors: **0**
- Embedded Service Worker present: **PASS**
- Embedded UI version present: **PASS**
- Embedded `AdminIncidentReportV1` marker present: **PASS**

### Runtime manifest essentials

The manifest contains the expected application identity and the required network permissions:

- `android.permission.INTERNET`
- `android.permission.ACCESS_NETWORK_STATE`

No artifact mutation occurred during any integrity check.

## 5. Protected-state verification

Post-generation hashes matched the pre-generation baseline for the approved identity and protected contract files, including:

- Android `build.gradle`
- Web `main.ts`
- source and Android-synchronized Service Worker
- `AdminIncidentReportV1` contract
- Transports public controller
- Prisma schema

The build introduced no source-code diff. Pre-existing working-tree changes from the completed and approved increments were not altered by candidate generation.

Confirmed untouched:

- public API and DTO contracts;
- Prisma schema;
- Diagnostics and `AdminIncidentReportV1`;
- production and infrastructure;
- competition materials and their protection register;
- Android device and currently installed application.

## 6. APK inventory

The controlled delivery inventory remains **five artifacts**:

- four historical distribution copies remain byte-for-byte unchanged:
  - size: `7,604,172 bytes`;
  - SHA-256: `C270161B6639ACA61534DF5C86F03ED0038F02B86EB9C08926C96B31A8D943F5`;
  - timestamp (UTC): `2026-07-26T23:29:26.4199988Z`;
- one newly authorized Final SR-06 Validation Candidate, identified in section 2.

Android synchronized asset copies and Gradle intermediate copies of historical downloads are technical build inputs/intermediates and are not additional delivery candidates.

## 7. Operational status and handoff

- Final SR-06 Validation Candidate: **GENERATED / INTEGRITY PASS**
- Candidate rebuild: **not authorized**
- Device installation: **not performed; requires the next operational mandate**
- Final Device Validation SR-06: **not started**
- SR-06: **ON HOLD / Pending Final Device Validation**

The only candidate authorized for the next single installation is the file and SHA-256 recorded in section 2.
