# AGM OCR Archive Contract V1

**Status:** Design approved for implementation  
**Scope:** AGM Basic 1.3.x — local Document OCR archive  
**Contract owner:** Frontend Experience / OCR Maintainer

## 1. Product contract

The OCR archive is optional and local to the current device. Document capture,
OCR review, copy, and handoff to Translator must remain available when the
archive is disabled or unused.

No image, extracted text, corrected text, title, or document identifier may be
uploaded, logged, or included in monitoring. Saving is always an explicit user
action. Profile activation is not required.

The first increment provides:

- a dedicated `/ocr` route;
- camera capture and image import;
- local OCR preview, confidence, and editable extracted text;
- copy and controlled handoff to Translator;
- explicit save, reopen, and individual or complete deletion;
- a visible local-only notice and recoverable error states.

Search, folders, tags, cloud synchronization, automatic upload, automatic
classification, and safety-critical decisions are outside this increment.

## 2. Data and retention

The canonical archive uses an asynchronous local repository. Images and
thumbnails are stored as binary objects rather than Base64 strings. The legacy
`agm.ocr.history.v1` history remains readable during the compatibility window
and must not be destructively migrated.

Default retention:

- at most 30 unpinned documents;
- at most 30 days for unpinned documents;
- at most 100 total documents and 50 MiB;
- pinned documents are never silently removed;
- when safe retention cannot be enforced, a new save is rejected explicitly.

Deletion must remove the selected record and its binary content. Complete
deletion must clear the archive without affecting the ability to use OCR.

## 3. Responsible agents

### Drafting and documentation

**Owner:** Documentation agent.  
Maintains this contract, user help, privacy wording, changelog, and the exact
description of local storage. It does not issue the final quality verdict.

### Monitoring

**Owner:** Monitoring Department, read-only mandate.  
May observe only aggregated technical signals: repository availability, item
count, storage pressure, migration state, processing duration band, and error
category. It must never collect document content, filenames, images, titles,
contact data, or OCR output.

### Maintenance

**Owner:** OCR/Web Maintainer under Frontend Experience.  
Owns schemas, migrations, compatibility, retention, cleanup, recovery, and the
maintenance runbook. Every schema change requires a versioned migration and a
rollback-safe compatibility decision.

### Independent validation

**Owners:** OCR QA and Architecture Guardian.  
QA validates behavior, Browser/Android use, accessibility, and offline
operation. Architecture Guardian verifies boundaries, privacy, storage, and
regression contracts. Turn Commander approves the final release verdict;
Version Guardian records the accepted baseline.

## 4. PASS criteria

PASS requires all of the following:

1. OCR works without profile and without saving.
2. Saving is explicit and the interface states that the archive is local.
3. Reopen, edit, copy, Translator handoff, individual deletion, and complete
   deletion are verified.
4. Network interception confirms zero document-content uploads.
5. Corrupt storage, quota pressure, unsupported files, no-text, low-quality,
   offline use, restart, and denied camera permission fail safely.
6. OCR-derived strings are escaped and cannot inject executable markup.
7. Monitoring and logs contain no document content.
8. Romanian, German, and English UI, keyboard operation, screen-reader status,
   focus behavior, and mobile touch targets are validated.
9. TypeScript, build, storage, navigation, OCR controller, Browser, Android,
   and regression suites pass.
10. Documentation, privacy wording, maintenance runbook, and the independent
    QA/architecture verdict are recorded.

## 5. NO-GO conditions

Automatic saving without consent, any document upload, unconfirmed OCR text
used as authoritative data, incomplete deletion, destructive migration,
unbounded retention, private content in logs/monitoring, or claims of encryption
not provided by the platform are release blockers.
