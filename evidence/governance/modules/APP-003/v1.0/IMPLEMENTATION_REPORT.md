# APP-003 — Raport de implementare incrementală

**Stare:** IMPLEMENTED / INTERNALLY VALIDATED  
**Închidere finală:** PENDING USER VALIDATION  
**Data:** 1 august 2026  

## Implementat

- selecție, listare și eliminare de atașamente;
- limite: 5 fișiere, 10 MiB/fișier, 20 MiB total;
- payload controlat cu nume, MIME, dimensiune și Base64;
- e-mail Android cu atașamente prin cache, FileProvider și grant read-only;
- păstrarea exactă a `ACTION_SENDTO/mailto` pentru e-mail fără atașamente;
- Browser: blocare explicită a atașamentelor e-mail nesuportate, fără promisiune falsă;
- WhatsApp Share prin share sheet generic, fără package pinning, destinatar sau auto-send;
- preview și confirmare obligatorie pentru e-mail și share;
- mesaje RO/DE/EN și fallback-uri controlate;
- curățarea cache-ului temporar înaintea unui nou handoff;
- test automat dedicat contractelor APP-003.

## Fișiere principale

- `apps/web/src/mailmaster/mail-attachments.ts`
- `apps/web/src/native-email.ts`
- `apps/web/src/main.ts`
- `apps/web/src/i18n/app-i18n.dictionary.ts`
- `apps/web/android/app/src/main/java/com/agm/cockpit/AgmEmailPlugin.java`
- `apps/web/android/app/src/main/AndroidManifest.xml`
- `apps/web/android/app/src/main/res/xml/file_paths.xml`
- `apps/web/scripts/test-app003-mail-attachments-share.ts`

## Compatibilitate și rollback

Fluxul istoric fără atașamente nu a fost înlocuit. Câmpul `attachments` este opțional. Eliminarea UI-ului nou și ignorarea câmpului opțional restabilește baseline-ul fără migrare de date.

## Artefact

- APK: `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`
- Dimensiune: 22,294,086 bytes
- SHA-256: `455aee7571e9a0636253a81e31b474d4cd8e2104ed2a7714809c92d93c524c78`

