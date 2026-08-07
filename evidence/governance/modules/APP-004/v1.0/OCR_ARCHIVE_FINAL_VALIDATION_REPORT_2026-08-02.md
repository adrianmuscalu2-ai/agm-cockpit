# OCR Archive final validation report — 2026-08-02

**Module:** APP-004 / AGM Basic OCR Archive  
**Candidate:** AGM Cockpit 1.3.0  
**Overall verdict:** PASS FINAL / CLOSED

## 1. Browser

**Verdict: PASS — operator-assisted practical validation**

The VS Code integrated browser was visible to the Product Owner but was not
exposed to the automation control channel. The Product Owner executed the
protocol manually and supplied photographic evidence for every state:

1. `/ocr` loaded and accepted a local image.
2. OCR produced editable extracted text.
3. A unique Browser validation marker was added.
4. Explicit save changed the archive count from zero to one and displayed the
   saved document.
5. Browser reload preserved the archive record.
6. Reopen restored the edited content.
7. Send to Translator opened the Translator and preserved the edited marker.
8. Individual deletion returned the archive to zero and the empty state.

The Browser privacy canary had zero matches in project/runtime log files. The
static monitoring privacy validator and logical zero-fetch validation remained
PASS. This operator-assisted evidence is accepted because the Browser UI was
real and visible even though its automation binding was unavailable.

## 2. Android

**Device:** Samsung SM-S931B (`RFCY70WDHXK`)  
**Package:** `com.agm.cockpit`  
**Verdict: PASS**

Executed evidence:

1. Capacitor synchronization completed.
2. Gradle `assembleDebug` completed: 93 tasks, BUILD SUCCESSFUL.
3. The debug APK installed through ADB: `Success`.
4. `/ocr` loaded in the real Capacitor WebView.
5. A 575×836 local test image was supplied through the real file input.
6. OCR completed locally with 91% confidence and 367 extracted characters.
7. Extracted text was edited with a unique synthetic marker.
8. Explicit save created one IndexedDB v2 archive record.
9. Temporary OCR state was cleared while the archive record remained.
10. After Android force-stop and restart, the record remained available.
11. Reopen restored the complete edited text.
12. Send to Translator navigated to `/translator` and preserved the marker.
13. With Wi-Fi and mobile data disabled, `/ocr` loaded, `navigator.onLine` was
    false, and the archived record remained available.
14. Wi-Fi and mobile data were restored immediately after the offline test.
15. Individual deletion removed the archive card and produced IndexedDB count
    zero. A second force-stop/restart confirmed zero records persisted.

## 3. Resilience

- force-stop/restart persistence: **PASS**;
- offline archive read: **PASS**;
- IndexedDB unavailable fallback to legacy v1: **PASS**;
- practical v1→v2 migration: **PASS**;
- migration marker written: **PASS**;
- legacy v1 record retained during migration: **PASS**;
- synthetic test data cleanup: **PASS**.

The final clean runtime state was:

```text
IndexedDB archive count: 0
Legacy OCR history key: absent
Migration v2 marker: present
Network state: online
```

## 4. Privacy

Three unique private-data canaries were used for the edit, migration, and
fallback paths. ADB logcat contained zero matches for all three. Static
monitoring/diagnostic privacy validation and logical zero-fetch tests also
passed. No document content was found in monitoring or diagnostic output.

## 5. Automated validations

PASS:

- TypeScript `tsc --noEmit`;
- production web build;
- OCR archive repository CRUD;
- v1→v2 migration and idempotency;
- logical E2E, restart, offline, deletion, and log privacy;
- APP-004 OCR contract;
- APP-009 storage/offline contract;
- SR-03 app-shell routes/modules;
- SR-05 storage registry/repository parity;
- SR-07D OCR controller characterization;
- SR-08D OCR composed state;
- SR-14 CSS/i18n/accessibility;
- Android Capacitor sync, APK build, installation, and physical-device flow.

## 6. Files in the OCR Archive change set

- `AGM_OCR_ARCHIVE_CONTRACT_V1.md`
- `apps/web/src/main.ts`
- `apps/web/src/app-shell/app-state.contract.ts`
- `apps/web/src/app-shell/navigation.contract.ts`
- `apps/web/src/app-shell/view-module.registry.ts`
- `apps/web/src/ocr/ocr-document.contract.ts`
- `apps/web/src/storage/ocr-archive.repository.ts`
- `apps/web/src/storage/ocr-archive.migration.ts`
- `apps/web/src/i18n/app-i18n.dictionary.ts`
- `apps/web/src/styles/20-domain-tools.css`
- `apps/web/scripts/test-ocr-archive-repository.ts`
- `apps/web/scripts/test-ocr-archive-migration.ts`
- `apps/web/scripts/test-app004-ocr-archive-logical-e2e.ts`
- `apps/web/scripts/test-app004-ocr-monitoring-privacy.ts`
- `apps/web/scripts/test-sr03-app-shell-contracts.ts`
- `apps/web/scripts/test-sr14-css-i18n-accessibility.ts`
- `evidence/governance/modules/APP-004/v1.0/OCR_ARCHIVE_OPERATIONS_RUNBOOK.md`
- `evidence/governance/modules/APP-004/v1.0/OCR_ARCHIVE_VALIDATION_CANDIDATE.md`
- this report.

The worktree also contains unrelated/pre-existing user changes; they are not
claimed as part of this module.

## 7. Closure decision

Android is **PASS**. Browser is **PASS**. Repository, migration, resilience,
offline behavior, privacy, accessibility, i18n, build, and deletion gates are
PASS. The Product Owner supplied the required final Browser evidence.

**OCR ARCHIVE — PASS FINAL**  
**APP-004 — CLOSED**

No additional product development is authorized by this report. Future changes
require a governed successor version or explicit change record.
