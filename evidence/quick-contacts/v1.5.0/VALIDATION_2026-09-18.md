# Raport de validare — Contacte personale AGM v1.5.0

Data: 2026-09-18 (Europe/Berlin)

## Verdict final

**PASS**, cu limitare controlată pentru handoff-ul Messenger: persoana și identificatorul Messenger sunt rezolvate corect din Profil, dar buildul v1.5.0 declară ținta Android Messenger `CAPABILITY_NOT_ALLOWLISTED`, astfel încât nu execută nicio acțiune externă.

Verdictul este acordat după implementarea structurii Profil/Premium → Contacte personale AGM, rebuild release semnat, instalare și teste fizice pe Samsung SM-S931B. Dovezile v1.4.0 nu sunt reutilizate.

## Identitatea buildului și a dispozitivului

- Dispozitiv: Samsung SM-S931B, serial `RFCY70WDHXK`, product `pa1qxeea`.
- Pachet: `com.agm.cockpit`.
- Build instalat: `versionName=1.5.0`, `versionCode=27`.
- `lastUpdateTime=2026-09-18 18:25:46`.
- AAB SHA-256: `55622326ADFD825F88EB3C57A40C85E57B857866F5B1556A9B148C929BE8859B`.
- APKS SHA-256: `6990CC9B6E594A1D1A23B877E9C4FFF2DC24D30268E0CD736734C9CD9C475D2F`.
- Universal APK SHA-256: `357F45C89E908CE69B02D54CA7A2CF75B094280AC96B795AA4EB2CD0523D6EA6`.
- Certificat release SHA-256: `6E:18:2B:67:BD:A9:E4:C4:F6:EE:93:D7:95:F6:19:AF:06:88:D3:96:7F:9B:74:B5:37:9A:42:FE:67:AC:C8:C1`.
- `android.permission.READ_CONTACTS: granted=false` pe toată matricea finală.

## Implementare validată

- Profil → Premium conține secțiunea „Contacte personale AGM”.
- O persoană are o singură înregistrare extensibilă: nume, companie, telefon, Gmail/e-mail, Messenger, WhatsApp, adresă, note și categorii.
- Limita rămâne maximum 20 de persoane, nu 20 de canale separate.
- Contactele introduse voluntar sunt persistate local și sunt sursă internă autorizată `AGM_PERSONAL_CONTACTS`; citirea lor nu cere `READ_CONTACTS`.
- Contactele rapide și Profilul folosesc același serviciu și același resolver, fără dublarea persoanei pe canal.
- Parserul normalizează „Apelează contactul Mona Vodafone” și „Apelează Mona Vodafone” la același nume.
- Sunt rezolvate comenzile pentru telefon, Gmail și Messenger, inclusiv „Apelează Mona pe Messenger.” ca chat Messenger, nu apel telefonic.
- Doar telefonul cere confirmare AGM expresă; după confirmare se folosește exclusiv `ACTION_DIAL`.
- Duplicatele cu același nume produc `CLARIFICATION_REQUIRED`, fără alegere automată și fără țintă Android.
- Integrarea/autorizarea Gmail și controalele speciale Bibliotecă Premium nu au fost modificate.
- Markerul de build vizual/cache este `agm-cockpit-1.5.0-personal-contacts-v3-20260918`.

## Test fizic — creare, editare și persistență

În UI-ul Profil/Premium a fost creată și editată persoana `Mona Vodafone`, companie `Vodafone`, telefon `0700123456`, Gmail/e-mail `mona.vodafone@example.com`, Messenger `mona.vodafone`.

Managerul afișează explicit că datele sunt o sursă internă autorizată și nu necesită `READ_CONTACTS`. După `am force-stop com.agm.cockpit` și relansare, toate câmpurile au rămas disponibile resolverului.

Dovezi: `v3/213-v3-profile-personal-contacts-open.png`, `v3/214-v3-personal-contact-manager.png`, `v3/217-v3-edit-saved.png`, `v3/220-v3-after-force-stop-home.png`.

## Test fizic — telefon și confirmare

Comanda exactă `Apelează contactul Mona Vodafone` a produs înainte de orice handoff:

    Contact selectat: Mona Vodafone
    Număr: 0700123456
    Sursă: Contacte personale AGM
    Confirmă pentru a deschide dialerul Android.
    Apelul nu va fi inițiat automat.

În această stare AGM a rămas în prim-plan, targetul era `null`, iar rezultatul era `CONFIRMATION_REQUIRED`. După singura confirmare expresă, Samsung Dialer s-a deschis cu `android.intent.action.DIAL`, `tel:0700123456`, `launchedFromPackage=com.agm.cockpit`. `mCallState=0`; apelul nu a fost inițiat automat.

Dovezi: `v3/225-v3-exact-command-before-submit.png`, `v3/226-v3-dial-preview-no-handoff.png`, `v3/226-v3-dial-preview.log`, `v3/227-v3-action-dial-no-call.png`, `v3/227-v3-action-dial-proof.txt`.

## Test fizic — Gmail

Comanda `Trimite un Gmail lui Mona Vodafone.` a rezolvat adresa din aceeași persoană și a deschis Gmail Compose prin `ACTION_SENDTO mailto:mona.vodafone%40example.com`. Nu a fost introdusă confirmare AGM suplimentară, nu a apărut reautorizare Gmail și mesajul nu a fost trimis.

Dovezi: `v3/228-v3-gmail-draft-no-send.png`, `v3/228-v3-gmail-proof.txt`, `v3/228-v3-gmail-instrumentation.txt`.

## Test fizic — Messenger

Comanda `Deschide Messenger la Mona.` a rezolvat `Mona Vodafone` și valoarea `mona.vodafone` cu motivul `AGM_PERSONAL_CONTACT_MESSENGER_RESOLVED`. Stratul Android a returnat `UNAVAILABLE / CAPABILITY_NOT_ALLOWLISTED`, `target=null`; nu a fost executată nicio acțiune externă și nu a fost cerută confirmare AGM suplimentară. Aceasta este limita disponibilității integrării în buildul testat, nu o alegere greșită a persoanei sau canalului.

Dovezi: `v3/229-v3-messenger-instrumentation.txt`, `v3/229-v3-messenger-proof.txt`.

## Test fizic — duplicate după force-stop

Două persoane distincte `Mona Vodafone` au persistat după force-stop. Comanda exactă a afișat:

    Am găsit mai multe contacte cu numele Mona Vodafone. Pe care vrei să îl apelezi?

Receipt-ul final are `status=CLARIFICATION_REQUIRED`, `reason=AGM_PERSONAL_CONTACT_AMBIGUOUS`, `confirmation=NONE`, `target=null` și `result=CLARIFICATION_REQUIRED`. Panoul de confirmare a rămas ascuns, AGM a rămas în prim-plan și `mCallState=0`. Duplicatul sintetic a fost eliminat după probă.

Pentru accesul la ecranul Premium în această probă s-a folosit un entitlement fixture controlat exclusiv în sesiunea CDP de test; APK-ul, resolverul, localStorage-ul și handoff-urile nu au fost modificate. Harness-ul a fost dezinstalat după validare.

Dovezi: `v3/232-v3-duplicate-clarification-physical-cdp.png`, `v3/232-v3-duplicate-cdp-report.json`.

## Teste automate, Browser și build

- `test:quick-contacts`: PASS.
- `test:android-action-layer`: PASS.
- `test:premium-assistant-ui`: PASS, 12/12.
- handoff multilingv dispozitiv: PASS, 12 limbi.
- SR07C și politica de stocare sensibilă: PASS; 22 chei verificate.
- Web build: PASS.
- AAB v1.5.0 (27), structură și semnătură release: PASS.
- Browser Plugin Status: PASS.
- Integrated Browser Control Status: `PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE`.
- Browser Session Status: PASS.
- Target Page Status: PASS.
- Runner AGM Playwright/Chromium: PASS.
- Raport Browser: `evidence/quick-contacts/browser/2026-09-18T16-13-42-105Z/report.json`.

## Matrice finală

1. Secțiune Profil/Premium și CRUD persoană multicanal: PASS.
2. Persistență după force-stop/relaunch: PASS.
3. Resolver comun fără `READ_CONTACTS`: PASS.
4. Parser „Apelează contactul” / „Apelează”: PASS.
5. Preview nume + număr + sursă înainte de dialer: PASS.
6. O singură confirmare AGM pentru telefon: PASS.
7. `ACTION_DIAL`, fără inițiere automată, `mCallState=0`: PASS.
8. Gmail rezolvat, draft deschis, fără reautorizare sau trimitere: PASS.
9. Messenger rezolvat; handoff indisponibil este blocat sigur: PASS cu limitarea documentată.
10. Duplicate: clarificare exactă, `target=null`, zero acțiuni externe: PASS.
11. Samsung SM-S931B, build v1.5.0 (27), dovezi noi: PASS.