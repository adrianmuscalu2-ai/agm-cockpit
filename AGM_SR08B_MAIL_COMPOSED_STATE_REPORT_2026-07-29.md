# AGM — SR-08B Mail Composed State Migration

Date: 2026-07-29  
Scope: Mail state only  
Verdict: **PASS**

## Result

All 18 Mail-owned fields now have one canonical runtime owner in `MailState`.
`LegacyAppStateFacade` remains compatible through enumerable getter/setter
properties bound directly to that state. No copied state or dual-write exists.

The SR-07B Mail controller receives `MailState` explicitly. Existing shell,
Contacts and Translator handoffs continue through the facade and observe the
same values. UI, behavior, message-library persistence and storage keys are
unchanged. TranslatorState from SR-08A remains separate and unchanged.

## Files affected

- `apps/web/src/app-shell/mail-state.store.ts`
- `apps/web/src/mailmaster/mail.controller.ts`
- `apps/web/src/main.ts`
- `apps/web/scripts/test-sr08b-mail-composed-state.ts`
- `apps/web/scripts/test-mc3a-main-characterization.ts`
- `apps/web/scripts/test-sr03-app-shell-contracts.ts`
- `apps/web/package.json`
- this report

Structural tests still verify the complete 65-field legacy surface and exact
single ownership after composition.

## Validation

| Gate | Result |
|---|---|
| Mail canonical state ↔ legacy accessor parity | PASS |
| No facade value properties / no dual-write | PASS |
| SR-07B controller compatibility | PASS |
| TypeScript / complete MC-3A | PASS |
| 65 legacy fields, exactly one owner | PASS |
| SR-01–SR-08A regression shield | PASS |
| Web graph | PASS — 156 files, 0 cycles |
| API graph | PASS — 70 files, 0 cycles |
| Web build | PASS — 174 modules |
| Browser E6.3 and E6.4–E6.6 | PASS |
| API | PASS — 8 suites, 31 tests; build PASS |
| Android | BUILD SUCCESSFUL — 102 tasks |

Synchronized APK:
`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`
(22,277,627 bytes).

## Protection

Contacts, OCR, Incident and Diagnostics implementations were not changed.
SR-06 remains ON HOLD. Competition hashes remain identical to the protection
register. The Diagnostics plugin remains
`258B4A0458D93A4737A448650A8F42388FDC3E677A62D83B113994215CCB9D7B`.
Production and infrastructure were untouched.

## Rollback and recommendation

Rollback restores the 18 Mail initializers in `main.ts`, removes the Mail
facade attachment and stops passing `mailState` to the SR-07B controller. No
storage or native rollback is required.

**SR-08B PASS.** Continue only through another separately authorized,
single-domain state increment.
